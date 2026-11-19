import React, { useState } from 'react';
import {
  ArrowRight,
  CheckCircle2,
  Database,
  FileSpreadsheet,
  Menu,
  ShieldCheck,
  X,
} from 'lucide-react';

interface LandingPageProps {
  onGetStarted: () => void;
  onExploreDemo: () => void;
  demoLoading: boolean;
}

const CAPABILITIES = [
  {
    num: '01',
    title: 'Detect',
    desc: 'Scan every column and row for missing values, duplicate records, malformed emails, dates, numbers, formatting drift, and statistical IQR outliers.',
  },
  {
    num: '02',
    title: 'Diagnose',
    desc: 'Pair deterministic schema profiling with Gemini-assisted root cause analysis to explain why defects occurred and how columns relate.',
  },
  {
    num: '03',
    title: 'Repair',
    desc: 'Generate safe, reversible repair proposals—whitespace trimming, ISO date standardization, deduplication, and configurable median, mean, or mode imputation.',
  },
  {
    num: '04',
    title: 'Validate',
    desc: 'Re-run full quality checks independently after repairs are applied to measure actual score improvement and flag remaining unresolved anomalies.',
  },
  {
    num: '05',
    title: 'Explain',
    desc: 'Every proposed modification exposes the original value, proposed value, repair method, confidence score, and plain-language rationale before any edit occurs.',
  },
  {
    num: '06',
    title: 'Track',
    desc: 'Record an immutable session audit log with timestamps, approval status, and before-and-after comparisons ready for export.',
  },
];

const WORKFLOW_STEPS = [
  {
    step: 'Step 1',
    title: 'Upload or Load Demo Dataset',
    detail: 'Drop a CSV, XLSX, or XLS file, or load the built-in 24-record customer sample to inspect column types immediately.',
  },
  {
    step: 'Step 2',
    title: 'Analyze & Diagnose Root Causes',
    detail: 'Run deterministic checks across five defect classes enriched with Gemini natural-language root cause explanations.',
  },
  {
    step: 'Step 3',
    title: 'Review & Approve Safe Repairs',
    detail: 'Inspect proposed edits row by row, choose imputation strategies, approve safe fixes, and preserve flagged outliers.',
  },
  {
    step: 'Step 4',
    title: 'Revalidate & Export Clean Data',
    detail: 'Verify post-repair quality scores independently and download cleaned CSV, Excel, quality report, and audit logs.',
  },
];

