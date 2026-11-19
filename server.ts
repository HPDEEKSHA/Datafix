import 'dotenv/config';
import express from 'express';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  analyzeDataset,
  applyApprovedRepairsAndValidate,
} from './src/engine/analyzer';
import {
  inferColumnProfiles,
  parseDatasetBuffer,
  serializeToCsv,
  serializeToXlsxBuffer,
} from './src/engine/parser';
import {
  DEMO_DATASET_COLUMNS,
  DEMO_DATASET_FILENAME,
  DEMO_DATASET_ROWS,
} from './src/engine/sampleDataset';
import {
  AuditLogEntry,
  DashboardSummary,
  DatasetSession,
  RepairStrategyConfig,
} from './src/engine/types';
import { enrichAnalysisWithGemini } from './src/server/aiDiagnosis';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json({ limit: '15mb' }));

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 },
});

// In-memory session store for uploaded/demo datasets and session audit history
const sessions = new Map<string, DatasetSession>();
const sessionOrder: string[] = [];

function createId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

function sanitizeDownloadName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_').replace(/\.[^.]+$/, '');
}

app.get('/api/health', (_req, res) => {
  const key = process.env.GEMINI_API_KEY?.trim();
  const aiConfigured = Boolean(key && key !== 'MY_GEMINI_API_KEY' && key.length > 10);
  res.json({ ok: true, aiConfigured });
});

app.get('/api/dashboard', (_req, res) => {
  const list = sessionOrder
    .slice()
    .reverse()
    .map((id) => sessions.get(id))
    .filter((s): s is DatasetSession => Boolean(s));

  let totalIssuesDetected = 0;
  let totalIssuesRepaired = 0;
  let currentQualityScore: number | null = null;

  const recentActivity = list.map((s) => {
    const issuesDetected = s.initialAnalysis?.issues.length ?? 0;
    const issuesRepaired = s.validation?.repairedCount ?? 0;
    totalIssuesDetected += issuesDetected;
    totalIssuesRepaired += issuesRepaired;

    const originalScore = s.initialAnalysis?.quality.score ?? null;
    const currentScore = s.validation?.newScore ?? originalScore;
    if (currentQualityScore === null && currentScore !== null) {
      currentQualityScore = currentScore;
    }

    const status: 'uploaded' | 'analyzed' | 'repaired_and_validated' = s.validation
      ? 'repaired_and_validated'
      : s.initialAnalysis
        ? 'analyzed'
        : 'uploaded';

    return {
      id: s.meta.id,
      fileName: s.meta.fileName,
      uploadedAt: s.meta.uploadedAt,
      rowCount: s.meta.rowCount,
      columnCount: s.meta.columnCount,
      issuesDetected,
      issuesRepaired,
      originalScore,
      currentScore,
      status,
    };
  });

  const latestAnalyzed = list.find((s) => s.initialAnalysis !== null);
  const latestQualityOverview = latestAnalyzed?.initialAnalysis
    ? {
        datasetName: latestAnalyzed.meta.fileName,
        originalScore: latestAnalyzed.initialAnalysis.quality.score,
        currentScore:
          latestAnalyzed.validation?.newScore ??
          latestAnalyzed.initialAnalysis.quality.score,
        issuesByCategory:
          latestAnalyzed.validation?.afterIssuesByCategory ??
          latestAnalyzed.initialAnalysis.issuesByCategory,
        missingByColumn:
          latestAnalyzed.validation?.afterMissingByColumn ??
          latestAnalyzed.initialAnalysis.missingByColumn,
        beforeIssues: latestAnalyzed.initialAnalysis.issues.length,
        afterIssues:
          latestAnalyzed.validation?.issuesAfter ??
          latestAnalyzed.initialAnalysis.issues.length,
      }
    : null;

  const summary: DashboardSummary = {
    totalDatasetsProcessed: list.length,
    totalIssuesDetected,
    totalIssuesRepaired,
    currentQualityScore,
    recentActivity,
    latestQualityOverview,
  };

  res.json(summary);
});

