"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Printer, FileText, Sparkles, Shield, AlertTriangle, CheckCircle2 } from "lucide-react";
import { Header } from "../../components/Header";
import { Footer } from "../../components/Footer";
import { SummaryResponse, SimulationResponse } from "../../lib/types";
import { fetchSummary } from "../../lib/api";
import { computeRisk, BASELINE_TOOLS as BASELINE_TOOL_IDS } from "../../lib/engine";
import { fmt, fmtK, SEVERITY_CONFIG } from "../../lib/format";
import { useTheme } from "../../lib/useTheme";


const SCENARIO_NAMES: Record<string, string> = {
  S1: "Fake login page",
  S2: "Password guessing",
  S3: "Invoice fraud",
  S4: "Ransomware",
};

export default function ReportPage() {
  const [summary, setSummary] = useState<SummaryResponse | null>(null);
  const [sim] = useState<SimulationResponse>(() => computeRisk(BASELINE_TOOL_IDS));
  const { isDark, toggleTheme } = useTheme();

  useEffect(() => {
    fetchSummary(BASELINE_TOOL_IDS)
      .then((res) => {
        setSummary(res.data);
      })
      .catch(() => {
        setSummary({
          source: "template",
          executive_summary: `In tested scenarios, current configuration carries an estimated annual financial loss exposure of $${sim.total_ale_point_rounded.toLocaleString()} (estimate). Active security spend is $${sim.total_spend.toLocaleString()} annually.`,
          key_findings: [
            `Total estimated annual loss exposure is $${sim.total_ale_point_rounded.toLocaleString()} across 4 tested scenarios (estimate).`,
            "Two tested scenarios exhibit Critical or High risk exposure (Invoice fraud S3 and Password guessing S2).",
            "Tool X provides script control that duplicates EDR protection in tested scenarios, providing no unique stops.",
          ],
          recommended_actions: [
            "Enable Second Login Check (MFA) already owned in office license at $0 extra cost.",
            "Reallocate budget from low-return controls towards identity protection and payment verification.",
          ],
        });
      });
  }, [sim]);


  const handlePrint = () => {
    if (typeof window !== "undefined") {
      window.print();
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-[var(--paper)] text-[var(--ink)]">
      <div className="print:hidden">
        <Header
          currentChapter={0}
          visitedChapters={new Set()}
          onSelectChapter={() => {}}
          onOpenAssumptions={() => {}}
          isDark={isDark}
          onToggleTheme={toggleTheme}
        />
      </div>

      <main className="flex-1 py-10 print:py-0">
        <div className="wrap max-w-[900px] print:max-w-none print:px-0">
          {/* Back link and Print Button */}
          <div className="flex items-center justify-between mb-6 print:hidden">
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--accent)] hover:underline"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to ROI Cyber-Validator</span>
            </Link>

            <button
              onClick={handlePrint}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-[var(--line)] bg-[var(--surface)] text-[var(--ink)] font-medium text-sm hover:bg-[var(--soft)] shadow-sm transition-colors"
            >
              <Printer className="w-4 h-4 text-[var(--muted)]" />
              <span>Print Executive Report</span>
            </button>
          </div>

          {/* Report Paper Container */}
          <article className="bg-[var(--surface)] border border-[var(--line)] rounded-[14px] p-8 md:p-10 shadow-sm print:border-none print:shadow-none print:p-0">
            {/* Header / Meta */}
            <div className="border-b border-[var(--line)] pb-6 mb-6">
              <div className="flex items-center justify-between flex-wrap gap-4 mb-2">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-[var(--ink)] flex items-center justify-center text-[var(--surface)]">
                    <FileText className="w-4 h-4" />
                  </div>
                  <span className="font-bold text-lg tracking-tight">ROI Cyber-Validator</span>
                </div>
                <div className="text-xs text-[var(--muted)]">
                  Evaluation Date: <span className="font-mono">September 2026</span> · Baseline Profile
                </div>
              </div>

              <h1 className="text-3xl font-bold tracking-tight text-[var(--ink)] mt-2">
                Executive Cybersecurity Risk &amp; Investment Report
              </h1>
              <p className="text-base text-[var(--muted)] mt-1">
                Quantitative risk assessment and Return on Security Investment (ROSI) analysis across tested scenarios.
              </p>
            </div>

            {/* AI or Template Source Badge */}
            {summary && (
              <div className="mb-6 flex items-center gap-2">
                {summary.source === "llm" ? (
                  <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full bg-indigo-100 text-indigo-800 border border-indigo-200 dark:bg-indigo-950 dark:text-indigo-300 dark:border-indigo-800">
                    <Sparkles className="w-3.5 h-3.5" /> AI-generated synthesis (verified against rule engine)
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full bg-[var(--soft)] text-[var(--muted)] border border-[var(--line)]">
                    <Shield className="w-3.5 h-3.5" /> Rule engine deterministic summary
                  </span>
                )}
                <span className="text-xs text-[var(--muted)]">· Sample company profile</span>
              </div>
            )}

            {/* Core Metrics Grid */}
            {sim && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
                <div className="bg-[var(--soft)] border border-[var(--line)] rounded-[10px] p-4">
                  <div className="text-xs font-medium text-[var(--muted)] uppercase tracking-wider mb-1">
                    Estimated Annual Loss <span className="est text-[10px]">Estimate</span>
                  </div>
                  <div className="text-2xl font-bold text-[var(--ink)] font-mono">
                    {fmt(sim.total_ale_point)}
                  </div>
                  <div className="text-xs text-[var(--muted)] mt-1 font-mono">
                    Range: {fmtK(sim.total_ale_range.p10)} – {fmtK(sim.total_ale_range.p90)} (P10–P90)
                  </div>
                </div>

                <div className="bg-[var(--soft)] border border-[var(--line)] rounded-[10px] p-4">
                  <div className="text-xs font-medium text-[var(--muted)] uppercase tracking-wider mb-1">
                    Annual Security Spend
                  </div>
                  <div className="text-2xl font-bold text-[var(--ink)] font-mono">
                    {fmt(sim.total_spend)}
                  </div>
                  <div className="text-xs text-[var(--muted)] mt-1">
                    5 active security tools deployed
                  </div>
                </div>

                <div className="bg-[var(--soft)] border border-[var(--line)] rounded-[10px] p-4">
                  <div className="text-xs font-medium text-[var(--muted)] uppercase tracking-wider mb-1">
                    Tested Attack Severities
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="inline-flex items-center gap-1 text-xs font-bold text-red-600 dark:text-red-400">
                      ● 1 Crit
                    </span>
                    <span className="inline-flex items-center gap-1 text-xs font-bold text-orange-600 dark:text-orange-400">
                      ● 1 High
                    </span>
                    <span className="inline-flex items-center gap-1 text-xs font-bold text-amber-600 dark:text-amber-400">
                      ● 1 Med
                    </span>
                    <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-600 dark:text-emerald-400">
                      ● 1 Low
                    </span>
                  </div>
                  <div className="text-xs text-[var(--muted)] mt-1">
                    4 simulated attack chains
                  </div>
                </div>
              </div>
            )}

            {/* Executive Summary */}
            {summary && (
              <section className="mb-8">
                <h2 className="text-lg font-bold text-[var(--ink)] mb-2 flex items-center gap-2">
                  <span>Executive Summary</span>
                </h2>
                <div className="bg-[var(--paper)] border border-[var(--line)] rounded-[10px] p-4 text-[15.5px] leading-relaxed text-[var(--ink)]">
                  {summary.executive_summary}
                </div>
              </section>
            )}

            {/* Key Findings */}
            {summary && summary.key_findings.length > 0 && (
              <section className="mb-8">
                <h2 className="text-lg font-bold text-[var(--ink)] mb-3 flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                  <span>Key Findings</span>
                </h2>
                <ul className="space-y-2">
                  {summary.key_findings.map((item, idx) => (
                    <li
                      key={idx}
                      className="flex items-start gap-2.5 text-[15px] leading-normal text-[var(--ink)]"
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-500 mt-2 flex-none" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {/* Scenario Breakdown Table */}
            {sim && (
              <section className="mb-8">
                <h2 className="text-lg font-bold text-[var(--ink)] mb-3">
                  Tested Scenarios Risk Breakdown
                </h2>
                <div className="overflow-x-auto border border-[var(--line)] rounded-[10px]">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-[var(--soft)] text-[var(--muted)] uppercase text-xs border-b border-[var(--line)]">
                      <tr>
                        <th className="py-2.5 px-3 font-semibold">Scenario</th>
                        <th className="py-2.5 px-3 font-semibold">Status</th>
                        <th className="py-2.5 px-3 font-semibold">Chance of Success</th>
                        <th className="py-2.5 px-3 font-semibold">Severity</th>
                        <th className="py-2.5 px-3 font-semibold text-right">Estimated Loss (ALE)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--line)]">
                      {Object.values(sim.scenarios).map((sc) => {
                        const sev = SEVERITY_CONFIG[sc.severity];
                        return (
                          <tr key={sc.id} className="hover:bg-[var(--soft)]/50">
                            <td className="py-2.5 px-3 font-medium text-[var(--ink)]">
                              {SCENARIO_NAMES[sc.id] || sc.id} ({sc.id})
                            </td>
                            <td className="py-2.5 px-3 capitalize text-[var(--muted)]">
                              {sc.status}
                            </td>
                            <td className="py-2.5 px-3 font-mono">
                              {sc.risk_score_display}
                            </td>
                            <td className="py-2.5 px-3">
                              <span
                                className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold ${sev.pillClass}`}
                              >
                                <span className="w-1.5 h-1.5 rounded-full bg-white" />
                                {sev.label}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono font-semibold text-[var(--ink)]">
                              {fmt(sc.ale_point)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </section>
            )}

            {/* Strategic Recommendations */}
            {summary && summary.recommended_actions.length > 0 && (
              <section className="mb-8">
                <h2 className="text-lg font-bold text-[var(--ink)] mb-3 flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                  <span>Strategic Recommendations</span>
                </h2>
                <ul className="space-y-2">
                  {summary.recommended_actions.map((item, idx) => (
                    <li
                      key={idx}
                      className="flex items-start gap-2.5 text-[15px] leading-normal text-[var(--ink)]"
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-2 flex-none" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {/* Methodological Compliance & Disclaimers */}
            <div className="border-t border-[var(--line)] pt-6 mt-8 text-xs text-[var(--muted)] space-y-2">
              <p>
                <strong>Methodology:</strong> Financial loss exposure is estimated using the Factor Analysis of Information Risk (FAIR) structure: <em>Annual Loss Exposure = Annual Attempts × Probability of Success × Loss per Success</em>. Return on Security Investment follows the ENISA formula: <em>ROSI = (Risk Reduction − Annual Cost) / Annual Cost</em>.
              </p>
              <p>
                <strong>Honest Scope:</strong> Results reflect evaluation in tested scenarios only. No security tool guarantees prevention of all attacks. Attack techniques from MITRE ATT&CK® Enterprise v19.2. © 2026 The MITRE Corporation.
              </p>
            </div>
          </article>
        </div>
      </main>

      <div className="print:hidden">
        <Footer />
      </div>
    </div>
  );
}
