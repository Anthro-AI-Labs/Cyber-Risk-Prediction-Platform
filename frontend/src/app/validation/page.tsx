"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { ArrowLeft, Check, AlertCircle } from "lucide-react";
import { Header } from "../../components/Header";
import { Footer } from "../../components/Footer";
import { AssumptionsDrawer } from "../../components/AssumptionsDrawer";
import { DEFAULT_ASSUMPTIONS } from "../../lib/engine";
import { RiskAssumptions } from "../../lib/types";
import generated from "../../data/generated.json";

interface ValidationScorecardItem {
  dimension: string;
  metric: string;
  result: string;
  meaning: string;
  status: string;
}

interface TornadoItem {
  param: string;
  label: string;
  low_mult: number;
  low_ale: number;
  high_mult: number;
  high_ale: number;
  swing: number;
}

const DEFAULT_SCORECARD: ValidationScorecardItem[] = [
  {
    dimension: "Accuracy vs. source",
    metric: "MITRE fidelity / CTID fidelity / published figures",
    result: "118/118 (100%) / 179/179 (100%) / 2/2 (100%)",
    meaning: "All 28 ATT&CK techniques, 179 CTID capability rows, and published losses match official sources identically.",
    status: "PASS",
  },
  {
    dimension: "Completeness & validity",
    metric: "schema validity / referential integrity / completeness",
    result: "7/7 / 100/100 / 49/49",
    meaning: "All 7 data files validate against strict Pydantic schemas with 100% referential integrity and completeness.",
    status: "PASS",
  },
  {
    dimension: "Traceability",
    metric: "mappings backed by official sources / model inputs from published figures",
    result: "74.2% (23/31) / 18.2% (2/11)",
    meaning: "74.2% of mappings are backed by official MITRE or CTID datasets; all other model inputs are labeled editable assumptions.",
    status: "PASS",
  },
  {
    dimension: "Correctness",
    metric: "acceptance tests (Python + TS) / Python–TS parity (256 configs)",
    result: "34/34 (100%) / 256/256 (100%)",
    meaning: "All acceptance tests pass; all 2⁸ (256) tool configurations produce bit-for-bit identical results in Python and TypeScript.",
    status: "PASS",
  },
  {
    dimension: "Reproducibility",
    metric: "determinism checks (simulation & Monte Carlo)",
    result: "2/2 (100%)",
    meaning: "Repeated executions of baseline simulation and Monte Carlo (seed 42) yield identical numbers.",
    status: "PASS",
  },
  {
    dimension: "Robustness",
    metric: "plan unchanged under ±50% (one-at-a-time / joint 500-run)",
    result: "22/22 (100%) / 500/500 (100%)",
    meaning: "Even if every assumption is off by up to ±50%, the recommended plan and the Tool X finding do not change.",
    status: "PASS",
  },
  {
    dimension: "Compliance",
    metric: "banned-phrase violations",
    result: "0 violations",
    meaning: "Zero banned vendor marketing claims ('100% secure', 'guaranteed', 'hack-proof') detected.",
    status: "PASS",
  },
];

