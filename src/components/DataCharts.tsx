import React from 'react';
import {
  CategoryCount,
  ColumnMissingCount,
  QualityScoreBreakdown,
} from '../engine/types';

export function QualityGauge({
  score,
  label = 'Quality Score',
  breakdown,
}: {
  score: number;
  label?: string;
  breakdown?: QualityScoreBreakdown;
}) {
  const clamped = Math.max(0, Math.min(100, score));
  const radius = 52;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (clamped / 100) * circumference;

  const strokeColor =
    clamped >= 90 ? '#16A34A' : clamped >= 75 ? '#6D28D9' : '#D97706';

  return (
    <div className="flex flex-col sm:flex-row items-center gap-6">
      <div className="relative w-36 h-36 shrink-0 flex items-center justify-center">
        <svg className="w-36 h-36 -rotate-90" viewBox="0 0 128 128" aria-label={`${label}: ${clamped} percent`}>
          <circle
            cx="64"
            cy="64"
            r={radius}
            fill="none"
            stroke="#E2E8F0"
            strokeWidth="10"
          />
          <circle
            cx="64"
            cy="64"
            r={radius}
            fill="none"
            stroke={strokeColor}
            strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className="text-2xl font-bold font-mono tabular-nums text-slate-900">
            {clamped.toFixed(1)}%
          </span>
          <span className="text-xs text-slate-500 mt-0.5">{label}</span>
        </div>
      </div>

      {breakdown && (
        <div className="grid grid-cols-2 gap-x-6 gap-y-3 flex-1 w-full">
          <div>
            <div className="text-xs text-slate-500">Completeness</div>
            <div className="text-base font-semibold font-mono tabular-nums text-slate-900">
              {breakdown.completenessRate}%
            </div>
          </div>
          <div>
            <div className="text-xs text-slate-500">Format Validity</div>
            <div className="text-base font-semibold font-mono tabular-nums text-slate-900">
              {breakdown.validityRate}%
            </div>
          </div>
          <div>
            <div className="text-xs text-slate-500">Consistency</div>
            <div className="text-base font-semibold font-mono tabular-nums text-slate-900">
              {breakdown.consistencyRate}%
            </div>
          </div>
          <div>
            <div className="text-xs text-slate-500">Uniqueness</div>
            <div className="text-base font-semibold font-mono tabular-nums text-slate-900">
              {breakdown.uniquenessRate}%
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const CATEGORY_COLORS: Record<string, string> = {
  missing_value: '#1E3A8A',
  duplicate_record: '#6D28D9',
  invalid_format: '#DC2626',
  inconsistent_entry: '#D97706',
  anomaly: '#475569',
};

export function IssuesByCategoryChart({ data }: { data: CategoryCount[] }) {
  const maxVal = Math.max(1, ...data.map((d) => d.count));

  return (
    <div className="space-y-3" data-testid="issues-by-category-chart">
      {data.map((item) => {
        const pct = Math.round((item.count / maxVal) * 100);
        const color = CATEGORY_COLORS[item.category] ?? '#1E3A8A';
        return (
          <div key={item.category} className="space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium text-slate-700">{item.label}</span>
              <span className="font-mono tabular-nums text-slate-900 font-semibold">
                {item.count}
              </span>
            </div>
            <div className="h-2.5 w-full bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-300"
                style={{ width: `${item.count === 0 ? 0 : Math.max(4, pct)}%`, backgroundColor: color }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function MissingByColumnChart({ data }: { data: ColumnMissingCount[] }) {
  const withMissing = data.filter((d) => d.missingCount > 0);
  const display = withMissing.length > 0 ? withMissing : data.slice(0, 6);
  const maxVal = Math.max(1, ...display.map((d) => d.missingCount));

  return (
    <div className="space-y-3" data-testid="missing-by-column-chart">
      {display.map((item) => {
        const pct = Math.round((item.missingCount / maxVal) * 100);
        return (
          <div key={item.column} className="space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="font-mono text-slate-700 truncate max-w-[200px]">
                {item.column}
              </span>
              <span className="font-mono tabular-nums text-slate-900 font-medium">
                {item.missingCount} / {item.totalRows}
              </span>
            </div>
            <div className="h-2.5 w-full bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full bg-indigo-900 transition-all duration-300"
                style={{ width: `${item.missingCount === 0 ? 0 : Math.max(5, pct)}%` }}
              />
            </div>
          </div>
        );
      })}
      {withMissing.length === 0 && (
        <p className="text-xs text-emerald-700 font-medium pt-1">
          Zero missing values detected across all columns.
        </p>
      )}
    </div>
  );
}

export function BeforeAfterComparisonChart({
  originalScore,
  newScore,
  issuesBefore,
  issuesAfter,
}: {
  originalScore: number;
  newScore: number;
  issuesBefore: number;
  issuesAfter: number;
}) {
  const maxIssues = Math.max(1, issuesBefore, issuesAfter);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6" data-testid="before-after-chart">
      <div className="space-y-3">
        <div className="text-xs font-medium text-slate-600">Quality Score Progression (%)</div>
        <div className="space-y-2.5">
          <div>
            <div className="flex justify-between text-xs mb-1">
              <span className="text-slate-600">Before Repair</span>
              <span className="font-mono tabular-nums font-semibold text-slate-800">
                {originalScore.toFixed(1)}%
              </span>
            </div>
            <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-slate-500 rounded-full"
                style={{ width: `${Math.max(2, originalScore)}%` }}
              />
            </div>
          </div>
          <div>
            <div className="flex justify-between text-xs mb-1">
              <span className="text-slate-900 font-medium">After Validation</span>
              <span className="font-mono tabular-nums font-semibold text-violet-700">
                {newScore.toFixed(1)}%
              </span>
            </div>
            <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-violet-700 rounded-full"
                style={{ width: `${Math.max(2, newScore)}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <div className="text-xs font-medium text-slate-600">Detected Issues Count</div>
        <div className="space-y-2.5">
          <div>
            <div className="flex justify-between text-xs mb-1">
              <span className="text-slate-600">Initial Scan</span>
              <span className="font-mono tabular-nums font-semibold text-slate-800">
                {issuesBefore} issues
              </span>
            </div>
            <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-amber-600 rounded-full"
                style={{ width: `${Math.max(4, (issuesBefore / maxIssues) * 100)}%` }}
              />
            </div>
          </div>
          <div>
            <div className="flex justify-between text-xs mb-1">
              <span className="text-slate-900 font-medium">Post-Repair Scan</span>
              <span className="font-mono tabular-nums font-semibold text-emerald-700">
                {issuesAfter} unresolved
              </span>
            </div>
            <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-emerald-600 rounded-full"
                style={{
                  width: `${issuesAfter === 0 ? 0 : Math.max(4, (issuesAfter / maxIssues) * 100)}%`,
                }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
