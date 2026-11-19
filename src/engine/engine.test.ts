import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEMO_DATASET_COLUMNS,
  DEMO_DATASET_ROWS,
} from './sampleDataset';
import {
  analyzeDataset,
  applyApprovedRepairsAndValidate,
} from './analyzer';
import {
  parseDatasetBuffer,
  serializeToCsv,
  serializeToXlsxBuffer,
} from './parser';

test('demo dataset detects all 5 issue categories', () => {
  const analysis = analyzeDataset(DEMO_DATASET_ROWS, DEMO_DATASET_COLUMNS);
  const categories = new Set(analysis.issues.map((i) => i.category));

  assert.equal(categories.has('missing_value'), true);
  assert.equal(categories.has('duplicate_record'), true);
  assert.equal(categories.has('invalid_format'), true);
  assert.equal(categories.has('inconsistent_entry'), true);
  assert.equal(categories.has('anomaly'), true);
  assert.ok(analysis.quality.score < 95 && analysis.quality.score > 40);
});

test('applying approved safe repairs improves score, preserves original, and keeps anomalies intact', () => {
  const snapshotBefore = JSON.stringify(DEMO_DATASET_ROWS);
  const analysis = analyzeDataset(DEMO_DATASET_ROWS, DEMO_DATASET_COLUMNS, {
    numericMissing: 'median',
    categoricalMissing: 'mode',
  });

  const decisions: Record<string, 'approved' | 'rejected'> = {};
  for (const p of analysis.proposals) {
    if (p.safeToAutoApply) {
      decisions[p.id] = 'approved';
    }
  }

  const result = applyApprovedRepairsAndValidate({
    datasetId: 'demo-1',
    datasetName: 'demo.csv',
    originalRows: DEMO_DATASET_ROWS,
    columns: DEMO_DATASET_COLUMNS,
    initialAnalysis: analysis,
    decisions,
    strategy: { numericMissing: 'median', categoricalMissing: 'mode' },
  });

  // Original dataset untouched
  assert.equal(JSON.stringify(DEMO_DATASET_ROWS), snapshotBefore);

  // Two duplicate rows removed (24 -> 22)
  assert.equal(result.repairedRows.length, 22);

  // Score improved after independent re-validation
  assert.ok(result.validation.newScore > result.validation.originalScore);
  assert.ok(result.validation.issuesAfter < result.validation.issuesBefore);

  // Anomalies (985000 and -450) were NOT silently deleted or overwritten
  const spends = result.repairedRows.map((r) => r.annual_spend);
  assert.equal(spends.includes(985000), true);
  assert.equal(spends.includes(-450), true);

  // Audit log captured all decisions
  assert.equal(result.auditEntries.length, analysis.proposals.length);
});

test('missing value strategy switches between median, mean, and preserve', () => {
  const rows = [
    { id: '1', score: 10, tier: 'Basic' },
    { id: '2', score: 10, tier: 'Basic' },
    { id: '3', score: 100, tier: 'Pro' },
    { id: '4', score: '', tier: '' },
  ];
  const cols = ['id', 'score', 'tier'];

  const medianAnalysis = analyzeDataset(rows, cols, {
    numericMissing: 'median',
    categoricalMissing: 'mode',
  });
  const medianProp = medianAnalysis.proposals.find((p) => p.column === 'score');
  assert.equal(medianProp?.proposedValue, '10');

  const meanAnalysis = analyzeDataset(rows, cols, {
    numericMissing: 'mean',
    categoricalMissing: 'mode',
  });
  const meanProp = meanAnalysis.proposals.find((p) => p.column === 'score');
  assert.equal(meanProp?.proposedValue, '40');

  const preserveAnalysis = analyzeDataset(rows, cols, {
    numericMissing: 'preserve',
    categoricalMissing: 'preserve',
  });
  const preserveProp = preserveAnalysis.proposals.find((p) => p.column === 'score');
  assert.equal(preserveProp?.proposedValue, null);
  assert.equal(preserveProp?.actionType, 'flag_for_review');
});

test('CSV and XLSX serialization round-trip preserves rows and columns', () => {
  const csvStr = serializeToCsv(DEMO_DATASET_ROWS.slice(0, 5), DEMO_DATASET_COLUMNS);
  const parsedCsv = parseDatasetBuffer(Buffer.from(csvStr, 'utf8'), 'test.csv');
  assert.equal(parsedCsv.rows.length, 5);
  assert.deepEqual(parsedCsv.columns, DEMO_DATASET_COLUMNS);

  const xlsxBuf = serializeToXlsxBuffer(DEMO_DATASET_ROWS.slice(0, 5), DEMO_DATASET_COLUMNS);
  const parsedXlsx = parseDatasetBuffer(xlsxBuf, 'test.xlsx');
  assert.equal(parsedXlsx.rows.length, 5);
  assert.deepEqual(parsedXlsx.columns, DEMO_DATASET_COLUMNS);
});

test('rejects empty files and unsupported extensions cleanly', () => {
  assert.throws(
    () => parseDatasetBuffer(Buffer.from('', 'utf8'), 'empty.csv'),
    /empty/i
  );
  assert.throws(
    () => parseDatasetBuffer(Buffer.from('hello', 'utf8'), 'notes.txt'),
    /Unsupported file format/i
  );
});
