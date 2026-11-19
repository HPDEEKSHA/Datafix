export type CellValue = string | number | boolean | null | undefined;
export type DatasetRow = Record<string, CellValue>;

export type ColumnSemanticType =
  | 'number'
  | 'email'
  | 'phone'
  | 'date'
  | 'categorical'
  | 'text';

export interface ColumnProfile {
  name: string;
  inferredType: ColumnSemanticType;
  nonEmptyCount: number;
  missingCount: number;
  uniqueCount: number;
  sampleValues: string[];
  numericStats?: {
    min: number;
    max: number;
    mean: number;
    median: number;
    q1: number;
    q3: number;
    iqr: number;
  };
}

export type IssueCategory =
  | 'missing_value'
  | 'duplicate_record'
  | 'invalid_format'
  | 'inconsistent_entry'
  | 'anomaly';

export type IssueSeverity = 'high' | 'medium' | 'low';

export interface DetectedIssue {
  id: string;
  category: IssueCategory;
  severity: IssueSeverity;
  column: string;
  affectedRows: number[];
  originalValues: string[];
  problemDescription: string;
  likelyCause: string;
  recommendedCorrection: string;
  confidence: number;
  requiresReview: boolean;
  aiExplanation?: string;
  relatedPatterns?: string;
}

export type MissingNumericStrategy = 'median' | 'mean' | 'preserve';
export type MissingCategoricalStrategy = 'mode' | 'preserve';

export interface RepairStrategyConfig {
  numericMissing: MissingNumericStrategy;
  categoricalMissing: MissingCategoricalStrategy;
}

export type RepairActionType =
  | 'update_cell'
  | 'remove_duplicate_row'
  | 'flag_for_review';

export type RepairStatus = 'pending' | 'approved' | 'rejected' | 'applied';

export interface RepairProposal {
  id: string;
  issueId: string;
  category: IssueCategory;
  rowNumber: number;
  column: string;
  originalValue: string;
  proposedValue: string | null;
  actionType: RepairActionType;
  reason: string;
  repairMethod: string;
  confidence: number;
  safeToAutoApply: boolean;
  status: RepairStatus;
}

export interface QualityScoreBreakdown {
  score: number;
  totalRows: number;
  totalColumns: number;
  totalCells: number;
  totalIssues: number;
  penaltyPoints: number;
  completenessRate: number;
  validityRate: number;
  consistencyRate: number;
  uniquenessRate: number;
  formulaDescription: string;
}

export interface CategoryCount {
  category: IssueCategory;
  label: string;
  count: number;
}

export interface ColumnMissingCount {
  column: string;
  missingCount: number;
  totalRows: number;
}

export interface AnalysisResult {
  analyzedAt: string;
  quality: QualityScoreBreakdown;
  issues: DetectedIssue[];
  proposals: RepairProposal[];
  issuesByCategory: CategoryCount[];
  missingByColumn: ColumnMissingCount[];
  aiSummary?: {
    provider: 'gemini' | 'deterministic';
    model?: string;
    executiveSummary: string;
    patternInsights: string[];
    warningMessage?: string;
  };
}

export interface ValidationResult {
  validatedAt: string;
  originalScore: number;
  newScore: number;
  scoreDelta: number;
  issuesBefore: number;
  issuesAfter: number;
  repairedCount: number;
  unresolvedCount: number;
  rejectedCount: number;
  status: 'validated' | 'partially_validated' | 'needs_review';
  beforeAnalysis: QualityScoreBreakdown;
  afterAnalysis: QualityScoreBreakdown;
  afterIssues: DetectedIssue[];
  afterIssuesByCategory: CategoryCount[];
  afterMissingByColumn: ColumnMissingCount[];
}

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  datasetId: string;
  datasetName: string;
  rowNumber: number;
  column: string;
  originalValue: string;
  repairedValue: string;
  reason: string;
  repairMethod: string;
  confidence: number;
  approvalStatus: 'approved' | 'rejected' | 'flagged_for_review';
}

export interface DatasetFileMeta {
  id: string;
  fileName: string;
  fileSizeBytes: number;
  fileFormat: 'csv' | 'xlsx' | 'xls' | 'demo';
  uploadedAt: string;
  rowCount: number;
  columnCount: number;
  columns: string[];
  profiles: ColumnProfile[];
  isDemo: boolean;
}

export interface DatasetSession {
  meta: DatasetFileMeta;
  originalRows: DatasetRow[];
  repairedRows: DatasetRow[] | null;
  strategy: RepairStrategyConfig;
  initialAnalysis: AnalysisResult | null;
  validation: ValidationResult | null;
  auditLog: AuditLogEntry[];
}

export interface DashboardSummary {
  totalDatasetsProcessed: number;
  totalIssuesDetected: number;
  totalIssuesRepaired: number;
  currentQualityScore: number | null;
  recentActivity: Array<{
    id: string;
    fileName: string;
    uploadedAt: string;
    rowCount: number;
    columnCount: number;
    issuesDetected: number;
    issuesRepaired: number;
    originalScore: number | null;
    currentScore: number | null;
    status: 'uploaded' | 'analyzed' | 'repaired_and_validated';
  }>;
  latestQualityOverview: {
    datasetName: string;
    originalScore: number;
    currentScore: number;
    issuesByCategory: CategoryCount[];
    missingByColumn: ColumnMissingCount[];
    beforeIssues: number;
    afterIssues: number;
  } | null;
}