const DEFAULT_TORNADO: TornadoItem[] = [
  { param: "pass.missed", label: "Missed step pass probability", low_mult: 0.5, low_ale: 93902, high_mult: 1.5, high_ale: 830520, swing: 736618 },
  { param: "S3.attempts", label: "S3 (BEC / Invoice fraud) attempts/year", low_mult: 0.5, low_ale: 549427, high_mult: 1.5, high_ale: 865811, swing: 316384 },
  { param: "S3.loss", label: "S3 (BEC / Invoice fraud) loss/success", low_mult: 0.5, low_ale: 549427, high_mult: 1.5, high_ale: 865811, swing: 316384 },
  { param: "pass.detected", label: "Detected step pass probability", low_mult: 0.5, low_ale: 590038, high_mult: 1.5, high_ale: 904234, swing: 314196 },
  { param: "pass.stopped", label: "Stopped step pass probability", low_mult: 0.5, low_ale: 589647, high_mult: 1.5, high_ale: 829557, swing: 239910 },
  { param: "S1.attempts", label: "S1 (Phishing) attempts/year", low_mult: 0.5, low_ale: 590330, high_mult: 1.5, high_ale: 824908, swing: 234578 },
  { param: "S1.loss", label: "S1 (Phishing) loss/success", low_mult: 0.5, low_ale: 590330, high_mult: 1.5, high_ale: 824908, swing: 234578 },
  { param: "S2.attempts", label: "S2 (Password spray) attempts/year", low_mult: 0.5, low_ale: 629643, high_mult: 1.5, high_ale: 785595, swing: 155952 },
  { param: "S2.loss", label: "S2 (Password spray) loss/success", low_mult: 0.5, low_ale: 629643, high_mult: 1.5, high_ale: 785595, swing: 155952 },
  { param: "S4.attempts", label: "S4 (Ransomware) attempts/year", low_mult: 0.5, low_ale: 707267, high_mult: 1.5, high_ale: 707972, swing: 705 },
  { param: "S4.loss", label: "S4 (Ransomware) loss/success", low_mult: 0.5, low_ale: 707267, high_mult: 1.5, high_ale: 707972, swing: 705 },
];