app.get('/api/audit-logs', (_req, res) => {
  const allLogs: AuditLogEntry[] = [];
  for (const id of sessionOrder) {
    const s = sessions.get(id);
    if (s) {
      allLogs.push(...s.auditLog);
    }
  }
  allLogs.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  res.json({ logs: allLogs });
});

app.post('/api/datasets/demo', (_req, res) => {
  const id = createId('ds');
  const clonedRows = DEMO_DATASET_ROWS.map((r) => ({ ...r }));
  const profiles = inferColumnProfiles(clonedRows, DEMO_DATASET_COLUMNS);
  const csvSample = serializeToCsv(clonedRows, DEMO_DATASET_COLUMNS);

  const session: DatasetSession = {
    meta: {
      id,
      fileName: DEMO_DATASET_FILENAME,
      fileSizeBytes: Buffer.byteLength(csvSample, 'utf8'),
      fileFormat: 'demo',
      uploadedAt: new Date().toISOString(),
      rowCount: clonedRows.length,
      columnCount: DEMO_DATASET_COLUMNS.length,
      columns: DEMO_DATASET_COLUMNS,
      profiles,
      isDemo: true,
    },
    originalRows: clonedRows,
    repairedRows: null,
    strategy: { numericMissing: 'median', categoricalMissing: 'mode' },
    initialAnalysis: null,
    validation: null,
    auditLog: [],
  };

  sessions.set(id, session);
  sessionOrder.push(id);
  res.json(session);
});

app.post('/api/datasets/upload', upload.single('file'), (req, res) => {
  try {
    if (!req.file) {
      res.status(400).json({ error: 'No file uploaded. Please select a CSV, XLSX, or XLS file.' });
      return;
    }

    const parsed = parseDatasetBuffer(req.file.buffer, req.file.originalname);
    const profiles = inferColumnProfiles(parsed.rows, parsed.columns);
    const id = createId('ds');

    const session: DatasetSession = {
      meta: {
        id,
        fileName: req.file.originalname,
        fileSizeBytes: req.file.size,
        fileFormat: parsed.fileFormat,
        uploadedAt: new Date().toISOString(),
        rowCount: parsed.rows.length,
        columnCount: parsed.columns.length,
        columns: parsed.columns,
        profiles,
        isDemo: false,
      },
      originalRows: parsed.rows,
      repairedRows: null,
      strategy: { numericMissing: 'median', categoricalMissing: 'mode' },
      initialAnalysis: null,
      validation: null,
      auditLog: [],
    };

    sessions.set(id, session);
    sessionOrder.push(id);
    res.json(session);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to parse uploaded file.';
    res.status(400).json({ error: message });
  }
});

app.get('/api/datasets/:id', (req, res) => {
  const session = sessions.get(req.params.id);
  if (!session) {
    res.status(404).json({ error: 'Dataset session not found.' });
    return;
  }
  res.json(session);
});

app.post('/api/datasets/:id/analyze', async (req, res) => {
  const session = sessions.get(req.params.id);
  if (!session) {
    res.status(404).json({ error: 'Dataset session not found.' });
    return;
  }

  try {
    const bodyStrategy = req.body?.strategy as Partial<RepairStrategyConfig> | undefined;
    const strategy: RepairStrategyConfig = {
      numericMissing: bodyStrategy?.numericMissing ?? session.strategy.numericMissing,
      categoricalMissing:
        bodyStrategy?.categoricalMissing ?? session.strategy.categoricalMissing,
    };

    session.strategy = strategy;
    const deterministicAnalysis = analyzeDataset(
      session.originalRows,
      session.meta.columns,
      strategy
    );

    const enrichedAnalysis = await enrichAnalysisWithGemini(
      session.meta.fileName,
      session.meta.profiles,
      deterministicAnalysis
    );

    session.initialAnalysis = enrichedAnalysis;
    // Reset prior validation if re-analyzing with a new strategy
    session.repairedRows = null;
    session.validation = null;

    res.json(session);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Analysis failed.';
    res.status(500).json({ error: message });
  }
});