export default function LandingPage({
  onGetStarted,
  onExploreDemo,
  demoLoading,
}: LandingPageProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [imgError, setImgError] = useState(false);

  return (
    <div className="min-h-screen bg-white text-slate-900 flex flex-col">
      {/* Top Bar Contract: 3 zones separated by gap-8 */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between gap-8">
          <a
            href="#home"
            className="font-display text-lg font-bold tracking-tight text-slate-950 whitespace-nowrap shrink-0"
          >
            DATAFIX
          </a>

          <nav
            aria-label="Primary Navigation"
            className="hidden md:flex items-center gap-7 text-sm font-medium text-slate-600"
          >
            <a
              href="#home"
              className="hover:text-slate-950 transition-colors whitespace-nowrap shrink-0"
            >
              Home
            </a>
            <a
              href="#features"
              className="hover:text-slate-950 transition-colors whitespace-nowrap shrink-0"
            >
              Features
            </a>
            <a
              href="#how-it-works"
              className="hover:text-slate-950 transition-colors whitespace-nowrap shrink-0"
            >
              How It Works
            </a>
            <a
              href="#about"
              className="hover:text-slate-950 transition-colors whitespace-nowrap shrink-0"
            >
              About
            </a>
          </nav>

          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={onGetStarted}
              className="hidden sm:inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-slate-950 rounded-lg hover:bg-indigo-950 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              Get Started
            </button>
            <button
              type="button"
              aria-label={mobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
              onClick={() => setMobileMenuOpen((v) => !v)}
              className="md:hidden p-2 rounded-lg text-slate-700 hover:bg-slate-100"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {mobileMenuOpen && (
          <div className="md:hidden border-t border-slate-200 bg-white px-6 py-4 space-y-3">
            <a
              href="#home"
              onClick={() => setMobileMenuOpen(false)}
              className="block text-sm font-medium text-slate-700 py-1.5"
            >
              Home
            </a>
            <a
              href="#features"
              onClick={() => setMobileMenuOpen(false)}
              className="block text-sm font-medium text-slate-700 py-1.5"
            >
              Features
            </a>
            <a
              href="#how-it-works"
              onClick={() => setMobileMenuOpen(false)}
              className="block text-sm font-medium text-slate-700 py-1.5"
            >
              How It Works
            </a>
            <a
              href="#about"
              onClick={() => setMobileMenuOpen(false)}
              className="block text-sm font-medium text-slate-700 py-1.5"
            >
              About
            </a>
            <button
              type="button"
              onClick={() => {
                setMobileMenuOpen(false);
                onGetStarted();
              }}
              className="w-full py-2.5 px-4 text-sm font-semibold text-white bg-slate-950 rounded-lg"
            >
              Get Started
            </button>
          </div>
        )}
      </header>

      <main className="flex-1">
        {/* Hero Section */}
        <section id="home" className="border-b border-slate-200 bg-slate-50/50">
          <div className="max-w-7xl mx-auto px-6 py-16 lg:py-24 grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            <div className="lg:col-span-6 space-y-6">
              <p className="text-sm font-medium text-violet-700 tracking-wide">
                Upload. Detect. Understand. Repair. Verify.
              </p>
              <h1 className="font-display text-4xl sm:text-5xl font-bold tracking-tight text-slate-950 leading-[1.12] [text-wrap:balance]">
                Make Your Data Clean, Accurate and Intelligent.
              </h1>
              <p className="text-base sm:text-lg text-slate-600 leading-relaxed max-w-xl">
                DATAFIX is an autonomous data quality and repair platform for data engineers and
                analysts. Detect defects across spreadsheets, diagnose root causes with AI, approve
                safe repairs, and verify every change with an auditable score.
              </p>

              <div className="flex flex-wrap items-center gap-4 pt-2">
                <button
                  type="button"
                  onClick={onGetStarted}
                  className="inline-flex items-center gap-2 px-6 py-3 text-sm font-semibold text-white bg-slate-950 rounded-lg hover:bg-indigo-950 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  Get Started
                  <ArrowRight className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={onExploreDemo}
                  disabled={demoLoading}
                  className="inline-flex items-center gap-2 px-6 py-3 text-sm font-semibold text-slate-900 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-60"
                >
                  {demoLoading ? 'Loading Demo...' : 'Explore Demo'}
                </button>
              </div>

              <div className="pt-4 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-slate-500">
                <span className="whitespace-nowrap">Formats: CSV, XLSX, XLS</span>
                <span aria-hidden="true">·</span>
                <span className="whitespace-nowrap">Human-approved repairs</span>
                <span aria-hidden="true">·</span>
                <span className="whitespace-nowrap">Independent revalidation</span>
              </div>
            </div>

            {/* Right Focal Carrier: Interactive-style Deterministic Pipeline Proof Card */}
            <div className="lg:col-span-6">
              <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                    <Database className="w-4 h-4 text-violet-700" />
                    <span>Sample Pipeline Inspection</span>
                  </div>
                  <span className="text-xs font-mono text-slate-500">24 rows · 9 columns</span>
                </div>

                <div className="divide-y divide-slate-100 text-xs">
                  <div className="px-5 py-3.5 grid grid-cols-12 gap-2 items-center bg-slate-50/70 font-medium text-slate-500">
                    <div className="col-span-2">Row</div>
                    <div className="col-span-3">Column</div>
                    <div className="col-span-3">Detected</div>
                    <div className="col-span-4">Verified Action</div>
                  </div>

                  <div className="px-5 py-3.5 grid grid-cols-12 gap-2 items-center">
                    <div className="col-span-2 font-mono tabular-nums text-slate-600">#02</div>
                    <div className="col-span-3 font-mono text-slate-800">signup_date</div>
                    <div className="col-span-3 font-mono text-amber-700 truncate">02/18/2025</div>
                    <div className="col-span-4 font-mono text-emerald-700 font-medium">
                      2025-02-18 (ISO)
                    </div>
                  </div>

                  <div className="px-5 py-3.5 grid grid-cols-12 gap-2 items-center">
                    <div className="col-span-2 font-mono tabular-nums text-slate-600">#04</div>
                    <div className="col-span-3 font-mono text-slate-800">annual_spend</div>
                    <div className="col-span-3 font-mono text-rose-700 truncate">$7,200.00</div>
                    <div className="col-span-4 font-mono text-emerald-700 font-medium">
                      7200 (Numeric)
                    </div>
                  </div>

                  <div className="px-5 py-3.5 grid grid-cols-12 gap-2 items-center">
                    <div className="col-span-2 font-mono tabular-nums text-slate-600">#11</div>
                    <div className="col-span-3 font-mono text-slate-800">annual_spend</div>
                    <div className="col-span-3 font-mono text-amber-700">985000</div>
                    <div className="col-span-4 text-slate-700 font-medium">
                      IQR Outlier · Preserved
                    </div>
                  </div>

                  <div className="px-5 py-3.5 grid grid-cols-12 gap-2 items-center">
                    <div className="col-span-2 font-mono tabular-nums text-slate-600">#18</div>
                    <div className="col-span-3 font-mono text-slate-800">All Columns</div>
                    <div className="col-span-3 text-violet-700">Exact duplicate</div>
                    <div className="col-span-4 text-emerald-700 font-medium">
                      Remove (Keep #05)
                    </div>
                  </div>
                </div>

                <div className="px-5 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs">
                  <span className="text-slate-600">
                    Integrity Rule: No silent overwrites without approval
                  </span>
                  <button
                    type="button"
                    onClick={onExploreDemo}
                    disabled={demoLoading}
                    className="font-semibold text-violet-700 hover:text-violet-900 cursor-pointer"
                  >
                    Run Live Demo →
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Six Capabilities & Supported Formats */}
        <section id="features" className="max-w-7xl mx-auto px-6 py-20">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
            <div className="max-w-2xl space-y-3">
              <h2 className="font-display text-3xl font-bold tracking-tight text-slate-950">
                Six Verified Capabilities for Data Integrity
              </h2>
              <p className="text-base text-slate-600">
                Every stage combines deterministic validation rules with optional AI root-cause
                explanations—never trusting unverified model guesses with raw records.
              </p>
            </div>
            <div className="flex items-center gap-3 text-sm text-slate-700 bg-slate-50 border border-slate-200 rounded-lg px-4 py-2.5 shrink-0">
              <FileSpreadsheet className="w-4 h-4 text-indigo-900" />
              <span className="font-medium">Supported Formats: CSV, XLSX, XLS</span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {CAPABILITIES.map((cap) => (
              <div
                key={cap.num}
                className="bg-white border border-slate-200 rounded-xl p-6 space-y-3 hover:border-slate-300 transition-colors"
              >
                <div className="text-xs font-mono font-semibold text-violet-700">
                  {cap.num}. {cap.title}
                </div>
                <h3 className="font-display text-lg font-semibold text-slate-950">
                  {cap.title}
                </h3>
                <p className="text-sm text-slate-600 leading-relaxed">{cap.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* How It Works */}
        <section id="how-it-works" className="border-y border-slate-200 bg-slate-50/60">
          <div className="max-w-7xl mx-auto px-6 py-20 grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            <div className="lg:col-span-6 space-y-8">
              <div className="space-y-3">
                <h2 className="font-display text-3xl font-bold tracking-tight text-slate-950">
                  How DATAFIX Works End to End
                </h2>
                <p className="text-base text-slate-600">
                  A transparent 4-stage pipeline that proves what changed, why it changed, and
                  whether the resulting dataset passes revalidation.
                </p>
              </div>

              <div className="space-y-5">
                {WORKFLOW_STEPS.map((item) => (
                  <div
                    key={item.step}
                    className="flex gap-4 pb-5 border-b border-slate-200 last:border-b-0 last:pb-0"
                  >
                    <div className="text-xs font-mono font-semibold text-indigo-900 pt-1 shrink-0 w-14">
                      {item.step}
                    </div>
                    <div className="space-y-1">
                      <h3 className="font-display text-base font-semibold text-slate-950">
                        {item.title}
                      </h3>
                      <p className="text-sm text-slate-600 leading-relaxed">{item.detail}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="lg:col-span-6">
              <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                {!imgError ? (
                  <img
                    src="/src/assets/images/datafix_architecture_visual_1795094835178.jpg"
                    alt="DATAFIX structured data verification and repair architecture diagram"
                    referrerPolicy="no-referrer"
                    onError={() => setImgError(true)}
                    className="w-full aspect-video object-cover"
                  />
                ) : (
                  <div className="w-full aspect-video bg-gradient-to-br from-slate-100 to-indigo-50 flex flex-col items-center justify-center p-8 text-center">
                    <ShieldCheck className="w-10 h-10 text-indigo-900 mb-3" />
                    <div className="font-display font-semibold text-slate-900">
                      DATAFIX Autonomous Pipeline
                    </div>
                    <div className="text-xs text-slate-600 mt-1">
                      Ingest · Analyze · Approve · Validate · Export
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* Benefits & About */}
        <section id="about" className="max-w-7xl mx-auto px-6 py-20">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">
            <div className="lg:col-span-5 space-y-4">
              <h2 className="font-display text-3xl font-bold tracking-tight text-slate-950">
                Built Around Strict Data Integrity
              </h2>
              <p className="text-base text-slate-600 leading-relaxed">
                Automated scripts often corrupt edge cases by blindly dropping rows or imputing
                synthetic contact details. DATAFIX separates deterministic hygiene from human
                domain judgment.
              </p>
              <div className="pt-2">
                <button
                  type="button"
                  onClick={onGetStarted}
                  className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-violet-700 rounded-lg hover:bg-violet-800 transition-colors cursor-pointer"
                >
                  Open DataFix Workspace
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div className="border border-slate-200 rounded-xl p-6 space-y-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                <h3 className="font-display text-base font-semibold text-slate-950">
                  Original Dataset Preserved
                </h3>
                <p className="text-sm text-slate-600">
                  Source uploads remain untouched in memory so you can compare before and after rows
                  or switch imputation strategies at any time.
                </p>
              </div>

              <div className="border border-slate-200 rounded-xl p-6 space-y-2">
                <ShieldCheck className="w-5 h-5 text-indigo-900" />
                <h3 className="font-display text-base font-semibold text-slate-950">
                  Human Approval Gate
                </h3>
                <p className="text-sm text-slate-600">
                  Every proposed edit shows its confidence score and method. Nothing is written
                  until you approve individual repairs or safe bulk fixes.
                </p>
              </div>

              <div className="border border-slate-200 rounded-xl p-6 space-y-2">
                <Database className="w-5 h-5 text-violet-700" />
                <h3 className="font-display text-base font-semibold text-slate-950">
                  Resilient With or Without AI
                </h3>
                <p className="text-sm text-slate-600">
                  Core detection, repair, revalidation, and CSV/Excel exports run deterministically
                  locally even when external AI keys are offline.
                </p>
              </div>

              <div className="border border-slate-200 rounded-xl p-6 space-y-2">
                <FileSpreadsheet className="w-5 h-5 text-slate-800" />
                <h3 className="font-display text-base font-semibold text-slate-950">
                  Complete Auditability
                </h3>
                <p className="text-sm text-slate-600">
                  Download cleaned CSV/XLSX data alongside a machine-readable quality report and
                  timestamped modification audit trail.
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Quiet Footer */}
      <footer className="border-t border-slate-200 bg-slate-50">
        <div className="max-w-7xl mx-auto px-6 py-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-slate-500">
          <div className="flex items-center gap-3">
            <span className="font-display font-bold text-slate-900">DATAFIX</span>
            <span aria-hidden="true">·</span>
            <span>Upload. Detect. Understand. Repair. Verify.</span>
          </div>
          <div className="flex items-center gap-6">
            <a href="#features" className="hover:text-slate-900">
              Features
            </a>
            <a href="#how-it-works" className="hover:text-slate-900">
              How It Works
            </a>
            <button
              type="button"
              onClick={onGetStarted}
              className="hover:text-slate-900 cursor-pointer"
            >
              Launch Workspace
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}
