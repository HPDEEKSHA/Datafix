import React, { useEffect, useState } from 'react';
import {
  Check,
  CheckCheck,
  ShieldAlert,
  Sparkles,
  X,
} from 'lucide-react';
import { DatasetSession, RepairProposal } from '../engine/types';

interface RepairPreviewViewProps {
  session: DatasetSession | null;
  applying: boolean;
  onApplyRepairs: (decisions: Record<string, 'approved' | 'rejected'>) => void;
  onGoToAnalysis: () => void;
}

export default function RepairPreviewView({
  session,
  applying,
  onApplyRepairs,
  onGoToAnalysis,
}: RepairPreviewViewProps) {
  const proposals = session?.initialAnalysis?.proposals ?? [];
  const [decisions, setDecisions] = useState<Record<string, 'approved' | 'rejected'>>({});

  useEffect(() => {
    const initial: Record<string, 'approved' | 'rejected'> = {};
    for (const p of proposals) {
      if (p.actionType !== 'flag_for_review') {
        if (p.status === 'applied' || p.status === 'approved') {
          initial[p.id] = 'approved';
        } else if (p.status === 'rejected') {
          initial[p.id] = 'rejected';
        } else {
          // Require explicit approval or bulk "Approve All Safe Repairs", default pending to rejected until approved?
          // Better: pre-select safe proposals as pending-not-yet-approved or let user click "Approve All Safe Repairs" OR pre-stage safe ones as approved while keeping explicit controls!
          // Let's default safeToAutoApply to 'approved' ONLY AFTER user clicks Approve All, OR initialize pending so user explicitly clicks Approve / Approve All Safe Repairs!
          // Wait: let's make safe proposals default to 'pending' (unapproved) or allow 1-click "Approve All Safe Repairs" AND clearly show counts! Even better: let's track 'approved' | 'rejected' | 'pending' in UI so nothing is silently applied unless approved!
        }
      }
    }
    setDecisions(initial);
  }, [session?.meta.id, session?.initialAnalysis?.analyzedAt]);

  if (!session || !session.initialAnalysis) {
    return (
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-10 text-center space-y-4">
        <h2 className="font-display text-lg font-semibold text-slate-950">
          Analysis Required Before Repair Preview
        </h2>
        <p className="text-sm text-slate-600 max-w-md mx-auto">
          Run data quality analysis first to generate repair proposals and inspect confidence
          scores.
        </p>
        <button
          type="button"
          onClick={onGoToAnalysis}
          className="px-5 py-2.5 text-sm font-semibold text-white bg-slate-950 rounded-lg hover:bg-indigo-950 cursor-pointer"
        >
          Go to Analysis
        </button>
      </div>
    );
  }

  const actionableProposals = proposals.filter((p) => p.actionType !== 'flag_for_review');
  const flaggedProposals = proposals.filter((p) => p.actionType === 'flag_for_review');

  const approvedCount = actionableProposals.filter((p) => decisions[p.id] === 'approved').length;
  const rejectedCount = actionableProposals.filter((p) => decisions[p.id] === 'rejected').length;

  const approveAllSafe = () => {
    const next = { ...decisions };
    for (const p of actionableProposals) {
      if (p.safeToAutoApply) {
        next[p.id] = 'approved';
      }
    }
    setDecisions(next);
  };

  const rejectAll = () => {
    const next = { ...decisions };
    for (const p of actionableProposals) {
      next[p.id] = 'rejected';
    }
    setDecisions(next);
  };

  const setOne = (id: string, status: 'approved' | 'rejected') => {
    setDecisions((prev) => ({ ...prev, [id]: status }));
  };

  const handleSubmit = () => {
    const finalDecisions: Record<string, 'approved' | 'rejected'> = {};
    for (const p of actionableProposals) {
      finalDecisions[p.id] = decisions[p.id] === 'approved' ? 'approved' : 'rejected';
    }
    onApplyRepairs(finalDecisions);
  };

  const renderProposalRow = (prop: RepairProposal) => {
    const isFlagged = prop.actionType === 'flag_for_review';
    const currentDecision = decisions[prop.id];

    return (
      <tr key={prop.id} className="hover:bg-slate-50/70 align-top">
        <td className="py-3.5 px-4 font-mono tabular-nums text-xs text-slate-600">
          #{prop.rowNumber}
        </td>
        <td className="py-3.5 px-4 font-mono text-xs font-semibold text-slate-900">
          {prop.column}
        </td>
        <td className="py-3.5 px-4 font-mono text-xs text-rose-700 break-all max-w-[180px]">
          {prop.originalValue}
        </td>
        <td className="py-3.5 px-4 font-mono text-xs max-w-[200px] break-all">
          {prop.proposedValue !== null ? (
            <span className="text-emerald-700 font-semibold">{prop.proposedValue}</span>
          ) : (
            <span className="text-amber-700 font-sans font-medium">
              Preserved (Manual Review)
            </span>
          )}
        </td>
        <td className="py-3.5 px-4 text-xs text-slate-700 max-w-xs">
          <div className="font-medium text-slate-900">{prop.repairMethod}</div>
          <div className="text-slate-600 mt-0.5">{prop.reason}</div>
        </td>
        <td className="py-3.5 px-4 text-right font-mono tabular-nums text-xs font-semibold text-slate-800">
          {prop.confidence}%
        </td>
        <td className="py-3.5 px-4 text-right whitespace-nowrap">
          {isFlagged ? (
            <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-700">
              <ShieldAlert className="w-3.5 h-3.5" />
              Preserved
            </span>
          ) : (
            <div className="inline-flex items-center gap-1 p-0.5 bg-slate-100 rounded-lg">
              <button
                type="button"
                aria-label={`Approve repair for row ${prop.rowNumber} ${prop.column}`}
                onClick={() => setOne(prop.id, 'approved')}
                className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                  currentDecision === 'approved'
                    ? 'bg-emerald-600 text-white'
                    : 'text-slate-700 hover:bg-white'
                }`}
              >
                <Check className="w-3.5 h-3.5" />
                Approve
              </button>
              <button
                type="button"
                aria-label={`Reject repair for row ${prop.rowNumber} ${prop.column}`}
                onClick={() => setOne(prop.id, 'rejected')}
                className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                  currentDecision === 'rejected'
                    ? 'bg-rose-600 text-white'
                    : 'text-slate-700 hover:bg-white'
                }`}
              >
                <X className="w-3.5 h-3.5" />
                Reject
              </button>
            </div>
          )}
        </td>
      </tr>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-950">
            Repair Preview & Human Approval
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            Review every proposed modification before anything is written. Unusual outliers and
            unrecoverable formats are preserved for manual review.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={approveAllSafe}
            disabled={actionableProposals.length === 0 || applying}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-indigo-900 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-50"
          >
            <CheckCheck className="w-4 h-4 text-violet-700" />
            Approve All Safe Repairs
          </button>
          <button
            type="button"
            onClick={rejectAll}
            disabled={actionableProposals.length === 0 || applying}
            className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-50"
          >
            Reject All
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={applying}
            className="inline-flex items-center gap-2 px-5 py-2 text-sm font-semibold text-white bg-slate-950 rounded-lg hover:bg-indigo-950 transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-60"
          >
            <Sparkles className="w-4 h-4" />
            {applying
              ? 'Applying & Revalidating...'
              : `Apply Approved Repairs (${approvedCount})`}
          </button>
        </div>
      </div>

      {/* Summary Strip */}
      <div className="bg-slate-50 border border-slate-200 rounded-xl px-5 py-3.5 flex flex-wrap items-center gap-6 text-xs text-slate-700">
        <div>
          Safe Repair Proposals:{' '}
          <span className="font-mono tabular-nums font-semibold text-slate-950">
            {actionableProposals.length}
          </span>
        </div>
        <div>
          Approved:{' '}
          <span className="font-mono tabular-nums font-semibold text-emerald-700">
            {approvedCount}
          </span>
        </div>
        <div>
          Rejected / Skipped:{' '}
          <span className="font-mono tabular-nums font-semibold text-rose-700">
            {rejectedCount}
          </span>
        </div>
        <div>
          Preserved for Human Review:{' '}
          <span className="font-mono tabular-nums font-semibold text-amber-700">
            {flaggedProposals.length}
          </span>
        </div>
      </div>

      {/* Actionable Repairs Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <h2 className="font-display text-base font-semibold text-slate-950">
            Proposed Safe Repairs ({actionableProposals.length})
          </h2>
          <span className="text-xs text-slate-500">
            Only approved items are applied to the working copy
          </span>
        </div>

        {actionableProposals.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-600">
            No automatic repair proposals available for this dataset.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-xs font-medium text-slate-500">
                  <th className="py-3 px-4">Row</th>
                  <th className="py-3 px-4">Column</th>
                  <th className="py-3 px-4">Original Value</th>
                  <th className="py-3 px-4">Proposed Value</th>
                  <th className="py-3 px-4">Method & Reason</th>
                  <th className="py-3 px-4 text-right">Confidence</th>
                  <th className="py-3 px-4 text-right">Decision</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {actionableProposals.map(renderProposalRow)}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Preserved / Flagged Table */}
      {flaggedProposals.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
            <h2 className="font-display text-base font-semibold text-slate-950">
              Flagged for Human Investigation ({flaggedProposals.length})
            </h2>
            <span className="text-xs text-amber-700 font-medium">
              Never auto-deleted or fabricated
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-xs font-medium text-slate-500">
                  <th className="py-3 px-4">Row</th>
                  <th className="py-3 px-4">Column</th>
                  <th className="py-3 px-4">Original Value</th>
                  <th className="py-3 px-4">Handling</th>
                  <th className="py-3 px-4">Method & Reason</th>
                  <th className="py-3 px-4 text-right">Confidence</th>
                  <th className="py-3 px-4 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {flaggedProposals.map(renderProposalRow)}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
