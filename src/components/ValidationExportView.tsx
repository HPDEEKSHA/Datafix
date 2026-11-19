import React, { useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  FileText,
  History,
  ShieldCheck,
} from 'lucide-react';
import { isMissingValue } from '../engine/parser';
import { DatasetSession } from '../engine/types';
import {
  BeforeAfterComparisonChart,
  IssuesByCategoryChart,
  QualityGauge,
} from './DataCharts';

interface ValidationExportViewProps {
  session: DatasetSession | null;
  onGoToRepairPreview: () => void;
  onGoToAuditLog: () => void;
}

export default function ValidationExportView({
  session,
  onGoToRepairPreview,
  onGoToAuditLog,
}: ValidationExportViewProps) {
  const [viewMode, setViewMode] = useState<'cleaned' | 'original' | 'diff'>('cleaned');

  if (!session || !session.validation) {
    return (
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-10 text-center space-y-4">
        <h2 className="font-display text-lg font-semibold text-slate-950">
          Validation Runs After Repair Approval
        </h2>
        <p className="text-sm text-slate-600 max-w-md mx-auto">
          Review and apply approved repairs first. DATAFIX will independently re-analyze the
          repaired dataset before unlocking validated exports.
        </p>
        <button
          type="button"
          onClick={onGoToRepairPreview}
          className="px-5 py-2.5 text-sm font-semibold text-white bg-slate-950 rounded-lg hover:bg-indigo-950 cursor-pointer"
        >
          Go to Repair Preview
        </button>
      </div>
    );
  }

  const val = session.validation;
  const cleanedRows = session.repairedRows ?? session.originalRows;
  const columns = session.meta.columns;
  const baseApi = `/api/datasets/${encodeURIComponent(session.meta.id)}/export`;

  const statusLabel =
    val.status === 'validated'
      ? 'Validated — Zero Remaining Defects'
      : val.status === 'partially_validated'
        ? 'Validated Safe Repairs — Manual Review Items Preserved'
        : 'Needs Additional Review — Unapplied Repairs Remain';

  // Compute modified cells from auditLog for the "Changed Cells" diff view
  const approvedChanges = session.auditLog.filter((a) => a.approvalStatus === 'approved');

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-950">
            Post-Repair Validation & Export
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            Independent quality check completed at{' '}
            <span className="font-mono">{new Date(val.validatedAt).toLocaleTimeString()}</span> on{' '}
            {cleanedRows.length} final rows.
          </p>
        </div>

        <button
          type="button"
          onClick={onGoToAuditLog}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-slate-900 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        >
          <History className="w-4 h-4 text-violet-700" />
          View Full Audit Log
        </button>
      </div>

      {/* Validation Status Banner */}
      <div
        className={`rounded-xl border p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
          val.status === 'validated'
            ? 'bg-emerald-50/70 border-emerald-200 text-emerald-950'
            : val.status === 'partially_validated'
              ? 'bg-slate-50 border-slate-200 text-slate-900'
              : 'bg-amber-50/70 border-amber-200 text-amber-950'
        }`}
      >
        <div className="flex items-start gap-3">
          {val.status === 'needs_review' ? (
            <AlertTriangle className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
          ) : (
            <ShieldCheck className="w-5 h-5 text-emerald-700 shrink-0 mt-0.5" />
          )}
          <div>
            <div className="font-display font-semibold text-base">{statusLabel}</div>
            <div className="text-xs text-slate-600 mt-0.5">
              Re-evaluated {val.afterAnalysis.totalCells} cells independently after applying{' '}
              {val.repairedCount} approved modifications.
            </div>
          </div>
        </div>
        <div className="text-sm font-mono tabular-nums font-bold text-violet-800 shrink-0">
          {val.scoreDelta >= 0 ? `+${val.scoreDelta.toFixed(1)}%` : `${val.scoreDelta.toFixed(1)}%`}{' '}
          Quality Gain
        </div>
      </div>

      {/* Before vs After KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-1">
          <div className="text-xs text-slate-500">Original Quality Score</div>
          <div className="text-2xl font-bold font-mono tabular-nums text-slate-700">
            {val.originalScore.toFixed(1)}%
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-1">
          <div className="text-xs text-slate-500">New Quality Score</div>
          <div className="text-2xl font-bold font-mono tabular-nums text-violet-700">
            {val.newScore.toFixed(1)}%
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-1">
          <div className="text-xs text-slate-500">Issues Before</div>
          <div className="text-2xl font-bold font-mono tabular-nums text-slate-800">
            {val.issuesBefore}
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-1">
          <div className="text-xs text-slate-500">Successfully Repaired</div>
          <div className="text-2xl font-bold font-mono tabular-nums text-emerald-700">
            {val.repairedCount}
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-1">
          <div className="text-xs text-slate-500">Unresolved Issues</div>
          <div className="text-2xl font-bold font-mono tabular-nums text-amber-700">
            {val.unresolvedCount}
          </div>
        </div>
      </div>

      {/* Charts + Export Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-6 space-y-6">
          <h2 className="font-display text-base font-semibold text-slate-950">
            Before vs After Validation Metrics
          </h2>
          <QualityGauge
            score={val.newScore}
            label="Post-Repair"
            breakdown={val.afterAnalysis}
          />
          <div className="pt-4 border-t border-slate-100">
            <BeforeAfterComparisonChart
              originalScore={val.originalScore}
              newScore={val.newScore}
              issuesBefore={val.issuesBefore}
              issuesAfter={val.issuesAfter}
            />
          </div>
        </div>

        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-6 space-y-5">
          <div>
            <h2 className="font-display text-base font-semibold text-slate-950">
              Export Validated Deliverables
            </h2>
            <p className="text-xs text-slate-600 mt-1">
              Downloads reflect the actual repaired dataset ({cleanedRows.length} rows) and full
              verification records.
            </p>
          </div>

          <div className="space-y-2.5">
            <a
              href={`${baseApi}?format=csv`}
              download
              className="flex items-center justify-between w-full px-4 py-3 text-sm font-semibold text-white bg-slate-950 rounded-lg hover:bg-indigo-950 transition-colors"
            >
              <span className="inline-flex items-center gap-2.5">
                <Download className="w-4 h-4" />
                Download Cleaned CSV
              </span>
              <span className="text-xs font-mono opacity-80">.csv</span>
            </a>

            <a
              href={`${baseApi}?format=xlsx`}
              download
              className="flex items-center justify-between w-full px-4 py-3 text-sm font-semibold text-slate-900 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
            >
              <span className="inline-flex items-center gap-2.5">
                <FileSpreadsheet className="w-4 h-4 text-emerald-700" />
                Download Cleaned Excel
              </span>
              <span className="text-xs font-mono text-slate-500">.xlsx</span>
            </a>

            <a
              href={`${baseApi}?format=report`}
              download
              className="flex items-center justify-between w-full px-4 py-3 text-sm font-semibold text-slate-900 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
            >
              <span className="inline-flex items-center gap-2.5">
                <FileText className="w-4 h-4 text-violet-700" />
                Download Quality Report
              </span>
              <span className="text-xs font-mono text-slate-500">.json</span>
            </a>

            <a
              href={`${baseApi}?format=audit`}
              download
              className="flex items-center justify-between w-full px-4 py-3 text-sm font-semibold text-slate-900 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
            >
              <span className="inline-flex items-center gap-2.5">
                <History className="w-4 h-4 text-indigo-900" />
                Download Repair Audit Log
              </span>
              <span className="text-xs font-mono text-slate-500">.csv</span>
            </a>
          </div>

          <div className="pt-3 border-t border-slate-100">
            <h3 className="text-xs font-semibold text-slate-700 mb-3">
              Remaining Issues by Category
            </h3>
            <IssuesByCategoryChart data={val.afterIssuesByCategory} />
          </div>
        </div>
      </div>

      {/* Remaining Unresolved Issues */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <h2 className="font-display text-base font-semibold text-slate-950">
            Unresolved Issues Requiring Human Attention ({val.afterIssues.length})
          </h2>
          <span className="text-xs text-slate-500">
            Anomalies & unrecoverable fields preserved intentionally
          </span>
        </div>

        {val.afterIssues.length === 0 ? (
          <div className="p-8 text-center text-sm text-emerald-700 flex items-center justify-center gap-2 font-medium">
            <CheckCircle2 className="w-4 h-4" />
            All detected issues were successfully repaired and verified.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-slate-500 font-medium">
                  <th className="py-2.5 px-6">Row</th>
                  <th className="py-2.5 px-4">Column</th>
                  <th className="py-2.5 px-4">Current Value</th>
                  <th className="py-2.5 px-4">Issue Description</th>
                  <th className="py-2.5 px-6">Recommended Next Step</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {val.afterIssues.map((iss) => (
                  <tr key={iss.id} className="hover:bg-slate-50/70">
                    <td className="py-3 px-6 font-mono tabular-nums text-slate-600">
                      #{iss.affectedRows.join(', ')}
                    </td>
                    <td className="py-3 px-4 font-mono font-semibold text-slate-900">
                      {iss.column}
                    </td>
                    <td className="py-3 px-4 font-mono text-amber-800">
                      {iss.originalValues.join(', ')}
                    </td>
                    <td className="py-3 px-4 text-slate-700 max-w-sm">
                      {iss.problemDescription}
                    </td>
                    <td className="py-3 px-6 text-slate-600 max-w-sm">
                      {iss.recommendedCorrection}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Before and After Dataset Comparison */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <h2 className="font-display text-base font-semibold text-slate-950">
            Before & After Dataset Comparison
          </h2>
          <div
            role="tablist"
            aria-label="Dataset comparison mode"
            className="inline-flex items-center gap-1 p-1 bg-slate-100 rounded-lg"
          >
            <button
              type="button"
              role="tab"
              aria-selected={viewMode === 'cleaned'}
              onClick={() => setViewMode('cleaned')}
              className={`px-3 py-1 text-xs font-medium rounded-md cursor-pointer ${
                viewMode === 'cleaned'
                  ? 'bg-white text-slate-950 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Cleaned Dataset ({cleanedRows.length})
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={viewMode === 'diff'}
              onClick={() => setViewMode('diff')}
              className={`px-3 py-1 text-xs font-medium rounded-md cursor-pointer ${
                viewMode === 'diff'
                  ? 'bg-white text-slate-950 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Applied Diffs ({approvedChanges.length})
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={viewMode === 'original'}
              onClick={() => setViewMode('original')}
              className={`px-3 py-1 text-xs font-medium rounded-md cursor-pointer ${
                viewMode === 'original'
                  ? 'bg-white text-slate-950 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Original ({session.originalRows.length})
            </button>
          </div>
        </div>

        {viewMode === 'diff' ? (
          <div className="overflow-x-auto">
            {approvedChanges.length === 0 ? (
              <div className="p-8 text-center text-sm text-slate-500">
                No modifications were approved in this run.
              </div>
            ) : (
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-slate-500 font-medium">
                    <th className="py-2.5 px-6">Row</th>
                    <th className="py-2.5 px-4">Column</th>
                    <th className="py-2.5 px-4">Before (Original)</th>
                    <th className="py-2.5 px-4">After (Repaired)</th>
                    <th className="py-2.5 px-6">Repair Method</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {approvedChanges.map((entry) => (
                    <tr key={entry.id} className="hover:bg-slate-50/70">
                      <td className="py-2.5 px-6 font-mono tabular-nums text-slate-600">
                        #{entry.rowNumber}
                      </td>
                      <td className="py-2.5 px-4 font-mono font-semibold text-slate-900">
                        {entry.column}
                      </td>
                      <td className="py-2.5 px-4 font-mono text-rose-700">
                        {entry.originalValue}
                      </td>
                      <td className="py-2.5 px-4 font-mono text-emerald-700 font-semibold">
                        {entry.repairedValue}
                      </td>
                      <td className="py-2.5 px-6 text-slate-600">{entry.repairMethod}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto max-h-[420px]">
            <table className="w-full text-left border-collapse text-xs">
              <thead className="sticky top-0 bg-slate-50 z-10">
                <tr className="border-b border-slate-200 text-slate-500 font-medium">
                  <th className="py-2.5 px-4 font-mono w-12">#</th>
                  {columns.map((col) => (
                    <th key={col} className="py-2.5 px-4 font-mono whitespace-nowrap">
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {(viewMode === 'cleaned' ? cleanedRows : session.originalRows)
                  .slice(0, 50)
                  .map((row, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/70">
                      <td className="py-2.5 px-4 font-mono tabular-nums text-slate-400">
                        {idx + 1}
                      </td>
                      {columns.map((col) => {
                        const val = row[col];
                        const missing = isMissingValue(val);
                        return (
                          <td
                            key={col}
                            className={`py-2.5 px-4 font-mono whitespace-nowrap max-w-[200px] truncate ${
                              missing ? 'text-amber-700 italic' : 'text-slate-800'
                            }`}
                          >
                            {missing
                              ? val === '' || val === null || val === undefined
                                ? '(empty)'
                                : String(val)
                              : String(val)}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
