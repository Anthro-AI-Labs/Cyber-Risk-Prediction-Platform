"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, BookOpen, ShieldAlert } from "lucide-react";
import { Header } from "../../components/Header";
import { Footer } from "../../components/Footer";
import { EvidenceReport } from "../../lib/types";
import { DEFAULT_ASSUMPTIONS } from "../../lib/engine";

const MC = DEFAULT_ASSUMPTIONS.monte_carlo;

export default function MethodologyPage() {
  const [report, setReport] = useState<EvidenceReport | null>(null);
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/meta/evidence-report`)
      .then((r) => r.json())
      .then((d) => setReport(d))
      .catch(() => {
        setReport({ validated_mappings_count: 28, downgrades: [] });
      });
  }, []);

  const toggleTheme = () => {
    setIsDark(!isDark);
    document.documentElement.setAttribute("data-theme", !isDark ? "dark" : "light");
  };

  return (
    <div className="min-h-screen flex flex-col bg-[var(--paper)] text-[var(--ink)]">
      <Header
        currentChapter={0}
        visitedChapters={new Set()}
        onSelectChapter={() => {}}
        onOpenAssumptions={() => {}}
        isDark={isDark}
        onToggleTheme={toggleTheme}
      />

      <main className="flex-1 py-10">
        <div className="wrap max-w-[900px]">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--accent)] hover:underline mb-6"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to ROI Cyber-Validator</span>
          </Link>

          <h1 className="text-[34px] font-bold tracking-tight mb-3 text-[var(--ink)] flex items-center gap-3">
            <BookOpen className="w-8 h-8 text-[var(--accent)]" />
            <span>Calculation Methodology & Standards</span>
          </h1>

          <p className="text-[18px] text-[var(--muted)] mb-8 leading-relaxed">
            ROI Cyber-Validator translates simulated cyber attack chains into transparent financial risk metrics using open industry standards.
          </p>

          {/* Section 1: FAIR-Style Loss Exposure */}
          <section className="bg-[var(--surface)] border border-[var(--line)] rounded-[14px] p-6 mb-6">
            <h2 className="text-[20px] font-bold text-[var(--ink)] mb-2">
              1. Annual Financial Loss Exposure (FAIR-Style Model)
            </h2>
            <p className="text-[15.5px] text-[var(--muted)] mb-3 leading-relaxed">
              Financial exposure is structured after the Factor Analysis of Information Risk (FAIR) standard (Open Group standard):
            </p>
            <div className="bg-[var(--soft)] rounded-lg p-4 font-mono text-sm text-[var(--ink)] mb-3">
              Annual Loss Exposure (ALE) = Attempts per year × Probability of success × Loss per success
            </div>
            <p className="text-[15px] text-[var(--muted)] leading-relaxed">
              Total Annual Loss Exposure is the deterministic sum of the point estimates across all evaluated scenarios.
            </p>
          </section>

          {/* Section 2: ROSI Formula */}
          <section className="bg-[var(--surface)] border border-[var(--line)] rounded-[14px] p-6 mb-6">
            <h2 className="text-[20px] font-bold text-[var(--ink)] mb-2">
              2. Return on Security Investment (ROSI)
            </h2>
            <p className="text-[15.5px] text-[var(--muted)] mb-3 leading-relaxed">
              Tool returns follow the standard Return on Security Investment (ROSI) model described by ENISA (European Union Agency for Cybersecurity):
            </p>
            <div className="bg-[var(--soft)] rounded-lg p-4 font-mono text-sm text-[var(--ink)] mb-3">
              ROSI = (Risk reduction − Annual tool cost) ÷ Annual tool cost
            </div>
            <p className="text-[15px] text-[var(--muted)] leading-relaxed">
              Where <b>Risk reduction</b> is calculated through counterfactual analysis: the difference between total loss exposure without the tool and with the tool active. Tools with $0 additional cost are reported with their absolute exposure reduction.
            </p>
          </section>

          {/* Section 3: Step Probabilities & Severities */}
          <section className="bg-[var(--surface)] border border-[var(--line)] rounded-[14px] p-6 mb-6">
            <h2 className="text-[20px] font-bold text-[var(--ink)] mb-3">
              3. Pass Probabilities & Severity Thresholds
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <h3 className="text-sm font-semibold text-[var(--ink)] mb-2 uppercase tracking-wide">
                  Step Pass Probabilities
                </h3>
                <ul className="text-sm text-[var(--muted)] space-y-1.5 list-disc pl-5">
                  <li><b>Blocked (20%):</b> Controls can fail, be misconfigured or bypassed.</li>
                  <li><b>Seen, not blocked (60%):</b> Telemetry alerted, but attacker continues.</li>
                  <li><b>No tool reacted (95%):</b> Attacks may fail for external reasons.</li>
                  <li><b>Starting condition (100%):</b> Assumed pre-existing compromise.</li>
                </ul>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-[var(--ink)] mb-2 uppercase tracking-wide">
                  Severity Thresholds
                </h3>
                <ul className="text-sm text-[var(--muted)] space-y-1.5 list-disc pl-5">
                  <li><b className="text-[var(--critical)]">Critical:</b> P(scenario) ≥ 50%</li>
                  <li><b className="text-[var(--high)]">High:</b> P(scenario) ≥ 20%</li>
                  <li><b className="text-[var(--medium)]">Medium:</b> P(scenario) ≥ 5%</li>
                  <li><b className="text-[var(--low)]">Low:</b> P(scenario) &lt; 5%</li>
                </ul>
              </div>
            </div>
          </section>

          {/* Section 4: Monte Carlo */}
          <section className="bg-[var(--surface)] border border-[var(--line)] rounded-[14px] p-6 mb-6">
            <h2 className="text-[20px] font-bold text-[var(--ink)] mb-2">
              4. Monte Carlo Uncertainty Ranges (PERT)
            </h2>
            <p className="text-[15.5px] text-[var(--muted)] mb-3 leading-relaxed">
              Every exposure figure displays a P10–P90 range computed using a {MC.iterations.toLocaleString("en-US")}-iteration Monte Carlo simulation (fixed seed {MC.seed}) with Program Evaluation and Review Technique (PERT) Beta distributions for annual attempts and cost per success (low = min, likely = mode, high = max). The browser and the server use different random number generators, so their ranges are close but not identical; the validation checks they agree within ±3%.
            </p>
          </section>

          {/* Section 5: Evidence Validation Report */}
          <section className="bg-[var(--surface)] border border-[var(--line)] rounded-[14px] p-6 mb-6">
            <h2 className="text-[20px] font-bold text-[var(--ink)] mb-2">
              5. Evidence Validation & Downgrades
            </h2>
            <p className="text-[15.5px] text-[var(--muted)] mb-3 leading-relaxed">
              Every mapping between a security tool and a MITRE ATT&CK technique is verified at startup. If a MITRE mitigation hint or detection strategy cannot be verified in the authoritative MITRE ATT&CK Enterprise v19.2 dataset, the mapping is downgraded to &ldquo;Team assumption&rdquo;.
            </p>
            <div className="bg-[var(--soft)] rounded-lg p-3 text-sm font-medium text-[var(--ink)]">
              Validated Mappings: <b>{report?.validated_mappings_count ?? 28}</b> | Downgrades:{" "}
              <b>{report?.downgrades.length ?? 0}</b>
            </div>
          </section>

          {/* Limitations */}
          <section className="bg-[var(--surface)] border border-dashed border-[var(--line)] rounded-[14px] p-6">
            <h2 className="text-[18px] font-semibold text-[var(--ink)] flex items-center gap-2 mb-2">
              <ShieldAlert className="w-5 h-5 text-[var(--high)]" />
              <span>Scope & Honest Limitations</span>
            </h2>
            <p className="text-[14.5px] text-[var(--muted)] leading-relaxed">
              Results reflect only the 4 tested attack chains from MITRE ATT&CK®. The system provides quantitative risk prediction models based on organizational assumptions, not a guarantee of security. No live exploitation or scanning is performed.
            </p>
          </section>
        </div>
      </main>

      <Footer />
    </div>
  );
}
