import React from 'react';
import {
  ArrowRight,
  CheckCircle2,
  Database,
  Play,
  Upload,
} from 'lucide-react';
import { DashboardSummary } from '../engine/types';
import {
  BeforeAfterComparisonChart,
  IssuesByCategoryChart,
  MissingByColumnChart,
  QualityGauge,
} from './DataCharts';

interface DashboardViewProps {
  summary: DashboardSummary | null;
  loading: boolean;
  onGoToUpload: () => void;
  onLoadDemo: () => void;
  onSelectDataset: (id: string) => void;
}

export default function DashboardView({
  summary,
  loading,
  onGoToUpload,
  onLoadDemo,
  onSelectDataset,
}: DashboardViewProps) {
  const totalDatasets = summary?.totalDatasetsProcessed ?? 0;
  const totalIssues = summary?.totalIssuesDetected ?? 0;
  const totalRepaired = summary?.totalIssuesRepaired ?? 0;
  const currentScore = summary?.currentQualityScore;
  const overview = summary?.latestQualityOverview;

  return (
    <div className="space-y-8">
      {/* Header + Quick Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-950">
            Data Quality Dashboard
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            Real-time overview of analyzed datasets, repaired defects, and validation outcomes.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={onLoadDemo}
            disabled={loading}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-slate-900 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-60"
          >
            <Play className="w-4 h-4 text-violet-700" />
            Try Demo
          </button>
          <button
            type="button"
            onClick={onGoToUpload}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-slate-950 rounded-lg hover:bg-indigo-950 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Upload className="w-4 h-4" />
            Upload Dataset
          </button>
        </div>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-1.5">
          <div className="text-xs font-medium text-slate-500">Datasets Processed</div>
          <div className="text-3xl font-bold font-mono tabular-nums text-slate-950">
            {totalDatasets}
          </div>
          <div className="text-xs text-slate-500">Active session workspaces</div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-1.5">
          <div className="text-xs font-medium text-slate-500">Total Issues Detected</div>
          <div className="text-3xl font-bold font-mono tabular-nums text-slate-950">
            {totalIssues}
          </div>
          <div className="text-xs text-slate-500">Across 5 quality categories</div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-1.5">
          <div className="text-xs font-medium text-slate-500">Issues Repaired</div>
          <div className="text-3xl font-bold font-mono tabular-nums text-violet-700">
            {totalRepaired}
          </div>
          <div className="text-xs text-slate-500">Approved & verified edits</div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-1.5">
          <div className="text-xs font-medium text-slate-500">Current Quality Score</div>
          <div className="text-3xl font-bold font-mono tabular-nums text-slate-950">
            {currentScore !== null && currentScore !== undefined
              ? `${currentScore.toFixed(1)}%`
              : '—'}
          </div>
          <div className="text-xs text-slate-500">
            {currentScore !== null && currentScore !== undefined
              ? 'Latest dataset score'
              : 'Analyze a dataset to score'}
          </div>
        </div>
      </div>

      {/* Quality Overview Charts (Real Data Only) */}
      {overview ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-6 space-y-4">
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-display text-base font-semibold text-slate-950">
                Latest Quality Overview
              </h2>
              <span className="text-xs font-mono text-slate-500 truncate max-w-[180px]">
                {overview.datasetName}
              </span>
            </div>
            <QualityGauge score={overview.currentScore} label="Current Score" />
            <div className="pt-3 border-t border-slate-100">
              <BeforeAfterComparisonChart
                originalScore={overview.originalScore}
                newScore={overview.currentScore}
                issuesBefore={overview.beforeIssues}
                issuesAfter={overview.afterIssues}
              />
            </div>
          </div>

          <div className="lg:col-span-4 bg-white border border-slate-200 rounded-xl p-6 space-y-4">
            <h2 className="font-display text-base font-semibold text-slate-950">
              Issues by Category
            </h2>
            <IssuesByCategoryChart data={overview.issuesByCategory} />
          </div>

          <div className="lg:col-span-3 bg-white border border-slate-200 rounded-xl p-6 space-y-4">
            <h2 className="font-display text-base font-semibold text-slate-950">
              Missing by Column
            </h2>
            <MissingByColumnChart data={overview.missingByColumn} />
          </div>
        </div>
      ) : (
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-10 text-center space-y-4">
          <div className="w-12 h-12 rounded-xl bg-white border border-slate-200 mx-auto flex items-center justify-center">
            <Database className="w-6 h-6 text-indigo-900" />
          </div>
          <div className="max-w-md mx-auto space-y-1.5">
            <h2 className="font-display text-lg font-semibold text-slate-950">
              No Analyzed Datasets Yet
            </h2>
            <p className="text-sm text-slate-600">
              Upload a CSV or Excel dataset, or load the 24-record demonstration dataset to inspect
              real quality scores, root-cause diagnostics, and repair charts.
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <button
              type="button"
              onClick={onLoadDemo}
              disabled={loading}
              className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-violet-700 rounded-lg hover:bg-violet-800 transition-colors cursor-pointer disabled:opacity-60"
            >
              <Play className="w-4 h-4" />
              Load Demo Dataset
            </button>
            <button
              type="button"
              onClick={onGoToUpload}
              className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-slate-900 bg-white border border-slate-300 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
            >
              Upload Your File
            </button>
          </div>
        </div>
      )}

      {/* Recent Dataset Activity */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <h2 className="font-display text-base font-semibold text-slate-950">
            Recent Dataset Activity
          </h2>
          <span className="text-xs text-slate-500 font-mono tabular-nums">
            {summary?.recentActivity.length ?? 0} sessions
          </span>
        </div>

        {summary && summary.recentActivity.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-xs font-medium text-slate-500">
                  <th className="py-3 px-6">Dataset</th>
                  <th className="py-3 px-4 text-right">Shape</th>
                  <th className="py-3 px-4 text-right">Detected</th>
                  <th className="py-3 px-4 text-right">Repaired</th>
                  <th className="py-3 px-4 text-right">Quality Score</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-6 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {summary.recentActivity.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/70">
                    <td className="py-3.5 px-6 font-medium text-slate-900">
                      {item.fileName}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono tabular-nums text-xs text-slate-600">
                      {item.rowCount} × {item.columnCount}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono tabular-nums text-slate-700">
                      {item.issuesDetected}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono tabular-nums text-violet-700 font-medium">
                      {item.issuesRepaired}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono tabular-nums text-slate-900">
                      {item.currentScore !== null ? `${item.currentScore.toFixed(1)}%` : '—'}
                    </td>
                    <td className="py-3.5 px-4 text-xs">
                      {item.status === 'repaired_and_validated' ? (
                        <span className="inline-flex items-center gap-1.5 text-emerald-700 font-medium">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Validated
                        </span>
                      ) : item.status === 'analyzed' ? (
                        <span className="text-violet-700 font-medium">Analyzed</span>
                      ) : (
                        <span className="text-slate-600">Uploaded</span>
                      )}
                    </td>
                    <td className="py-3.5 px-6 text-right">
                      <button
                        type="button"
                        onClick={() => onSelectDataset(item.id)}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-900 hover:text-violet-700 cursor-pointer"
                      >
                        Open
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="px-6 py-8 text-sm text-slate-500 text-center">
            No dataset activity recorded in this session yet.
          </div>
        )}
      </div>
    </div>
  );
}
