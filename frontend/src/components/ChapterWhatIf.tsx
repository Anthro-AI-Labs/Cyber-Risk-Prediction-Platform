"use client";

import React from "react";
import { ArrowLeft, ArrowRight, Sparkles } from "lucide-react";
import { fmt, fmtK } from "../lib/format";
import { PresentationMode, SimulationResponse, WhatIfDiff } from "../lib/types";

interface ChapterWhatIfProps {
  currentSim: SimulationResponse;
  baselineSim: SimulationResponse;
  whatIfDiff: WhatIfDiff;
  activePreset: string | null;
  onSelectPreset: (presetId: string) => void;
  onPrev: () => void;
  onNext: () => void;
  mode?: PresentationMode;
}

const PRESETS = [
  { id: "rmx", label: "Remove Tool X" },
  { id: "rme", label: "Remove EDR" },
  { id: "mfa", label: "Switch on MFA you own" },
  { id: "ids", label: "Buy the Identity Suite" },
  { id: "pay", label: "Add payment check by phone" },
];

export const ChapterWhatIf: React.FC<ChapterWhatIfProps> = ({
  currentSim,
  baselineSim,
  whatIfDiff,
  activePreset,
  onSelectPreset,
  onPrev,
  onNext,
  mode = "advanced",
}) => {
  const isSimple = mode === "simple";
  const aleDelta = baselineSim.total_ale_point - currentSim.total_ale_point;
  const spendDelta = currentSim.total_spend - baselineSim.total_spend;

  return (
    <section className="chap active">
      <h1 className="text-[34px] leading-[1.15] tracking-tight font-bold mb-2.5 max-w-[30ch] text-[var(--ink)]">
        What if you changed one thing?
      </h1>
      <p className="text-[19px] text-[var(--muted)] max-w-[62ch] mb-5 leading-relaxed">
        Try a change below, or flip any switch on the left. Everything recalculates instantly.
      </p>

      {/* Preset Chips */}
      <div className="presets flex gap-2.5 flex-wrap mb-5" role="group" aria-label="What-if presets">
        {PRESETS.map((p) => {
          const isActive = activePreset === p.id;
          return (
            <button
              key={p.id}
              onClick={() => onSelectPreset(p.id)}
              className={`border rounded-full px-4 py-2 font-medium text-[15.5px] transition-all cursor-pointer ${
                isActive
                  ? "bg-[var(--accent)] text-white border-[var(--accent)] shadow-[0_0_14px_rgba(94,124,255,0.4)]"
                  : "bg-[var(--surface)] border-[var(--line)] text-[var(--ink)] hover:border-[var(--accent)]"
              }`}
            >
              {p.label}
            </button>
          );
        })}
        <button
          onClick={() => onSelectPreset("reset")}
          className="border border-[var(--line)] bg-[var(--surface)] text-[var(--ink)] hover:border-[var(--accent)] rounded-full px-4 py-2 font-medium text-[15.5px] transition-all cursor-pointer"
        >
          Back to today
        </button>
      </div>

      {isSimple ? (
        /* SIMPLE MODE: CURRENT -> WHAT IF? -> NEW RESULT Flow */
        <div className="space-y-4 mb-5">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 items-stretch">
            {/* 1. CURRENT */}
            <div className="card bg-[var(--surface)] border border-[var(--line)] rounded-[14px] p-5 flex flex-col justify-between">
              <div>
                <span className="text-xs uppercase font-bold tracking-wider text-[var(--muted)] block mb-1">
                  1. CURRENT (BASELINE)
                </span>
                <div className="text-[32px] font-bold text-[var(--ink)] tracking-tight leading-tight mt-1">
                  {fmt(baselineSim.total_ale_point)}
                </div>
                <div className="text-xs text-[var(--muted)] mt-0.5">estimated annual risk</div>
              </div>
              <div className="mt-4 pt-3 border-t border-[var(--line)] flex justify-between text-sm">
                <span className="text-[var(--muted)]">Annual Spend</span>
                <b className="text-[var(--ink)]">{fmt(baselineSim.total_spend)}</b>
              </div>
            </div>

            {/* 2. WHAT IF? */}
            <div className="card bg-[var(--surface)] border-2 border-[var(--accent)]/50 shadow-[0_0_16px_rgba(94,124,255,0.15)] rounded-[14px] p-5 flex flex-col justify-between text-center relative overflow-hidden">
              <div className="flex items-center justify-center gap-1.5 text-xs uppercase font-bold tracking-wider text-[var(--accent)] mb-1">
                <Sparkles className="w-3.5 h-3.5" />
                <span>2. WHAT IF?</span>
              </div>
              <div className="py-2 my-auto">
                <div className="text-[17px] font-semibold text-[var(--ink)]">
                  {activePreset
                    ? PRESETS.find((p) => p.id === activePreset)?.label || "Custom Switch"
                    : "Live Tool Adjustment"}
                </div>
                <div className="text-xs text-[var(--muted)] mt-1">
                  {whatIfDiff.change_sentences.length > 0
                    ? `${whatIfDiff.change_sentences.length} operational effect(s)`
                    : "No switches toggled"}
                </div>
              </div>
              <div className="mt-4 pt-3 border-t border-[var(--line)] flex justify-around text-xs text-[var(--muted)]">
                <span>Spend Δ: {spendDelta === 0 ? "$0" : (spendDelta > 0 ? `+${fmtK(spendDelta)}` : fmtK(spendDelta))}</span>
              </div>
            </div>

            {/* 3. NEW RESULT */}
            <div className={`card bg-[var(--surface)] border rounded-[14px] p-5 flex flex-col justify-between ${
              aleDelta > 0
                ? "border-[var(--stop)]/60 shadow-[0_0_16px_rgba(0,240,159,0.15)]"
                : aleDelta < 0
                ? "border-[var(--miss)]/60 shadow-[0_0_16px_rgba(255,71,87,0.15)]"
                : "border-[var(--line)]"
            }`}>
              <div>
                <span className="text-xs uppercase font-bold tracking-wider text-[var(--muted)] block mb-1">
                  3. NEW RESULT
                </span>
                <div className="text-[32px] font-bold text-[var(--ink)] tracking-tight leading-tight mt-1 flex items-baseline gap-2">
                  <span>{fmt(currentSim.total_ale_point)}</span>
                </div>
                <div className="text-xs text-[var(--muted)] mt-0.5">estimated annual risk</div>
              </div>
              <div className="mt-4 pt-3 border-t border-[var(--line)] flex justify-between text-sm">
                <span className="text-[var(--muted)]">Risk Change</span>
                <b className={`font-semibold ${aleDelta > 0 ? "text-[var(--stop)]" : aleDelta < 0 ? "text-[var(--miss)]" : "text-[var(--ink)]"}`}>
                  {aleDelta > 0 ? `−${fmt(aleDelta)}` : aleDelta < 0 ? `+${fmt(Math.abs(aleDelta))}` : "$0"}
                </b>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* ADVANCED MODE: Side-by-side Full Comparison Cards */
        <div className="cmp grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          {/* Today */}
          <div className="card bg-[var(--surface)] border border-[var(--line)] rounded-[14px] p-[22px]">
            <h4 className="text-[15px] text-[var(--muted)] font-semibold mb-1">Today</h4>
            <div className="text-[30px] font-semibold text-[var(--ink)] mt-1.5 leading-tight">
              {fmt(baselineSim.total_ale_point)}
            </div>
            <div className="text-sm text-[var(--muted)] flex items-center gap-1.5 mt-0.5">
              <span>estimated yearly loss</span>
              <span className="text-[11.5px] font-semibold border border-current rounded-full px-2 py-0.5">
                Estimate
              </span>
            </div>

            <div className="kv flex justify-between gap-2 py-3 border-t border-[var(--line)] text-[15.5px] mt-3">
              <span className="text-[var(--muted)]">Yearly spend</span>
              <b className="text-[var(--ink)]">{fmt(baselineSim.total_spend)}</b>
            </div>
            <div className="kv flex justify-between gap-2 py-3 border-t border-[var(--line)] text-[15.5px]">
              <span className="text-[var(--muted)]">False alarms per normal day</span>
              <b className="text-[var(--ink)]">{baselineSim.total_noise}</b>
            </div>
          </div>

          {/* With your changes */}
          <div className="card bg-[var(--surface)] border border-[var(--line)] rounded-[14px] p-[22px]">
            <h4 className="text-[15px] text-[var(--muted)] font-semibold mb-1">With your changes</h4>
            <div className="text-[30px] font-semibold text-[var(--ink)] mt-1.5 leading-tight">
              {fmt(currentSim.total_ale_point)}
            </div>
            <div className="text-sm text-[var(--muted)] flex items-center gap-1.5 mt-0.5">
              <span>estimated yearly loss</span>
              <span className="text-[11.5px] font-semibold border border-current rounded-full px-2 py-0.5">
                Estimate
              </span>
            </div>

            <div className="kv flex justify-between gap-2 py-3 border-t border-[var(--line)] text-[15.5px] mt-3">
              <span className="text-[var(--muted)]">Yearly spend</span>
              <b className="text-[var(--ink)]">{fmt(currentSim.total_spend)}</b>
            </div>
            <div className="kv flex justify-between gap-2 py-3 border-t border-[var(--line)] text-[15.5px]">
              <span className="text-[var(--muted)]">False alarms per normal day</span>
              <b className="text-[var(--ink)]">{currentSim.total_noise}</b>
            </div>
          </div>
        </div>
      )}

      {/* What Changed Section */}
      <div className="card bg-[var(--surface)] border border-[var(--line)] rounded-[14px] p-[22px]">
        <h4 className="text-[17px] font-semibold mb-2 text-[var(--ink)]">What changed</h4>
        <ul className="changes list-none p-0 m-0">
          {whatIfDiff.change_sentences.length > 0 ? (
            whatIfDiff.change_sentences.map((sent, i) => {
              const isGood = sent.startsWith("+") || sent.includes("▼");
              const isBad = sent.startsWith("−") || sent.includes("▲");
              const arrow = sent.startsWith("−") ? "−" : sent.startsWith("+") ? "+" : "=";
              const color = isGood
                ? "text-[var(--stop)]"
                : isBad
                ? "text-[var(--miss)]"
                : "text-[var(--muted)]";

              return (
                <li
                  key={i}
                  className="flex gap-3 items-start py-3 border-t border-[var(--line)] first:border-t-0 text-[16px] text-[var(--ink)]"
                >
                  <span className={`font-bold ${color}`}>{arrow}</span>
                  <span dangerouslySetInnerHTML={{ __html: sent }} />
                </li>
              );
            })
          ) : (
            <li className="text-[var(--muted)] text-[16px] py-2">
              Nothing changed yet. Pick a change above or flip a switch on the left.
            </li>
          )}
        </ul>
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
          onClick={onNext}
          className="btn-neon-primary flex items-center gap-2 font-semibold text-[16.5px] px-6 py-3.5 rounded-full transition-all cursor-pointer"
        >
          <span>Find the best plan</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </section>
  );
};