app.post('/api/datasets/:id/repair', (req, res) => {
  const session = sessions.get(req.params.id);
  if (!session) {
    res.status(404).json({ error: 'Dataset session not found.' });
    return;
  }
  if (!session.initialAnalysis) {
    res.status(400).json({ error: 'Dataset must be analyzed before applying repairs.' });
    return;
  }

  try {
    const decisions = (req.body?.decisions ?? {}) as Record<
      string,
      'approved' | 'rejected'
    >;

    const result = applyApprovedRepairsAndValidate({
      datasetId: session.meta.id,
      datasetName: session.meta.fileName,
      originalRows: session.originalRows,
      columns: session.meta.columns,
      initialAnalysis: session.initialAnalysis,
      decisions,
      strategy: session.strategy,
    });

    session.repairedRows = result.repairedRows;
    session.initialAnalysis = {
      ...session.initialAnalysis,
      proposals: result.updatedProposals,
    };
    session.validation = result.validation;
    session.auditLog = [...result.auditEntries, ...session.auditLog];

    res.json(session);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Repair application failed.';
    res.status(500).json({ error: message });
  }
});

app.get('/api/datasets/:id/export', (req, res) => {
  const session = sessions.get(req.params.id);
  if (!session) {
    res.status(404).json({ error: 'Dataset session not found.' });
    return;
  }

  const format = String(req.query.format || 'csv').toLowerCase();
  const baseName = sanitizeDownloadName(session.meta.fileName) || 'dataset';
  const targetRows = session.repairedRows ?? session.originalRows;

  if (format === 'csv') {
    const csv = serializeToCsv(targetRows, session.meta.columns);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${baseName}_cleaned.csv"`
    );
    res.send(csv);
    return;
  }

  if (format === 'xlsx') {
    const buf = serializeToXlsxBuffer(targetRows, session.meta.columns);
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${baseName}_cleaned.xlsx"`
    );
    res.send(buf);
    return;
  }

  if (format === 'report') {
    const reportPayload = {
      platform: 'DATAFIX',
      generatedAt: new Date().toISOString(),
      dataset: {
        fileName: session.meta.fileName,
        originalRowCount: session.meta.rowCount,
        finalRowCount: targetRows.length,
        columnCount: session.meta.columnCount,
        columns: session.meta.profiles,
      },
      initialAnalysis: session.initialAnalysis
        ? {
            score: session.initialAnalysis.quality,
            issuesByCategory: session.initialAnalysis.issuesByCategory,
            aiSummary: session.initialAnalysis.aiSummary,
            issues: session.initialAnalysis.issues,
          }
        : null,
      validation: session.validation,
    };
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${baseName}_quality_report.json"`
    );
    res.send(JSON.stringify(reportPayload, null, 2));
    return;
  }

  if (format === 'audit') {
    const auditCols = [
      'id',
      'timestamp',
      'datasetName',
      'rowNumber',
      'column',
      'originalValue',
      'repairedValue',
      'repairMethod',
      'reason',
      'confidence',
      'approvalStatus',
    ];
    const auditRows = session.auditLog.map((a) => ({
      id: a.id,
      timestamp: a.timestamp,
      datasetName: a.datasetName,
      rowNumber: a.rowNumber,
      column: a.column,
      originalValue: a.originalValue,
      repairedValue: a.repairedValue,
      repairMethod: a.repairMethod,
      reason: a.reason,
      confidence: a.confidence,
      approvalStatus: a.approvalStatus,
    }));
    const csv = serializeToCsv(auditRows, auditCols);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${baseName}_audit_log.csv"`
    );
    res.send(csv);
    return;
  }

  res.status(400).json({ error: 'Unsupported export format.' });
});

async function startServer() {
  const PORT = Number(process.env.PORT) || 3000;

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`DATAFIX server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
