import React, { useMemo, useState } from 'react';
import { Download, Search } from 'lucide-react';
import { AuditLogEntry } from '../engine/types';

interface AuditLogViewProps {
  logs: AuditLogEntry[];
  activeDatasetId: string | null;
}

export default function AuditLogView({ logs, activeDatasetId }: AuditLogViewProps) {
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<
    'all' | 'approved' | 'rejected' | 'flagged_for_review'
  >('all');

  const filteredLogs = useMemo(() => {
    const q = query.trim().toLowerCase();
    return logs.filter((entry) => {
      if (statusFilter !== 'all' && entry.approvalStatus !== statusFilter) {
        return false;
      }
      if (!q) return true;
      return (
        entry.datasetName.toLowerCase().includes(q) ||
        entry.column.toLowerCase().includes(q) ||
        entry.originalValue.toLowerCase().includes(q) ||
        entry.repairedValue.toLowerCase().includes(q) ||
        entry.repairMethod.toLowerCase().includes(q)
      );
    });
  }, [logs, query, statusFilter]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-950">
            Explainability & Audit Log
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            Complete timestamped modification history across datasets in this session, including
            approved edits, rejected proposals, and preserved flags.
          </p>
        </div>

        {activeDatasetId && logs.length > 0 && (
          <a
            href={`/api/datasets/${encodeURIComponent(activeDatasetId)}/export?format=audit`}
            download
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-slate-900 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0"
          >
            <Download className="w-4 h-4" />
            Export Audit CSV
          </a>
        )}
      </div>

      {/* Filters */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="search"
            aria-label="Search audit log"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filter by column, dataset, value, or method..."
            className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-600"
          />
        </div>

        <div
          role="tablist"
          aria-label="Filter audit status"
          className="flex flex-wrap items-center gap-1 p-1 bg-slate-100 rounded-lg"
        >
          {(
            [
              { id: 'all', label: 'All Events' },
              { id: 'approved', label: 'Approved' },
              { id: 'rejected', label: 'Rejected' },
              { id: 'flagged_for_review', label: 'Flagged' },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={statusFilter === tab.id}
              onClick={() => setStatusFilter(tab.id)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                statusFilter === tab.id
                  ? 'bg-white text-slate-950 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Audit Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        {filteredLogs.length === 0 ? (
          <div className="p-10 text-center text-sm text-slate-500">
            {logs.length === 0
              ? 'No audit events recorded yet. Apply repairs on an analyzed dataset to populate the modification history.'
              : 'No audit events match your current search or filter.'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-slate-500 font-medium">
                  <th className="py-3 px-4">Timestamp</th>
                  <th className="py-3 px-4">Dataset</th>
                  <th className="py-3 px-3">Row</th>
                  <th className="py-3 px-4">Column</th>
                  <th className="py-3 px-4">Original</th>
                  <th className="py-3 px-4">Repaired</th>
                  <th className="py-3 px-4">Method & Reason</th>
                  <th className="py-3 px-3 text-right">Conf.</th>
                  <th className="py-3 px-4">Approval Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredLogs.map((entry) => (
                  <tr key={entry.id} className="hover:bg-slate-50/70 align-top">
                    <td className="py-3 px-4 font-mono tabular-nums text-slate-500 whitespace-nowrap">
                      {new Date(entry.timestamp).toLocaleTimeString()}
                    </td>
                    <td className="py-3 px-4 text-slate-800 font-medium max-w-[140px] truncate">
                      {entry.datasetName}
                    </td>
                    <td className="py-3 px-3 font-mono tabular-nums text-slate-600">
                      #{entry.rowNumber}
                    </td>
                    <td className="py-3 px-4 font-mono font-semibold text-slate-900">
                      {entry.column}
                    </td>
                    <td className="py-3 px-4 font-mono text-rose-700 max-w-[150px] break-all">
                      {entry.originalValue}
                    </td>
                    <td className="py-3 px-4 font-mono text-emerald-700 font-semibold max-w-[150px] break-all">
                      {entry.repairedValue}
                    </td>
                    <td className="py-3 px-4 text-slate-700 max-w-xs">
                      <div className="font-medium text-slate-900">{entry.repairMethod}</div>
                      <div className="text-slate-500 mt-0.5">{entry.reason}</div>
                    </td>
                    <td className="py-3 px-3 text-right font-mono tabular-nums text-slate-800">
                      {entry.confidence}%
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap font-medium">
                      {entry.approvalStatus === 'approved' ? (
                        <span className="text-emerald-700">Approved</span>
                      ) : entry.approvalStatus === 'rejected' ? (
                        <span className="text-rose-700">Rejected</span>
                      ) : (
                        <span className="text-amber-700">Flagged for Review</span>
                      )}
                    </td>
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
