"use client";

import React, { useState } from "react";
import { ArrowLeft, RotateCcw, Check, ChevronDown, ChevronRight, SlidersHorizontal, ShieldAlert } from "lucide-react";
import { fmt, fmtK } from "../lib/format";
import { OptimizerPlan, PresentationMode, SimulationResponse } from "../lib/types";

interface ChapterPlanProps {
  plan: OptimizerPlan | null;
  baselineSim: SimulationResponse;
  budget: number;
  onBudgetChange: (budget: number) => void;
  allowRemoveBaseline: boolean;
  onAllowRemoveBaselineChange: (allow: boolean) => void;
  onApplyPlan: () => void;
  onPrev: () => void;
  onRestart: () => void;
  mode?: PresentationMode;
}

export const ChapterPlan: React.FC<ChapterPlanProps> = ({
  plan,
  baselineSim,
  budget,
  onBudgetChange,
  allowRemoveBaseline,
  onAllowRemoveBaselineChange,
  onApplyPlan,
  onPrev,
  onRestart,
  mode = "advanced",
}) => {
  const isSimple = mode === "simple";
  const [detailsOpen, setDetailsOpen] = useState(false);
  const maxAle = Math.max(baselineSim.total_ale_point, plan ? plan.ale_after : 0, 1);

  return (
    <section className="chap active">
      <h1 className="text-[34px] leading-[1.15] tracking-tight font-bold mb-2.5 max-w-[30ch] text-[var(--ink)]">
        A better plan for the same budget
      </h1>
      <p className="text-[19px] text-[var(--muted)] max-w-[62ch] mb-5 leading-relaxed">
        The planner tries every combination of your tools, what you already own, and what you&apos;re considering, and picks the one with the lowest estimated loss that fits your budget.
      </p>

      <div className="plan grid grid-cols-1 md:grid-cols-2 gap-5 items-start">
        {/* Left Card: Controls and Plan Moves */}
        <div className="card ctrl bg-[var(--surface)] border border-[var(--line)] rounded-[14px] p-[22px] flex flex-col gap-4">
          <div>
            <label htmlFor="budgetSlider" className="text-[15px] font-semibold text-[var(--ink)] block mb-1">
              Budget: <b className="text-[var(--ink)]">{fmt(budget)}</b> per year
            </label>
            <input
              id="budgetSlider"
              type="range"
              min={150000}
              max={450000}
              step={5000}
              value={budget}
              onChange={(e) => onBudgetChange(Number(e.target.value))}
              className="w-full accent-[var(--accent)] cursor-pointer"
            />
          </div>

          {isSimple ? (
            /* SIMPLE MODE: Concise moves summary + progressive disclosure */
            <div className="flex flex-col gap-3">
              <div className="p-3 bg-[var(--soft)]/60 rounded-[10px] border border-[var(--line)]">
                <div className="text-xs uppercase font-bold tracking-wider text-[var(--muted)] mb-1.5">
                  Plan Recommendation Summary
                </div>
                <div className="text-[15.5px] text-[var(--ink)] font-medium">
                  {plan && plan.moves.length > 0 ? (
                    <span>
                      Modifies <b className="text-[var(--accent)]">{plan.moves.length}</b> security tool configuration(s) to optimize coverage.
                    </span>
                  ) : (
                    <span>Current tool allocation is optimal for this budget.</span>
                  )}
                </div>
              </div>

              {/* Collapsible Details */}
              <div className="border border-[var(--line)] rounded-[10px] overflow-hidden">
                <button
                  type="button"
                  onClick={() => setDetailsOpen(!detailsOpen)}
                  className="w-full flex items-center justify-between p-3 text-left bg-[var(--surface)] hover:bg-[var(--soft)]/50 text-[14px] font-semibold text-[var(--ink)] cursor-pointer transition-colors"
                >
                  <span className="flex items-center gap-2">
                    <SlidersHorizontal className="w-4 h-4 text-[var(--accent)]" />
                    <span>View tool changes &amp; baseline options</span>
                  </span>
                  {detailsOpen ? <ChevronDown className="w-4 h-4 text-[var(--muted)]" /> : <ChevronRight className="w-4 h-4 text-[var(--muted)]" />}
                </button>

                {detailsOpen && (
                  <div className="p-3.5 border-t border-[var(--line)] bg-[var(--soft)]/20 space-y-3.5">
                    <label className="chk flex items-start gap-2.5 text-[14px] cursor-pointer text-[var(--ink)]">
                      <input
                        type="checkbox"
                        checked={allowRemoveBaseline}
                        onChange={(e) => onAllowRemoveBaselineChange(e.target.checked)}
                        className="w-4 h-4 mt-0.5 accent-[var(--accent)] cursor-pointer"
                      />
                      <span>Allow removing required baseline tools (Email Security, Firewall, Log Monitoring)</span>
                    </label>

                    {plan?.baseline_warning && (
                      <div className="warn bg-[var(--det-soft)] text-[var(--det)] rounded-[6px] p-2.5 text-[13.5px] font-medium leading-snug flex items-start gap-2">
                        <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
                        <span>{plan.baseline_warning}</span>
                      </div>
                    )}

                    <div className="space-y-2 pt-1">
                      <div className="text-xs uppercase font-bold tracking-wider text-[var(--muted)]">Tool Actions</div>
                      {plan && plan.moves.length > 0 ? (
                        plan.moves.map((move, i) => {
                          const moveClass =
                            move.action === "remove"
                              ? "bg-[var(--miss-soft)] text-[var(--miss)]"
                              : move.action === "enable"
                              ? "bg-[var(--stop-soft)] text-[var(--stop)]"
                              : "bg-[var(--accent-soft)] text-[var(--accent)]";

                          return (
                            <div
                              key={i}
                              className="move flex gap-2.5 items-center py-2 border-t border-[var(--line)] first:border-t-0 text-sm"
                            >
                              <span className={`mv text-[11px] font-bold px-2 py-0.5 rounded-full min-w-[75px] text-center ${moveClass}`}>
                                {move.action_label}
                              </span>
                              <span className="text-[var(--ink)] font-medium">
                                {move.tool_name} <span className="text-xs text-[var(--muted)]">({move.cost_display})</span>
                              </span>
                            </div>
                          );
                        })
                      ) : (
                        <p className="text-[var(--muted)] text-xs">Today&apos;s setup is already the best fit.</p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* ADVANCED MODE: Complete Optimizer Controls and All Moves */
            <>
              <label className="chk flex items-start gap-2.5 text-[15px] cursor-pointer text-[var(--ink)]">
                <input
                  type="checkbox"
                  checked={allowRemoveBaseline}
                  onChange={(e) => onAllowRemoveBaselineChange(e.target.checked)}
                  className="w-4.5 h-4.5 mt-0.5 accent-[var(--accent)] cursor-pointer"
                />
                <span>Allow removing required baseline tools (Email Security, Firewall, Log Monitoring)</span>
              </label>

              {/* Amber Warning if baseline control removed */}
              {plan?.baseline_warning && (
                <div className="warn bg-[var(--det-soft)] text-[var(--det)] rounded-[6px] p-3 text-[14.5px] font-medium leading-snug flex items-start gap-2">
                  <ShieldAlert className="w-5 h-5 shrink-0 mt-0.5" />
                  <span>{plan.baseline_warning}</span>
                </div>
              )}

              <h4 className="font-semibold text-[17px] text-[var(--ink)] mt-1.5">The plan</h4>
              <div className="flex flex-col">
                {plan && plan.moves.length > 0 ? (
                  plan.moves.map((move, i) => {
                    const moveClass =
                      move.action === "remove"
                        ? "bg-[var(--miss-soft)] text-[var(--miss)]"
                        : move.action === "enable"
                        ? "bg-[var(--stop-soft)] text-[var(--stop)]"
                        : "bg-[var(--accent-soft)] text-[var(--accent)]";

                    return (
                      <div
                        key={i}
                        className="move flex gap-3 items-center py-3 border-t border-[var(--line)] first:border-t-0"
                      >
                        <span
                          className={`mv text-xs font-bold px-2.5 py-1 rounded-full min-w-[85px] text-center ${moveClass}`}
                        >
                          {move.action_label}
                        </span>
                        <span className="text-[15.5px] text-[var(--ink)]">
                          <b>{move.tool_name}</b>{" "}
                          <span className="text-sm text-[var(--muted)]">{move.cost_display}</span>
                        </span>
                      </div>
                    );
                  })
                ) : (
                  <p className="text-[var(--muted)] text-sm py-2">
                    Today&apos;s setup is already the best fit for this budget.
                  </p>
                )}
              </div>
            </>
          )}

          <button
            onClick={onApplyPlan}
            className="primary flex items-center gap-1.5 font-semibold text-[16px] px-6 py-3 rounded-full transition-all self-start mt-2 cursor-pointer"
          >
            <Check className="w-4 h-4" />
            <span>Apply this plan</span>
          </button>
        </div>

        {/* Right Card: Computed Results and Comparison Bars */}
        <div className="card bg-[var(--surface)] border border-[var(--line)] rounded-[14px] p-[22px]">
          <div className="text-[var(--muted)] text-[15px]">
            In this sample model, the plan lowers estimated yearly loss by
          </div>
          {/* LCD-optimized Hero Risk Reduction Percentage with Neon Glow */}
          <div className="hero-red text-[52px] sm:text-[60px] font-bold tracking-tight leading-none text-[var(--stop)] my-2.5">
            {plan ? `${plan.risk_reduction_pct.toFixed(1)}%` : "0.0%"}
          </div>

          {/* Today vs Plan Comparison Bars */}
          <div className="cmpbar my-3.5 space-y-2">
            <div className="row grid grid-cols-[65px_1fr_95px] gap-2.5 items-center text-[15px]">
              <span className="text-[var(--muted)]">Today</span>
              <div className="track h-[26px] bg-[var(--soft)] rounded-[8px] overflow-hidden">
                <div
                  className="fill h-full bg-[var(--miss)] rounded-[8px] transition-all duration-800"
                  style={{ width: `${(baselineSim.total_ale_point / maxAle) * 100}%` }}
                />
              </div>
              <b className="text-right text-[var(--ink)]">{fmtK(baselineSim.total_ale_point)}</b>
            </div>

            <div className="row grid grid-cols-[65px_1fr_95px] gap-2.5 items-center text-[15px]">
              <span className="text-[var(--muted)]">Plan</span>
              <div className="track h-[26px] bg-[var(--soft)] rounded-[8px] overflow-hidden">
                <div
                  className="fill h-full bg-[var(--stop)] rounded-[8px] transition-all duration-800"
                  style={{ width: `${((plan ? plan.ale_after : 0) / maxAle) * 100}%` }}
                />
              </div>
              <b className="text-right text-[var(--ink)]">
                {plan ? fmtK(plan.ale_after) : "$0"}
              </b>
            </div>
          </div>

          <div className="kv flex justify-between gap-2 py-3 border-t border-[var(--line)] text-[15.5px]">
            <span className="text-[var(--muted)]">Estimated yearly loss</span>
            <b className="text-[var(--ink)]">
              {fmt(baselineSim.total_ale_point)} → <span className="text-[var(--stop)] font-bold">{plan ? fmt(plan.ale_after) : "$0"}</span>
            </b>
          </div>

          {!isSimple && (
            <div className="kv flex justify-between gap-2 py-3 border-t border-[var(--line)] text-[15.5px]">
              <span className="text-[var(--muted)]">Likely range after plan</span>
              <b className="text-[var(--ink)]">
                {plan
                  ? `${fmtK(plan.ale_range_after.p10)} – ${fmtK(plan.ale_range_after.p90)}`
                  : "—"}
              </b>
            </div>
          )}

          <div className="kv flex justify-between gap-2 py-3 border-t border-[var(--line)] text-[15.5px]">
            <span className="text-[var(--muted)]">Yearly spend</span>
            <b className="text-[var(--ink)]">
              {fmt(baselineSim.total_spend)} → {plan ? fmt(plan.spend_after) : "$0"}
            </b>
          </div>

          <p className="text-[13.5px] text-[var(--muted)] mt-3 leading-normal">
            An estimate from the assumptions you can see and change. Not a guarantee.
          </p>
        </div>
      </div>

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
          onClick={onRestart}
          className="flex items-center gap-2 border border-[var(--line)] bg-[var(--surface)] hover:bg-[var(--soft)] px-5 py-3 rounded-full text-[15.5px] font-medium text-[var(--ink)] transition-colors cursor-pointer"
        >
          <RotateCcw className="w-4 h-4" />
          <span>Start over</span>
        </button>
      </div>
    </section>
  );
};
