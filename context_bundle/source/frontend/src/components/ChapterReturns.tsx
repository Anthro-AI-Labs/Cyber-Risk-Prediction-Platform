"use client";

import React from "react";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { fmt } from "../lib/format";
import { PresentationMode, SimulationResponse } from "../lib/types";

interface ChapterReturnsProps {
  currentSim: SimulationResponse;
  onPrev: () => void;
  onNext: () => void;
  mode?: PresentationMode;
}

export const ChapterReturns: React.FC<ChapterReturnsProps> = ({
  currentSim,
  onPrev,
  onNext,
  mode = "simple",
}) => {
  const isSimple = mode === "simple";
  const toolReturns = currentSim.tool_returns;
  const maxVal = Math.max(
    ...toolReturns.map((t) => Math.max(t.annual_cost, t.risk_reduction)),
    1
  );

  return (
    <section className="chap active">
      <h1 className="text-[34px] leading-[1.15] tracking-tight font-bold mb-2.5 max-w-[30ch] text-[var(--ink)]">
        What each tool returns for its price
      </h1>
      <p className="text-[19px] text-[var(--muted)] max-w-[62ch] mb-6 leading-relaxed">
        For every tool: what it costs, how much estimated loss it removes, and the return on that money. Grey rows show tools you could add.
      </p>

      {/* Tool Return Rows */}
      <div className="rows flex flex-col gap-2.5">
        {toolReturns.map((tool) => {
          const isFocus = tool.classification === "low_return" && tool.is_active && !tool.baseline_required;
          const statusText = tool.is_active
            ? "In use"
            : tool.status === "owned_not_enabled"
            ? "Owned, switched off"
            : "Not owned";

          const notes: string[] = [];
          if (tool.baseline_required && tool.is_active) {
            notes.push("Required baseline — its value reaches beyond these four attacks.");
          }
          if (tool.id === "identity_suite") {
            notes.push("Based on the vendor's description, not tested.");
          }
          if (tool.is_active && tool.noise_alerts !== null && tool.noise_alerts !== undefined) {
            notes.push(`${tool.noise_alerts} false alarms on a normal workday.`);
          }

          const rosiText =
            tool.annual_cost === 0
              ? tool.risk_reduction_rounded > 0
                ? "Free"
                : "—"
              : `${tool.rosi_pct !== null && tool.rosi_pct >= 0 ? "+" : ""}${Math.round(tool.rosi_pct || 0)}%`;

          let clsLabel = "";
          if (tool.classification === "low_return") {
            clsLabel = tool.baseline_required
              ? "Low return in tested attacks"
              : "Low return in tested attacks — worth a closer look";
          } else if (tool.classification === "high_return") {
            clsLabel = tool.annual_cost === 0 ? "Lowers loss at no extra cost" : "High return";
          } else {
            clsLabel = "Positive return";
          }

          const rosiColorClass =
            tool.classification === "high_return"
              ? "text-[var(--stop)]"
              : tool.classification === "positive_return"
              ? "text-[var(--accent)]"
              : "text-[var(--high)]";

          const costWidth = Math.min(100, (tool.annual_cost / maxVal) * 100);
          const reductionWidth = Math.min(100, (Math.max(0, tool.risk_reduction) / maxVal) * 100);

          return (
            <div
              key={tool.id}
              className={`rrow grid grid-cols-1 md:grid-cols-[220px_1fr_160px] gap-[18px] items-center bg-[var(--surface)] border rounded-[10px] p-4 sm:px-4 sm:py-[14px] transition-all ${
                isFocus
                  ? "border-[var(--high)] shadow-[0_0_0_3px_rgba(208,96,42,0.22)]"
                  : "border-[var(--line)]"
              } ${!tool.is_active ? "opacity-65" : ""}`}
            >
              {/* Left Column: Tool Details */}
              <div>
                <div className="font-semibold text-[16px] text-[var(--ink)]">{tool.name}</div>
                <div className="text-[13.5px] text-[var(--muted)]">{statusText}</div>
                {notes.map((n, i) => (
                  <div key={i} className="text-[13px] text-[var(--muted)] mt-1">
                    {n}
                  </div>
                ))}
              </div>

              {/* Middle Column: Comparison Horizontal Bars or Streamlined summary */}
              <div className="flex flex-col gap-1.5">
                {isSimple ? (
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center justify-between text-[13.5px] text-[var(--ink)] font-medium">
                      <span>Cost: <b>{fmt(tool.annual_cost)}</b>/yr</span>
                      <span className="text-[var(--stop)]">Removes: <b>{fmt(Math.max(0, tool.risk_reduction))}</b>/yr loss</span>
                    </div>
                    {/* Visual proportion mini bar */}
                    <div className="h-2.5 bg-[var(--soft)] rounded-full overflow-hidden flex">
                      <div
                        className="h-full bg-[var(--stop)] transition-all duration-700"
                        style={{ width: `${reductionWidth}%` }}
                        title={`Loss removed: ${fmt(Math.max(0, tool.risk_reduction))}`}
                      />
                    </div>
                  </div>
                ) : (
                  <>
                    {/* Cost Bar */}
                    <div className="grid grid-cols-[85px_1fr_80px] gap-2.5 items-center text-[13.5px]">
                      <span className="text-[var(--muted)]">Yearly cost</span>
                      <div className="h-3 bg-[var(--soft)] rounded-full overflow-hidden">
                        <div
                          className="h-full bg-[var(--muted)] rounded-full transition-all duration-700"
                          style={{ width: `${costWidth}%` }}
                        />
                      </div>
                      <span className="text-right font-semibold text-[var(--ink)] font-mono">
                        {fmt(tool.annual_cost)}
                      </span>
                    </div>

                    {/* Loss Removed Bar */}
                    <div className="grid grid-cols-[85px_1fr_80px] gap-2.5 items-center text-[13.5px]">
                      <span className="text-[var(--muted)]">
                        {tool.is_active ? "Loss removed" : "Would remove"}
                      </span>
                      <div className="h-3 bg-[var(--soft)] rounded-full overflow-hidden">
                        <div
                          className="h-full bg-[var(--stop)] rounded-full transition-all duration-700"
                          style={{ width: `${reductionWidth}%` }}
                        />
                      </div>
                      <span className="text-right font-semibold text-[var(--stop)] font-mono">
                        {fmt(Math.max(0, tool.risk_reduction))}
                      </span>
                    </div>
                  </>
                )}
              </div>

              {/* Right Column: ROSI */}
              <div className="text-left md:text-right">
                <div className={`text-[25px] font-bold leading-tight ${rosiColorClass} font-mono`}>
                  {rosiText}
                </div>
                <div className={`text-[12.5px] font-semibold mt-0.5 ${rosiColorClass}`}>
                  {clsLabel}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <p className="text-[13.5px] text-[var(--muted)] mt-4">
        Return on security investment (ROSI) = (estimated loss removed − yearly cost) ÷ yearly cost. Based on the four tested attacks only.
      </p>

      {/* Navigation Buttons */}
      <div className="next flex justify-between items-center mt-7 gap-3 flex-wrap">
        <button
          onClick={onPrev}
          className="flex items-center gap-2 border border-[var(--line)] bg-[var(--surface)] hover:bg-[var(--soft)] px-5 py-3 rounded-full text-[15.5px] font-medium text-[var(--ink)] transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back</span>
        </button>
        <button
          onClick={onNext}
          className="btn-neon-primary flex items-center gap-2 bg-[var(--accent)] text-white font-semibold text-[16.5px] px-6 py-3.5 rounded-full transition-all shadow-[0_0_14px_rgba(94,124,255,0.3)] hover:shadow-[0_0_22px_rgba(94,124,255,0.55)] cursor-pointer"
        >
          <span>Try a what-if</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </section>
  );
};
