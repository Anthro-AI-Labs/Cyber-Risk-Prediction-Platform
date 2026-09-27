import React from "react";
import { ArrowRight, BookOpen } from "lucide-react";
import { PresentationMode } from "../lib/types";
import generated from "../data/generated.json";

const MITRE_VERSION = (generated as { source: { version: string } }).source.version;

interface ChapterBillProps {
  onNext: () => void;
  mode?: PresentationMode;
}

export const ChapterBill: React.FC<ChapterBillProps> = ({ onNext, mode = "simple" }) => {
  const isSimple = mode === "simple";

  return (
    <section className="chap active">
      <h1 className="text-[34px] sm:text-[38px] leading-[1.15] tracking-tight font-bold mb-3 max-w-[32ch] text-[var(--ink)]">
        You spend{" "}
        <span className="text-[var(--accent)] underline decoration-[var(--accent)]/40 underline-offset-4">
          $345,000
        </span>{" "}
        a year on security. What is it buying you?
      </h1>
      <p className="text-[19px] text-[var(--muted)] max-w-[62ch] mb-6 leading-relaxed">
        {isSimple
          ? "We safely test your tools against four common attacks, calculate what each attack could cost you in a year, and show which tools earn their price."
          : "We safely test your tools against four common attacks, estimate what each attack could cost you in a year, and show which tools earn their price."}
      </p>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4.5 mb-7">
        {/* Card 1 */}
        <div className="card flex flex-col justify-between p-[22px] bg-[var(--surface)] border border-[var(--line)] rounded-[14px] hover:border-[var(--accent)]/40 transition-colors">
          <div>
            <div className="w-8 h-8 rounded-full bg-[var(--accent-soft)] text-[var(--accent)] flex items-center justify-center font-bold mb-3">
              1
            </div>
            <h4 className="text-[17px] font-semibold mb-2 text-[var(--ink)]">Run the attacks</h4>
            <p className="text-[15.5px] text-[var(--muted)] leading-relaxed">
              {isSimple
                ? "Each attack simulates real attacker steps from MITRE ATT&CK to verify which tools block each step."
                : "Each attack is a chain of real attacker steps from MITRE ATT&CK. We check which of your tools blocks each step."}
            </p>
          </div>
        </div>

        {/* Card 2 */}
        <div className="card flex flex-col justify-between p-[22px] bg-[var(--surface)] border border-[var(--line)] rounded-[14px] hover:border-[var(--accent)]/40 transition-colors">
          <div>
            <div className="w-8 h-8 rounded-full bg-[var(--accent-soft)] text-[var(--accent)] flex items-center justify-center font-bold mb-3">
              2
            </div>
            <h4 className="text-[17px] font-semibold mb-2 text-[var(--ink)]">Estimate the cost</h4>
            <p className="text-[15.5px] text-[var(--muted)] leading-relaxed">
              {isSimple
                ? "Blocked steps lower the chance an attack succeeds, which lowers the estimated yearly loss in dollars."
                : "Blocked steps lower the chance an attack succeeds. That chance, times how often it's tried and what it costs, gives a yearly estimate."}
            </p>
          </div>
        </div>

        {/* Card 3 */}
        <div className="card flex flex-col justify-between p-[22px] bg-[var(--surface)] border border-[var(--line)] rounded-[14px] hover:border-[var(--accent)]/40 transition-colors">
          <div>
            <div className="w-8 h-8 rounded-full bg-[var(--accent-soft)] text-[var(--accent)] flex items-center justify-center font-bold mb-3">
              3
            </div>
            <h4 className="text-[17px] font-semibold mb-2 text-[var(--ink)]">Compare your options</h4>
            <p className="text-[15.5px] text-[var(--muted)] leading-relaxed">
              {isSimple
                ? "Switch tools on or off to see live ROI changes, then let the optimizer find a higher-protection mix for the same budget."
                : "Switch tools on or off and see the estimate change. Then let the planner find a better mix for the same budget."}
            </p>
          </div>
        </div>
      </div>

      {/* Progressive Disclosure: Deep methodology detail link */}
      <div className="mb-4">
        <details className="text-sm">
          <summary className="cursor-pointer text-[var(--accent)] font-medium list-none outline-none inline-flex items-center gap-1.5 hover:underline">
            <BookOpen className="w-4 h-4" />
            <span>How this model works (FAIR + ROSI + MITRE ATT&CK)</span>
          </summary>
          <div className="mt-2.5 p-3.5 bg-[var(--soft)] border border-[var(--line)] rounded-lg text-[13.5px] text-[var(--muted)] leading-relaxed max-w-[65ch]">
            Financial risk is modeled using the FAIR ontology (Frequency × Probability × Magnitude). Return on Security Investment (ROSI) is the estimated loss reduction minus the tool cost, divided by the tool cost. Every attack step maps to a technique in MITRE Enterprise ATT&CK v{MITRE_VERSION}.
          </div>
        </details>
      </div>

      <div className="flex justify-end items-center mt-7 gap-3">
        <button
          onClick={onNext}
          className="primary flex items-center gap-2 bg-[var(--accent)] text-white font-semibold text-[16.5px] px-6 py-3.5 rounded-full transition-all cursor-pointer"
        >
          <span>Run the attacks</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </section>
  );
};
