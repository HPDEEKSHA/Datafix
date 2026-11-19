import React, { useCallback, useEffect, useState } from 'react';
import {
  AuditLogEntry,
  DashboardSummary,
  DatasetSession,
  RepairStrategyConfig,
} from './engine/types';
import AnalysisView from './components/AnalysisView';
import AuditLogView from './components/AuditLogView';
import DashboardView from './components/DashboardView';
import LandingPage from './components/LandingPage';
import RepairPreviewView from './components/RepairPreviewView';
import UploadView from './components/UploadView';
import ValidationExportView from './components/ValidationExportView';
import WorkspaceShell, { WorkspaceTab } from './components/WorkspaceShell';

export default function App() {
  const [viewMode, setViewMode] = useState<'landing' | 'workspace'>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('autostart') === '1') {
        return 'workspace';
      }
    }
    return 'landing';
  });
  const [activeTab, setActiveTab] = useState<WorkspaceTab>('dashboard');

  const [dashboardSummary, setDashboardSummary] = useState<DashboardSummary | null>(null);
  const [session, setSession] = useState<DatasetSession | null>(null);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);

  const [loadingDashboard, setLoadingDashboard] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [applyingRepairs, setApplyingRepairs] = useState(false);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);

  const refreshGlobalData = useCallback(async () => {
    setLoadingDashboard(true);
    try {
      const [dashRes, auditRes] = await Promise.all([
        fetch('/api/dashboard'),
        fetch('/api/audit-logs'),
      ]);
      if (dashRes.ok) {
        const dashJson = (await dashRes.json()) as DashboardSummary;
        setDashboardSummary(dashJson);
      }
      if (auditRes.ok) {
        const auditJson = (await auditRes.json()) as { logs: AuditLogEntry[] };
        setAuditLogs(auditJson.logs);
      }
    } catch {
      // Non-fatal background refresh error
    } finally {
      setLoadingDashboard(false);
    }
  }, []);

  useEffect(() => {
    if (viewMode === 'workspace') {
      refreshGlobalData();
    }
  }, [viewMode, refreshGlobalData]);

  const handleLoadDemo = async (navigateTo: WorkspaceTab = 'upload') => {
    setErrorBanner(null);
    setUploading(true);
    try {
      const res = await fetch('/api/datasets/demo', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to load demo dataset.');
      }
      setSession(data as DatasetSession);
      setViewMode('workspace');
      setActiveTab(navigateTo);
      await refreshGlobalData();
    } catch (err) {
      setErrorBanner(err instanceof Error ? err.message : 'Failed to load demo dataset.');
    } finally {
      setUploading(false);
    }
  };

  const handleUploadFile = async (file: File) => {
    setErrorBanner(null);
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch('/api/datasets/upload', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Upload failed.');
      }
      setSession(data as DatasetSession);
      setActiveTab('upload');
      await refreshGlobalData();
    } catch (err) {
      setErrorBanner(err instanceof Error ? err.message : 'Failed to upload dataset.');
    } finally {
      setUploading(false);
    }
  };

  const handleAnalyzeDataset = async (strategy?: RepairStrategyConfig) => {
    if (!session) return;
    setErrorBanner(null);
    setAnalyzing(true);
    try {
      const res = await fetch(
        `/api/datasets/${encodeURIComponent(session.meta.id)}/analyze`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ strategy: strategy ?? session.strategy }),
        }
      );
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Analysis failed.');
      }
      setSession(data as DatasetSession);
      setActiveTab('analysis');
      await refreshGlobalData();
    } catch (err) {
      setErrorBanner(err instanceof Error ? err.message : 'Dataset analysis failed.');
    } finally {
      setAnalyzing(false);
    }
  };

  const handleApplyRepairs = async (
    decisions: Record<string, 'approved' | 'rejected'>
  ) => {
    if (!session) return;
    setErrorBanner(null);
    setApplyingRepairs(true);
    try {
      const res = await fetch(
        `/api/datasets/${encodeURIComponent(session.meta.id)}/repair`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ decisions }),
        }
      );
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Repair execution failed.');
      }
      setSession(data as DatasetSession);
      setActiveTab('validation');
      await refreshGlobalData();
    } catch (err) {
      setErrorBanner(err instanceof Error ? err.message : 'Failed to apply repairs.');
    } finally {
      setApplyingRepairs(false);
    }
  };

  const handleSelectDatasetFromDashboard = async (id: string) => {
    setErrorBanner(null);
    try {
      const res = await fetch(`/api/datasets/${encodeURIComponent(id)}`);
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to load dataset.');
      }
      const loaded = data as DatasetSession;
      setSession(loaded);
      if (loaded.validation) {
        setActiveTab('validation');
      } else if (loaded.initialAnalysis) {
        setActiveTab('analysis');
      } else {
        setActiveTab('upload');
      }
    } catch (err) {
      setErrorBanner(err instanceof Error ? err.message : 'Unable to open dataset.');
    }
  };

  if (viewMode === 'landing') {
    return (
      <LandingPage
        onGetStarted={() => {
          setViewMode('workspace');
          setActiveTab('dashboard');
        }}
        onExploreDemo={() => handleLoadDemo('upload')}
        demoLoading={uploading}
      />
    );
  }

  return (
    <WorkspaceShell
      activeTab={activeTab}
      onSelectTab={(tab) => {
        setErrorBanner(null);
        setActiveTab(tab);
      }}
      onBackToLanding={() => setViewMode('landing')}
      onLoadDemo={() => handleLoadDemo('upload')}
      session={session}
      busy={uploading || analyzing || applyingRepairs}
    >
      {errorBanner && activeTab !== 'upload' && (
        <div
          role="alert"
          className="mb-6 p-4 rounded-xl border border-rose-200 bg-rose-50 text-rose-900 text-sm"
        >
          {errorBanner}
        </div>
      )}

      {activeTab === 'dashboard' && (
        <DashboardView
          summary={dashboardSummary}
          loading={loadingDashboard || uploading}
          onGoToUpload={() => setActiveTab('upload')}
          onLoadDemo={() => handleLoadDemo('upload')}
          onSelectDataset={handleSelectDatasetFromDashboard}
        />
      )}

      {activeTab === 'upload' && (
        <UploadView
          session={session}
          uploading={uploading}
          analyzing={analyzing}
          error={errorBanner}
          onUploadFile={handleUploadFile}
          onLoadDemo={() => handleLoadDemo('upload')}
          onRunAnalysis={() => handleAnalyzeDataset()}
        />
      )}

      {activeTab === 'analysis' && (
        <AnalysisView
          session={session}
          analyzing={analyzing}
          onReanalyze={(strategy) => handleAnalyzeDataset(strategy)}
          onGoToRepairPreview={() => setActiveTab('repair')}
          onGoToUpload={() => setActiveTab('upload')}
        />
      )}

      {activeTab === 'repair' && (
        <RepairPreviewView
          session={session}
          applying={applyingRepairs}
          onApplyRepairs={handleApplyRepairs}
          onGoToAnalysis={() => setActiveTab('analysis')}
        />
      )}

      {activeTab === 'validation' && (
        <ValidationExportView
          session={session}
          onGoToRepairPreview={() => setActiveTab('repair')}
          onGoToAuditLog={() => setActiveTab('audit')}
        />
      )}

      {activeTab === 'audit' && (
        <AuditLogView
          logs={auditLogs}
          activeDatasetId={session?.meta.id ?? null}
        />
      )}
    </WorkspaceShell>
  );
}
