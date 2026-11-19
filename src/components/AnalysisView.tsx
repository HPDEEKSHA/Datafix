import React, { useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  Brain,
  CheckCircle2,
  RefreshCw,
  ShieldAlert,
} from 'lucide-react';
import {
  DatasetSession,
  IssueCategory,
  MissingCategoricalStrategy,
  MissingNumericStrategy,
  RepairStrategyConfig,
} from '../engine/types';
import {
  IssuesByCategoryChart,
  MissingByColumnChart,
  QualityGauge,
} from './DataCharts';

interface AnalysisViewProps {
  session: DatasetSession | null;
  analyzing: boolean;
  onReanalyze: (strategy: RepairStrategyConfig) => void;
  onGoToRepairPreview: () => void;
  onGoToUpload: () => void;
}

const CATEGORY_FILTER_TABS: Array<{ id: 'all' | IssueCategory; label: string }> = [
  { id: 'all', label: 'All Issues' },
  { id: 'missing_value', label: 'Missing Values' },
  { id: 'duplicate_record', label: 'Duplicates' },
  { id: 'invalid_format', label: 'Invalid Formats' },
  { id: 'inconsistent_entry', label: 'Inconsistent' },
  { id: 'anomaly', label: 'Anomalies' },
];

const CATEGORY_TEXT: Record<IssueCategory, string> = {
  missing_value: 'Missing Value',
  duplicate_record: 'Duplicate Record',
  invalid_format: 'Invalid Format',
  inconsistent_entry: 'Inconsistent Entry',
  anomaly: 'Statistical Anomaly',
};

