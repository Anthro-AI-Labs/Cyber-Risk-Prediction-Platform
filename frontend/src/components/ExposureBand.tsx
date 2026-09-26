"use client";

import React, { useEffect, useState } from "react";
import { fmt, fmtK } from "../lib/format";
import { PresentationMode, SimulationResponse } from "../lib/types";

interface ExposureBandProps {
  currentSim: SimulationResponse;
  baselineSim: SimulationResponse;
  mode?: PresentationMode;
}

// Custom animated number hook respecting prefers-reduced-motion
function useAnimatedNumber(target: number, duration: number = 700): number {
  const [val, setVal] = useState(target);
  const currentValRef = React.useRef(target);

  useEffect(() => {
    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReduced) {
      currentValRef.current = target;
      const id = requestAnimationFrame(() => setVal(target));
      return () => cancelAnimationFrame(id);
    }

    const start = currentValRef.current;
    const diff = target - start;
    if (diff === 0) return;

    let startTime: number | null = null;
    let animId: number;

    const step = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const elapsed = timestamp - startTime;
      const progress = Math.min(1, elapsed / duration);
      // Ease-out cubic: 1 - (1 - progress)^3
      const easeProgress = 1 - Math.pow(1 - progress, 3);
      const current = start + diff * easeProgress;
      currentValRef.current = current;
      setVal(current);

      if (progress < 1) {
        animId = requestAnimationFrame(step);
      } else {
        currentValRef.current = target;
        setVal(target);
      }
    };

    animId = requestAnimationFrame(step);
    return () => cancelAnimationFrame(animId);
  }, [target, duration]);

  return val;
}

export const ExposureBand: React.FC<ExposureBandProps> = ({
  currentSim,
  baselineSim,
  mode = "simple",
}) => {
  const animatedExpo = useAnimatedNumber(currentSim.total_ale_point_rounded);
  const animatedSpend = useAnimatedNumber(currentSim.total_spend);

  const deltaExpo = currentSim.total_ale_point - baselineSim.total_ale_point;
  const deltaSpend = currentSim.total_spend - baselineSim.total_spend;

  const isExpoDiff = Math.abs(deltaExpo) > 0.5;
  const expoDeltaPct = baselineSim.total_ale_point > 0
    ? (Math.abs(deltaExpo) / baselineSim.total_ale_point) * 100
    : 0;

  const counts = currentSim.severity_summary.counts;
  const isSimple = mode === "simple";

  return (
    <section
      className="band bg-[var(--ink)] text-[var(--paper)] py-4 sm:py-5 transition-colors border-b border-[var(--line)] shadow-sm"
      aria-live="polite"
    >
      <div className="wrap grid grid-cols-1 md:grid-cols-[1.4fr_1fr_1.6fr] gap-6 sm:gap-7 items-end">
        {/* Estimated Loss Exposure */}
        <div>
          <div className="text-sm opacity-80 flex items-center gap-2 font-medium">
            <span>Estimated yearly loss exposure</span>
            <span
              className="text-[11.5px] font-semibold border border-current rounded-full px-2 py-0.5 opacity-90 cursor-help"
              title="Model estimate based on the sample assumptions shown in Assumptions. Change them to fit your organization."
            >
              Estimate
            </span>
          </div>
          <div className="text-[44px] sm:text-[54px] font-bold leading-none tracking-tight mt-1 text-[var(--paper)]">
            {fmt(animatedExpo)}
          </div>

          <div className="text-[13.5px] opacity-80 mt-1 font-mono">
            {isSimple
              ? `P10–P90: ${fmtK(currentSim.total_ale_range.p10)} – ${fmtK(currentSim.total_ale_range.p90)}`
              : `Likely range ${fmtK(currentSim.total_ale_range.p10)} – ${fmtK(currentSim.total_ale_range.p90)} (P10–P90)`}
          </div>

          <div className="mt-2 min-h-[26px] flex items-center">
            {!isExpoDiff ? (
              <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-white/10 opacity-80">
                Same as today&apos;s setup
              </span>
            ) : (
              <span
                className={`inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1 rounded-full ${
                  deltaExpo < 0
                    ? "bg-[var(--stop)]/20 text-[var(--stop)] border border-[var(--stop)]/40 shadow-[0_0_14px_rgba(0,240,159,0.3)]"
                    : "bg-[var(--miss)]/20 text-[var(--miss)] border border-[var(--miss)]/40 shadow-[0_0_14px_rgba(255,71,87,0.3)]"
                }`}
              >
                <span>{deltaExpo < 0 ? "▼" : "▲"}</span>
                <span>
                  {fmt(Math.abs(deltaExpo))} vs today ({deltaExpo < 0 ? "−" : "+"}
                  {expoDeltaPct.toFixed(1)}%)
                </span>
              </span>
            )}
          </div>
        </div>

        {/* Security Spend */}
        <div>
          <div className="text-sm opacity-80 font-medium">Yearly security spend</div>
          <div className="text-[28px] sm:text-[32px] font-semibold leading-tight mt-1 text-[var(--paper)]">
            {fmt(animatedSpend)}
          </div>
          <div className="mt-2 min-h-[26px] flex items-center">
            {deltaSpend === 0 ? (
              <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-white/10 opacity-80">
                Same as today
              </span>
            ) : (
              <span
                className={`inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1 rounded-full ${
                  deltaSpend < 0
                    ? "bg-[var(--stop)]/20 text-[var(--stop)] border border-[var(--stop)]/40"
                    : "bg-[var(--miss)]/20 text-[var(--miss)] border border-[var(--miss)]/40"
                }`}
              >
                <span>{deltaSpend < 0 ? "▼" : "▲"}</span>
                <span>{fmt(Math.abs(deltaSpend))} vs today</span>
              </span>
            )}
          </div>
        </div>

        {/* Tested Attacks by Severity */}
        <div>
          <div className="text-sm opacity-80 font-medium mb-1.5">Tested attacks by severity</div>
          <div className="flex gap-2 flex-wrap">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/10 text-sm border border-white/5">
              <span className="w-2.5 h-2.5 rounded-full bg-[var(--critical)] inline-block flex-none shadow-[0_0_8px_rgba(255,56,56,0.6)]" />
              <span>Critical</span>
              <b className="text-lg font-bold">{counts.critical}</b>
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/10 text-sm border border-white/5">
              <span className="w-2.5 h-2.5 rounded-full bg-[var(--high)] inline-block flex-none shadow-[0_0_8px_rgba(255,159,26,0.6)]" />
              <span>High</span>
              <b className="text-lg font-bold">{counts.high}</b>
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/10 text-sm border border-white/5">
              <span className="w-2.5 h-2.5 rounded-full bg-[var(--medium)] inline-block flex-none shadow-[0_0_8px_rgba(255,192,72,0.6)]" />
              <span>Medium</span>
              <b className="text-lg font-bold">{counts.medium}</b>
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/10 text-sm border border-white/5">
              <span className="w-2.5 h-2.5 rounded-full bg-[var(--low)] inline-block flex-none shadow-[0_0_8px_rgba(46,213,115,0.6)]" />
              <span>Low</span>
              <b className="text-lg font-bold">{counts.low}</b>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
