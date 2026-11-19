import React, { useRef, useState } from 'react';
import {
  AlertCircle,
  ArrowRight,
  FileSpreadsheet,
  Play,
  UploadCloud,
} from 'lucide-react';
import { isMissingValue } from '../engine/parser';
import { DatasetSession } from '../engine/types';

interface UploadViewProps {
  session: DatasetSession | null;
  uploading: boolean;
  analyzing: boolean;
  error: string | null;
  onUploadFile: (file: File) => void;
  onLoadDemo: () => void;
  onRunAnalysis: () => void;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export default function UploadView({
  session,
  uploading,
  analyzing,
  error,
  onUploadFile,
  onLoadDemo,
  onRunAnalysis,
}: UploadViewProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [dragging, setDragging] = useState(false);
  const [page, setPage] = useState(0);
  const pageSize = 15;

  const handleFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setPage(0);
    onUploadFile(files[0]);
  };

  const rows = session?.originalRows ?? [];
  const columns = session?.meta.columns ?? [];
  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  const safePage = Math.min(page, totalPages - 1);
  const visibleRows = rows.slice(safePage * pageSize, (safePage + 1) * pageSize);

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-950">
            Dataset Upload & Preview
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            Upload a CSV, XLSX, or XLS dataset or load the 24-record sample dataset to inspect
            schema profiles and raw rows.
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            setPage(0);
            onLoadDemo();
          }}
          disabled={uploading || analyzing}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-violet-700 rounded-lg hover:bg-violet-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-60"
        >
          <Play className="w-4 h-4" />
          {uploading ? 'Loading...' : 'Load Demo Dataset'}
        </button>
      </div>

      {/* Dropzone */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          handleFiles(e.dataTransfer.files);
        }}
        className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors ${
          dragging
            ? 'border-violet-600 bg-violet-50/40'
            : 'border-slate-300 bg-slate-50/50 hover:border-slate-400'
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".csv,.xlsx,.xls"
          aria-label="Upload CSV, XLSX, or XLS dataset file"
          onChange={(e) => {
            handleFiles(e.target.files);
            e.target.value = '';
          }}
          className="sr-only"
        />
        <div className="w-12 h-12 rounded-xl bg-white border border-slate-200 mx-auto flex items-center justify-center mb-4">
          <UploadCloud className="w-6 h-6 text-indigo-900" />
        </div>
        <h2 className="font-display text-base font-semibold text-slate-950">
          {uploading ? 'Parsing dataset...' : 'Drag and drop your dataset file here'}
        </h2>
        <p className="text-sm text-slate-600 mt-1">
          Supports CSV (.csv) and Excel (.xlsx, .xls) files up to 20 MB.
        </p>
        <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            className="px-4 py-2 text-sm font-semibold text-slate-900 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer disabled:opacity-60"
          >
            Select File from Computer
          </button>
        </div>
      </div>

      {error && (
        <div
          role="alert"
          className="flex items-start gap-3 p-4 rounded-xl border border-rose-200 bg-rose-50 text-rose-900 text-sm"
        >
          <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
          <div>
            <div className="font-semibold">Unable to process file</div>
            <div className="text-rose-800 mt-0.5">{error}</div>
          </div>
        </div>
      )}

      {/* Loaded Dataset Summary + Schema + Preview */}
      {session && (
        <div className="space-y-6">
          {/* Metadata strip */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
                <FileSpreadsheet className="w-5 h-5 text-indigo-900" />
              </div>
              <div>
                <div className="font-display text-base font-semibold text-slate-950">
                  {session.meta.fileName}
                </div>
                <div className="text-xs text-slate-600 mt-0.5 flex flex-wrap items-center gap-2 font-mono tabular-nums">
                  <span>{session.meta.fileFormat.toUpperCase()}</span>
                  <span aria-hidden="true">·</span>
                  <span>{formatBytes(session.meta.fileSizeBytes)}</span>
                  <span aria-hidden="true">·</span>
                  <span>{session.meta.rowCount} rows</span>
                  <span aria-hidden="true">·</span>
                  <span>{session.meta.columnCount} columns</span>
                  {session.meta.isDemo && (
                    <>
                      <span aria-hidden="true">·</span>
                      <span className="text-violet-700 font-sans font-medium">
                        Built-in Demo Sample
                      </span>
                    </>
                  )}
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={onRunAnalysis}
              disabled={analyzing}
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-slate-950 rounded-lg hover:bg-indigo-950 transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-60"
            >
              {analyzing ? 'Analyzing Dataset...' : 'Analyze Dataset'}
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>

          {/* Column Schema Table */}
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <h2 className="font-display text-base font-semibold text-slate-950">
                Detected Columns & Inferred Data Types
              </h2>
              <span className="text-xs text-slate-500 font-mono tabular-nums">
                {session.meta.profiles.length} columns
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-xs font-medium text-slate-500">
                    <th className="py-2.5 px-6">Column Name</th>
                    <th className="py-2.5 px-4">Inferred Type</th>
                    <th className="py-2.5 px-4 text-right">Non-Empty</th>
                    <th className="py-2.5 px-4 text-right">Missing</th>
                    <th className="py-2.5 px-4 text-right">Unique</th>
                    <th className="py-2.5 px-6">Sample Values</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {session.meta.profiles.map((prof) => (
                    <tr key={prof.name} className="hover:bg-slate-50/70">
                      <td className="py-2.5 px-6 font-mono text-xs font-semibold text-slate-900">
                        {prof.name}
                      </td>
                      <td className="py-2.5 px-4 text-xs text-indigo-900 font-medium capitalize">
                        {prof.inferredType}
                      </td>
                      <td className="py-2.5 px-4 text-right font-mono tabular-nums text-xs text-slate-700">
                        {prof.nonEmptyCount}
                      </td>
                      <td
                        className={`py-2.5 px-4 text-right font-mono tabular-nums text-xs ${
                          prof.missingCount > 0 ? 'text-amber-700 font-semibold' : 'text-slate-500'
                        }`}
                      >
                        {prof.missingCount}
                      </td>
                      <td className="py-2.5 px-4 text-right font-mono tabular-nums text-xs text-slate-700">
                        {prof.uniqueCount}
                      </td>
                      <td className="py-2.5 px-6 text-xs text-slate-600 font-mono truncate max-w-xs">
                        {prof.sampleValues.join(', ') || '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Dataset Preview Table */}
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <h2 className="font-display text-base font-semibold text-slate-950">
                Raw Dataset Preview (Original Preserved)
              </h2>
              <div className="flex items-center gap-3 text-xs text-slate-600">
                <span className="font-mono tabular-nums">
                  Showing rows {safePage * pageSize + 1}–
                  {Math.min((safePage + 1) * pageSize, rows.length)} of {rows.length}
                </span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    disabled={safePage === 0}
                    onClick={() => setPage((p) => Math.max(0, p - 1))}
                    className="px-2.5 py-1 border border-slate-200 rounded hover:bg-slate-50 disabled:opacity-40 cursor-pointer"
                  >
                    Prev
                  </button>
                  <button
                    type="button"
                    disabled={safePage >= totalPages - 1}
                    onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                    className="px-2.5 py-1 border border-slate-200 rounded hover:bg-slate-50 disabled:opacity-40 cursor-pointer"
                  >
                    Next
                  </button>
                </div>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 font-medium text-slate-500">
                    <th className="py-2.5 px-4 font-mono w-12">#</th>
                    {columns.map((col) => (
                      <th key={col} className="py-2.5 px-4 font-mono whitespace-nowrap">
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {visibleRows.map((row, idx) => {
                    const rowNum = safePage * pageSize + idx + 1;
                    return (
                      <tr key={rowNum} className="hover:bg-slate-50/70">
                        <td className="py-2.5 px-4 font-mono tabular-nums text-slate-400">
                          {rowNum}
                        </td>
                        {columns.map((col) => {
                          const val = row[col];
                          const missing = isMissingValue(val);
                          return (
                            <td
                              key={col}
                              className={`py-2.5 px-4 font-mono whitespace-nowrap max-w-[220px] truncate ${
                                missing ? 'text-amber-700 bg-amber-50/50 italic' : 'text-slate-800'
                              }`}
                              title={val === null || val === undefined ? '' : String(val)}
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
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