export default function ValidationPage() {
  const [isDark, setIsDark] = useState<boolean>(() => {
    if (typeof window !== "undefined") {
      try {
        const stored = localStorage.getItem("cyber_validator_theme");
        if (stored === "light") return false;
      } catch {}
    }
    return true;
  });
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [assumptions, setAssumptions] = useState<RiskAssumptions>(DEFAULT_ASSUMPTIONS);
  const [scorecard] = useState<ValidationScorecardItem[]>(DEFAULT_SCORECARD);
  const [tornado] = useState<TornadoItem[]>(DEFAULT_TORNADO);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", isDark ? "dark" : "light");
  }, [isDark]);

  const toggleTheme = useCallback(() => {
    setIsDark((prev) => {
      const next = !prev;
      document.documentElement.setAttribute("data-theme", next ? "dark" : "light");
      try {
        localStorage.setItem("cyber_validator_theme", next ? "dark" : "light");
      } catch {}
      return next;
    });
  }, []);

  const maxSwing = Math.max(...tornado.map((t) => t.swing), 1);

  return (
    <div className="min-h-screen flex flex-col bg-[var(--paper)] text-[var(--ink)]">
      <Header
        currentChapter={0}
        visitedChapters={new Set()}
        onSelectChapter={() => {}}
        onOpenAssumptions={() => setIsDrawerOpen(true)}
        isDark={isDark}
        onToggleTheme={toggleTheme}
      />

      <main className="flex-1 py-8">
        <div className="wrap max-w-[1320px] mx-auto px-6">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--accent)] hover:underline mb-5"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to ROI Cyber-Validator</span>
          </Link>

          <h1 className="text-[34px] font-bold tracking-tight mb-3 text-[var(--ink)]">
            How we checked our data
          </h1>

          <p className="text-[18px] text-[var(--muted)] mb-8 leading-relaxed max-w-[85ch]">
            This project has no historical incident data for the fictional company, so{" "}
            <em>predictive</em> accuracy cannot be measured. Following data-quality best practice
            (dimensions used by ISO/IEC 25012 and DAMA-DMBOK), we measure (1) how faithfully our data
            reproduces its official sources, (2) completeness, validity and consistency, (3)
            traceability of every number, (4) correctness and reproducibility of the calculation engine,
            and (5) how stable the recommendations are when assumptions change.
          </p>

          {/* Section: Scorecard */}
          <div className="mb-10">
            <h2 className="text-[20px] font-bold text-[var(--ink)] mb-4">
              Validation Scorecard
            </h2>
            <div className="rows flex flex-col gap-2.5">
              {scorecard.map((item, idx) => (
                <div
                  key={idx}
                  className="rrow bg-[var(--surface)] border border-[var(--line)] rounded-[10px] p-4 sm:px-5 sm:py-4 flex flex-col md:flex-row md:items-center justify-between gap-4 transition-colors"
                >
                  <div className="max-w-[70ch]">
                    <div className="font-semibold text-[17px] text-[var(--ink)] flex items-center gap-2 flex-wrap">
                      <span>{item.dimension}</span>
                      <span className="text-xs text-[var(--muted)] font-normal">
                        ({item.metric})
                      </span>
                    </div>
                    <div className="text-[14.5px] text-[var(--muted)] mt-1 leading-normal">
                      {item.meaning}
                    </div>
                  </div>

                  <div className="flex items-center gap-3.5 self-start md:self-center shrink-0">
                    <span className="font-bold text-lg sm:text-xl tabular-nums text-[var(--ink)]">
                      {item.result}
                    </span>
                    <span className="bg-[var(--stop-soft)] text-[var(--stop)] text-xs font-semibold px-2.5 py-1 rounded-full inline-flex items-center gap-1">
                      <Check className="w-3.5 h-3.5" />
                      <span>{item.status}</span>
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Section: Sensitivity Analysis (Tornado Table) */}
          <div className="card bg-[var(--surface)] border border-[var(--line)] rounded-[14px] p-6 mb-10">
            <div className="mb-5">
              <h2 className="text-[20px] font-bold text-[var(--ink)] mb-1">
                Decision Robustness — Sensitivity Analysis (Tornado Chart)
              </h2>
              <p className="text-[14.5px] text-[var(--muted)] leading-relaxed">
                Inputs ranked by impact on baseline total loss exposure when varied by ±50% one-at-a-time (22 runs).{" "}
                <strong className="text-[var(--ink)] font-semibold">
                  Even if every assumption is off by up to ±50%, the recommended plan and the Tool X finding do not change.
                </strong>
              </p>
            </div>

            <div className="space-y-3">
              {tornado.map((item, idx) => {
                const pctOfMax = Math.max(2, (item.swing / maxSwing) * 100);
                return (
                  <div
                    key={idx}
                    className="grid grid-cols-1 lg:grid-cols-[280px_1fr_130px] gap-2 lg:gap-4 items-center text-[13.5px] py-1 border-b border-[var(--line)] last:border-b-0"
                  >
                    <div>
                      <div className="font-semibold text-[var(--ink)]">{item.label}</div>
                      <div className="text-xs font-mono text-[var(--muted)]">`{item.param}`</div>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-xs text-[var(--muted)] w-14 text-right tabular-nums">
                        ${Math.round(item.low_ale).toLocaleString()}
                      </span>
                      <div className="track flex-1 h-3 bg-[var(--soft)] rounded-full overflow-hidden">
                        <div
                          className="fill h-full rounded-full bg-[var(--stop)] transition-all duration-500"
                          style={{ width: `${pctOfMax}%` }}
                        />
                      </div>
                      <span className="text-xs text-[var(--muted)] w-14 tabular-nums">
                        ${Math.round(item.high_ale).toLocaleString()}
                      </span>
                    </div>

                    <div className="text-left lg:text-right font-bold text-[14px] tabular-nums text-[var(--ink)]">
                      ${Math.round(item.swing).toLocaleString()} swing
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Section: Limitations */}
          <div className="card bg-[var(--surface)] border border-[var(--line)] rounded-[14px] p-6 mb-8">
            <h2 className="text-[20px] font-bold text-[var(--ink)] mb-3 flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-[var(--muted)]" />
              <span>Model Limitations</span>
            </h2>
            <ul className="list-disc pl-5 space-y-2 text-[15px] text-[var(--muted)] leading-relaxed">
              {((generated as { limitations?: { title: string; description: string }[] }).limitations || []).map((lim, idx) => (
                <li key={idx}>
                  <strong>{lim.title}:</strong> {lim.description}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </main>

      <Footer />

      <AssumptionsDrawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        assumptions={assumptions}
        onUpdateAssumptions={setAssumptions}
        onResetAssumptions={() => setAssumptions(DEFAULT_ASSUMPTIONS)}
      />
    </div>
  );
}
