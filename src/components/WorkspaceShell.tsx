import React, { useState } from 'react';
import {
  Activity,
  ArrowLeft,
  CheckCircle2,
  ClipboardList,
  FileSearch,
  LayoutDashboard,
  Menu,
  Play,
  SlidersHorizontal,
  Upload,
  X,
} from 'lucide-react';
import { DatasetSession } from '../engine/types';

export type WorkspaceTab =
  | 'dashboard'
  | 'upload'
  | 'analysis'
  | 'repair'
  | 'validation'
  | 'audit';

interface WorkspaceShellProps {
  activeTab: WorkspaceTab;
  onSelectTab: (tab: WorkspaceTab) => void;
  onBackToLanding: () => void;
  onLoadDemo: () => void;
  session: DatasetSession | null;
  busy: boolean;
  children: React.ReactNode;
}

const NAV_ITEMS: Array<{
  id: WorkspaceTab;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'upload', label: 'Upload & Preview', icon: Upload },
  { id: 'analysis', label: 'Analysis & Diagnosis', icon: FileSearch },
  { id: 'repair', label: 'Repair Preview', icon: SlidersHorizontal },
  { id: 'validation', label: 'Validation & Export', icon: CheckCircle2 },
  { id: 'audit', label: 'Audit Log', icon: ClipboardList },
];

export default function WorkspaceShell({
  activeTab,
  onSelectTab,
  onBackToLanding,
  onLoadDemo,
  session,
  busy,
  children,
}: WorkspaceShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const activeLabel = NAV_ITEMS.find((i) => i.id === activeTab)?.label ?? 'Dashboard';

  const navContent = (
    <div className="flex flex-col h-full">
      <div className="px-5 h-16 border-b border-slate-200 flex items-center justify-between">
        <button
          type="button"
          onClick={onBackToLanding}
          className="font-display text-lg font-bold tracking-tight text-slate-950 cursor-pointer"
        >
          DATAFIX
        </button>
        <button
          type="button"
          aria-label="Close sidebar"
          onClick={() => setSidebarOpen(false)}
          className="lg:hidden p-1.5 rounded-lg text-slate-600 hover:bg-slate-100"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <nav aria-label="Workspace Navigation" className="flex-1 px-3 py-5 space-y-1">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const active = activeTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                onSelectTab(item.id);
                setSidebarOpen(false);
              }}
              className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-lg whitespace-nowrap cursor-pointer ${
                active
                  ? 'bg-slate-950 text-white'
                  : 'text-slate-700 hover:bg-slate-100 hover:text-slate-950'
              }`}
            >
              <Icon className="w-4 h-4 shrink-0" />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Active Dataset Workflow Status */}
      <div className="p-4 border-t border-slate-200 space-y-3">
        {session ? (
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 space-y-1.5 text-xs">
            <div className="font-medium text-slate-500">Active Dataset</div>
            <div className="font-mono font-semibold text-slate-900 truncate">
              {session.meta.fileName}
            </div>
            <div className="text-slate-600 font-mono tabular-nums">
              {session.meta.rowCount} rows · {session.meta.columnCount} cols
            </div>
            <div className="pt-1 flex items-center gap-1.5 text-indigo-900 font-medium">
              <Activity className="w-3.5 h-3.5" />
              <span>
                {session.validation
                  ? `Score: ${session.validation.newScore.toFixed(1)}% (Validated)`
                  : session.initialAnalysis
                    ? `Score: ${session.initialAnalysis.quality.score.toFixed(1)}% (Analyzed)`
                    : 'Ready for Analysis'}
              </span>
            </div>
          </div>
        ) : (
          <div className="text-xs text-slate-500 px-1">
            No active dataset loaded.
          </div>
        )}

        <button
          type="button"
          onClick={onBackToLanding}
          className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-slate-600 hover:text-slate-950 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to Landing Page
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50/40 text-slate-900 flex">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:block w-64 bg-white border-r border-slate-200 shrink-0 sticky top-0 h-screen">
        {navContent}
      </aside>

      {/* Mobile Drawer */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 lg:hidden flex">
          <div
            className="fixed inset-0 bg-slate-900/40"
            onClick={() => setSidebarOpen(false)}
          />
          <aside className="relative w-64 max-w-[80vw] bg-white h-full shadow-xl z-50">
            {navContent}
          </aside>
        </div>
      )}

      {/* Main Column */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Workspace Bar */}
        <header className="sticky top-0 z-20 h-16 bg-white border-b border-slate-200 px-4 sm:px-8 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <button
              type="button"
              aria-label="Open workspace navigation"
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-2 rounded-lg text-slate-700 hover:bg-slate-100 shrink-0"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2 text-sm text-slate-500 min-w-0">
              <span className="hidden sm:inline">Workspace</span>
              <span className="hidden sm:inline" aria-hidden="true">
                /
              </span>
              <span className="font-semibold text-slate-950 truncate">{activeLabel}</span>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={onLoadDemo}
              disabled={busy}
              className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 text-xs font-semibold text-violet-800 bg-violet-50 border border-violet-200 rounded-lg hover:bg-violet-100 transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-60"
            >
              <Play className="w-3.5 h-3.5" />
              <span className="sm:hidden">Demo</span>
              <span className="hidden sm:inline">Load Demo</span>
            </button>
            <button
              type="button"
              onClick={() => onSelectTab('upload')}
              className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 text-xs font-semibold text-white bg-slate-950 rounded-lg hover:bg-indigo-950 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Upload className="w-3.5 h-3.5" />
              <span className="sm:hidden">Upload</span>
              <span className="hidden sm:inline">New Upload</span>
            </button>
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-8 max-w-7xl w-full mx-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