export default function AnalysisView({
  session,
  analyzing,
  onReanalyze,
  onGoToRepairPreview,
  onGoToUpload,
}: AnalysisViewProps) {
  const [filterCat, setFilterCat] = useState<'all' | IssueCategory>('all');
  const [numericStrategy, setNumericStrategy] = useState<MissingNumericStrategy>(
    session?.strategy.numericMissing ?? 'median'
  );
  const [categoricalStrategy, setCategoricalStrategy] = useState<MissingCategoricalStrategy>(
    session?.strategy.categoricalMissing ?? 'mode'
  );

  if (!session) {
    return (
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-10 text-center space-y-4">
        <h2 className="font-display text-lg font-semibold text-slate-950">
          No Dataset Loaded
        </h2>
        <p className="text-sm text-slate-600 max-w-md mx-auto">
          Upload a CSV or Excel file, or load the demonstration dataset first to run quality
          analysis and AI root-cause diagnosis.
        </p>
        <button
          type="button"
          onClick={onGoToUpload}
          className="px-5 py-2.5 text-sm font-semibold text-white bg-slate-950 rounded-lg hover:bg-indigo-950 cursor-pointer"
        >
          Go to Upload & Demo
        </button>
      </div>
    );
  }

  const analysis = session.initialAnalysis;
  if (!analysis) {
    return (
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-10 text-center space-y-4">
        <h2 className="font-display text-lg font-semibold text-slate-950">
          Ready to Analyze {session.meta.fileName}
        </h2>
        <p className="text-sm text-slate-600 max-w-md mx-auto">
          Click below to inspect {session.meta.rowCount} rows and {session.meta.columnCount}{' '}
          columns for defects and root-cause explanations.
        </p>
        <button
          type="button"
          onClick={() =>
            onReanalyze({
              numericMissing: numericStrategy,
              categoricalMissing: categoricalStrategy,
            })
          }
          disabled={analyzing}
          className="px-5 py-2.5 text-sm font-semibold text-white bg-slate-950 rounded-lg hover:bg-indigo-950 cursor-pointer disabled:opacity-60"
        >
          {analyzing ? 'Analyzing Dataset...' : 'Run Quality Analysis'}
        </button>
      </div>
    );
  }

  const filteredIssues =
    filterCat === 'all'
      ? analysis.issues
      : analysis.issues.filter((i) => i.category === filterCat);

  const strategyChanged =
    numericStrategy !== session.strategy.numericMissing ||
    categoricalStrategy !== session.strategy.categoricalMissing;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-950">
            Quality Analysis & AI Diagnosis
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            {session.meta.fileName} · {analysis.issues.length} detected issues across{' '}
            {analysis.quality.totalCells} cells
          </p>
        </div>

        <button
          type="button"
          onClick={onGoToRepairPreview}
          className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-slate-950 rounded-lg hover:bg-indigo-950 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        >
          Review Repair Preview
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>

      {/* Imputation Strategy Config */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 flex-1">
          <div>
            <label
              htmlFor="numeric-strategy-select"
              className="block text-xs font-medium text-slate-700 mb-1.5"
            >
              Numeric Missing Value Strategy
            </label>
            <select
              id="numeric-strategy-select"
              value={numericStrategy}
              onChange={(e) => setNumericStrategy(e.target.value as MissingNumericStrategy)}
              className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-violet-600"
            >
              <option value="median">Median Imputation (Recommended for skewed data)</option>
              <option value="mean">Mean Imputation</option>
              <option value="preserve">Preserve Missing (Manual Review Only)</option>
            </select>
          </div>

          <div>
            <label
              htmlFor="categorical-strategy-select"
              className="block text-xs font-medium text-slate-700 mb-1.5"
            >
              Categorical Missing Value Strategy
            </label>
            <select
              id="categorical-strategy-select"
              value={categoricalStrategy}
              onChange={(e) =>
                setCategoricalStrategy(e.target.value as MissingCategoricalStrategy)
              }
              className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-violet-600"
            >
              <option value="mode">Mode Imputation (Most Frequent Category)</option>
              <option value="preserve">Preserve Missing (Manual Review Only)</option>
            </select>
          </div>
        </div>

        <button
          type="button"
          disabled={analyzing}
          onClick={() =>
            onReanalyze({
              numericMissing: numericStrategy,
              categoricalMissing: categoricalStrategy,
            })
          }
          className={`inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg border transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-60 ${
            strategyChanged
              ? 'bg-violet-700 text-white border-violet-700 hover:bg-violet-800'
              : 'bg-white text-slate-800 border-slate-300 hover:bg-slate-50'
          }`}
        >
          <RefreshCw className={`w-4 h-4 ${analyzing ? 'animate-spin' : ''}`} />
          {analyzing ? 'Re-analyzing...' : 'Apply Strategy & Re-analyze'}
        </button>
      </div>

      {/* Score & Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-6 space-y-4">
          <h2 className="font-display text-base font-semibold text-slate-950">
            Baseline Data Quality Score
          </h2>
          <QualityGauge
            score={analysis.quality.score}
            label="Baseline"
            breakdown={analysis.quality}
          />
          <p className="text-xs text-slate-500 font-mono leading-relaxed pt-2 border-t border-slate-100">
            {analysis.quality.formulaDescription}
          </p>
        </div>

        <div className="lg:col-span-4 bg-white border border-slate-200 rounded-xl p-6 space-y-4">
          <h2 className="font-display text-base font-semibold text-slate-950">
            Issues by Category
          </h2>
          <IssuesByCategoryChart data={analysis.issuesByCategory} />
        </div>

        <div className="lg:col-span-3 bg-white border border-slate-200 rounded-xl p-6 space-y-4">
          <h2 className="font-display text-base font-semibold text-slate-950">
            Missing Values by Column
          </h2>
          <MissingByColumnChart data={analysis.missingByColumn} />
        </div>
      </div>

      {/* AI Diagnosis Summary */}
      {analysis.aiSummary && (
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <Brain className="w-5 h-5 text-violet-700" />
              <h2 className="font-display text-base font-semibold text-slate-950">
                Root Cause Diagnosis & Cross-Column Insights
              </h2>
            </div>
            <span className="text-xs font-mono text-slate-600">
              {analysis.aiSummary.provider === 'gemini'
                ? `AI Engine: ${analysis.aiSummary.model}`
                : 'Engine: Deterministic Local Diagnostics'}
            </span>
          </div>

          <p className="text-sm text-slate-800 leading-relaxed">
            {analysis.aiSummary.executiveSummary}
          </p>

          {analysis.aiSummary.patternInsights.length > 0 && (
            <ul className="space-y-1.5 text-sm text-slate-700 list-disc pl-5">
              {analysis.aiSummary.patternInsights.map((insight, idx) => (
                <li key={idx}>{insight}</li>
              ))}
            </ul>
          )}

          {analysis.aiSummary.warningMessage && (
            <p className="text-xs text-slate-500 pt-1">
              Note: {analysis.aiSummary.warningMessage}
            </p>
          )}
        </div>
      )}

      {/* Issues Explorer */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <h2 className="font-display text-lg font-semibold text-slate-950">
            Detected Issues & Recommendations ({filteredIssues.length})
          </h2>

          <div
            role="tablist"
            aria-label="Filter issues by category"
            className="flex flex-wrap items-center gap-1 p-1 bg-slate-100 rounded-lg"
          >
            {CATEGORY_FILTER_TABS.map((tab) => {
              const active = filterCat === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setFilterCat(tab.id)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    active
                      ? 'bg-white text-slate-950 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        {filteredIssues.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-xl p-8 text-center text-sm text-slate-600">
            No issues found in this category.
          </div>
        ) : (
          <div className="space-y-3">
            {filteredIssues.map((issue) => (
              <div
                key={issue.id}
                className="bg-white border border-slate-200 rounded-xl p-5 space-y-3"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="font-semibold text-slate-950">
                      {CATEGORY_TEXT[issue.category]}
                    </span>
                    <span aria-hidden="true" className="text-slate-400">
                      ·
                    </span>
                    <span className="font-mono text-indigo-900 font-medium">
                      Column: {issue.column}
                    </span>
                    <span aria-hidden="true" className="text-slate-400">
                      ·
                    </span>
                    <span className="font-mono tabular-nums text-slate-600">
                      Row {issue.affectedRows.join(', ')}
                    </span>
                    <span aria-hidden="true" className="text-slate-400">
                      ·
                    </span>
                    <span className="font-mono text-slate-700">
                      Original: {issue.originalValues.join(', ')}
                    </span>
                  </div>

                  <div className="flex items-center gap-3 text-xs shrink-0">
                    {issue.requiresReview ? (
                      <span className="inline-flex items-center gap-1 text-amber-700 font-medium">
                        <ShieldAlert className="w-3.5 h-3.5" />
                        Human Review Required
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-emerald-700 font-medium">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Safe Repair Available
                      </span>
                    )}
                    <span className="font-mono tabular-nums text-slate-700 font-semibold">
                      {issue.confidence}% confidence
                    </span>
                  </div>
                </div>

                <p className="text-sm text-slate-900 font-medium">
                  {issue.problemDescription}
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-slate-100 text-xs">
                  <div>
                    <div className="font-semibold text-slate-700 mb-0.5">
                      Likely Root Cause
                    </div>
                    <div className="text-slate-600 leading-relaxed">
                      {issue.aiExplanation || issue.likelyCause}
                    </div>
                  </div>
                  <div>
                    <div className="font-semibold text-slate-700 mb-0.5">
                      Recommended Correction
                    </div>
                    <div className="text-slate-600 leading-relaxed">
                      {issue.recommendedCorrection}
                    </div>
                  </div>
                </div>

                {issue.relatedPatterns && (
                  <div className="text-xs text-violet-800 flex items-center gap-1.5 pt-1">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                    <span>Related pattern: {issue.relatedPatterns}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
