"use client";

import React, { useState, useEffect, useRef } from "react";
import { ArrowLeft, ArrowRight, RotateCcw, Bot } from "lucide-react";
import { fmt, pctS, SEVERITY_CONFIG, OUTCOME_CONFIG } from "../lib/format";
import { SimulationResponse, RiskAssumptions, AgentNarrativeStep, PresentationMode } from "../lib/types";
import { SCENARIOS, TOOL_MAP, TECHNIQUES } from "../lib/engine";
import { narrateScenario } from "../lib/api";

interface ChapterAttacksProps {
  currentSim: SimulationResponse;
  selectedScenarioId: string;
  onSelectScenario: (id: string) => void;
  assumptions: RiskAssumptions;
  onPrev: () => void;
  onNext: () => void;
  mode?: PresentationMode;
}

const SCENARIO_GOALS: Record<string, string> = {
  S1: "the attacker reads the employee's email",
  S2: "the attacker signs in as an employee",
  S3: "a customer pays a fake invoice",
  S4: "company files are locked for ransom",
};

export const ChapterAttacks: React.FC<ChapterAttacksProps> = ({
  currentSim,
  selectedScenarioId,
  onSelectScenario,
  assumptions,
  onPrev,
  onNext,
  mode = "simple",
}) => {
  const isSimple = mode === "simple";
  const [revealedStepCount, setRevealedStepCount] = useState<number>(0);
  const [currentStepIndex, setCurrentStepIndex] = useState<number | null>(null);
  const [narrativeSteps, setNarrativeSteps] = useState<AgentNarrativeStep[]>([]);
  const [agentMode, setAgentMode] = useState<string>("heuristic");

  const scenario = SCENARIOS.find((s) => s.id === selectedScenarioId) || SCENARIOS[0];
  const scenRisk = currentSim.scenarios[selectedScenarioId] || currentSim.scenarios["S1"];
  const scenAssump = assumptions.scenarios[selectedScenarioId];

  // Load narrative steps
  useEffect(() => {
    let active = true;
    narrateScenario(selectedScenarioId, currentSim.active_tool_ids).then((res) => {
      if (active && res.data) {
        setNarrativeSteps(res.data.steps || []);
        setAgentMode(res.data.mode || "heuristic");
      }
    });
    return () => {
      active = false;
    };
  }, [selectedScenarioId, currentSim.active_tool_ids]);

  // Orchestrated sequential animation (650ms per step)
  const animTimerRef = useRef<NodeJS.Timeout | null>(null);

  const startAnimation = React.useCallback(() => {
    if (animTimerRef.current) clearTimeout(animTimerRef.current);

    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReduced) {
      setRevealedStepCount(scenario.steps.length);
      setCurrentStepIndex(null);
      return;
    }

    setRevealedStepCount(0);
    setCurrentStepIndex(0);

    let idx = 0;
    const total = scenario.steps.length;

    const tick = () => {
      if (idx < total) {
        setCurrentStepIndex(idx);
        idx++;
        setRevealedStepCount(idx);
        animTimerRef.current = setTimeout(tick, 650);
      } else {
        setCurrentStepIndex(null);
      }
    };

    tick();
  }, [scenario.steps.length]);

  useEffect(() => {
    const startTimer = setTimeout(() => {
      startAnimation();
    }, 0);
    return () => {
      clearTimeout(startTimer);
      if (animTimerRef.current) clearTimeout(animTimerRef.current);
    };
  }, [selectedScenarioId, currentSim.active_tool_ids, startAnimation]);

  const sevCfg = SEVERITY_CONFIG[scenRisk.severity] || SEVERITY_CONFIG.medium;
  const isFinishedRevealing = revealedStepCount >= scenario.steps.length;

  // Calculation multiplication breakdown
  const factors = scenRisk.steps.map((st) => {
    const prob = assumptions.step_pass_probability[st.outcome];
    return prob.toFixed(2);
  });

  return (
    <section className="chap active">
      <h1 className="text-[34px] leading-[1.15] tracking-tight font-bold mb-2.5 max-w-[30ch] text-[var(--ink)]">
        Four attacks against your setup
      </h1>
      <p className="text-[19px] text-[var(--muted)] max-w-[62ch] mb-5 leading-relaxed">
        Pick an attack and watch it move through your defenses. Click any step to see the evidence behind it.
      </p>

      {/* Scenario Tabs */}
      <div className="tabs flex gap-2 flex-wrap mb-5" role="tablist">
        {SCENARIOS.map((sc) => {
          const isSelected = sc.id === selectedScenarioId;
          const sRisk = currentSim.scenarios[sc.id];
          const scSevCfg = SEVERITY_CONFIG[sRisk?.severity || "low"];

          return (
            <button
              key={sc.id}
              role="tab"
              aria-selected={isSelected}
              onClick={() => onSelectScenario(sc.id)}
              className={`border rounded-[10px] p-2.5 sm:px-3.5 sm:py-2.5 text-left flex gap-2.5 items-center min-w-[180px] bg-[var(--surface)] transition-all ${
                isSelected
                  ? "border-[var(--accent)] ring-1 ring-[var(--accent)] shadow-[0_0_12px_rgba(94,124,255,0.3)] font-semibold"
                  : "border-[var(--line)] hover:border-[var(--muted)]"
              }`}
            >
              <span className={`w-2.5 h-2.5 rounded-full flex-none ${scSevCfg.dotClass}`} />
              <div>
                <div className="font-semibold text-[15.5px] leading-tight text-[var(--ink)]">
                  {sc.name}
                </div>
                <div className="text-[13px] text-[var(--muted)] mt-0.5">
                  {scSevCfg.label} · {pctS(sRisk?.probability || 0)} chance
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Grid: Attack Chain (Left) and Sticky Side Card (Right) */}
      <div className="scgrid grid grid-cols-1 lg:grid-cols-[1fr_330px] gap-5 items-start">
        {/* Left: Vertical Step Chain */}
        <div>
          <div className="chain relative pl-1">
            {scenario.steps.map((st, i) => {
              const evaluatedStep = scenRisk.steps[i] || {
                order: st.order,
                technique_id: st.technique_id,
                technique_name: st.technique_name,
                step: st.step,
                outcome: "missed",
                stopping_tools: [],
                detecting_tools: [],
                open_routes: [],
                evidence: [],
              };

              const isRevealed = i < revealedStepCount;
              const isCurrent = i === currentStepIndex;

              const outCfg = OUTCOME_CONFIG[evaluatedStep.outcome] || OUTCOME_CONFIG.missed;

              // Generate who line
              let whoLine = "";
              if (evaluatedStep.outcome === "stopped") {
                const stopNames = evaluatedStep.stopping_tools.map((tid) => TOOL_MAP[tid]?.short || tid);
                whoLine = `Blocked by ${stopNames.join(" and ")}`;
              } else if (evaluatedStep.outcome === "detected") {
                const detNames = evaluatedStep.detecting_tools.map((tid) => TOOL_MAP[tid]?.short || tid);
                whoLine = `Seen by ${detNames.join(" and ")}, but the attacker continues`;
              } else if (evaluatedStep.outcome === "missed") {
                if (evaluatedStep.detecting_tools.length > 0) {
                  const detNames = evaluatedStep.detecting_tools.map((tid) => TOOL_MAP[tid]?.short || tid);
                  whoLine = `${detNames.join(" and ")} covers one route, but the attacker can still use another`;
                } else {
                  whoLine = "None of your tools reacts to this step";
                }
              } else {
                whoLine = "This attack starts after an account is already taken over";
              }

              const allTechIds = [st.technique_id, ...st.alternative_techniques.map((a) => a.id)];

              return (
                <div
                  key={st.order}
                  className="step grid grid-cols-[44px_1fr] gap-3.5 relative pb-3.5"
                >
                  {/* Vertical connector line */}
                  {i < scenario.steps.length - 1 && (
                    <div className="absolute left-[21px] top-[44px] bottom-0 w-[2px] bg-[var(--line)]" />
                  )}

                  {/* Node Circle */}
                  <div
                    className={`node w-11 h-11 rounded-full flex items-center justify-center font-bold text-[15px] border-2 transition-all duration-300 z-1 ${
                      isRevealed
                        ? outCfg.nodeClass
                        : "border-[var(--line)] bg-[var(--surface)] text-[var(--muted)]"
                    }`}
                    aria-hidden="true"
                  >
                    {st.order}
                  </div>

                  {/* Step Body */}
                  <div
                    className={`body bg-[var(--surface)] border border-[var(--line)] rounded-[10px] px-3.5 py-3 transition-all duration-300 ${
                      !isRevealed ? "opacity-45" : ""
                    } ${isCurrent ? "!border-[var(--ink)] shadow-[0_0_0_3px_var(--accent-soft)]" : ""}`}
                  >
                    <div className="txt font-medium text-[16px] text-[var(--ink)]">
                      {st.step}
                    </div>

                    {isRevealed && (
                      <div className="res flex gap-2.5 items-center mt-1.5 flex-wrap text-[14.5px]">
                        <span className={`badge ${outCfg.badgeClass}`}>
                          {outCfg.icon} {outCfg.label}
                        </span>
                        <span className="who text-[var(--muted)]">{whoLine}</span>
                      </div>
                    )}

                    {/* Expandable Evidence and Attacker Routes */}
                    {isRevealed && evaluatedStep.outcome !== "starting_condition" && (
                      <details className="ev mt-2 text-sm">
                        <summary className="cursor-pointer text-[var(--accent)] font-medium list-none outline-none">
                          Evidence and attacker routes
                        </summary>
                        <ul className="mt-2 pl-4 list-disc text-[var(--muted)] space-y-1">
                          {allTechIds.map((tid) => {
                            const isAlt = tid !== st.technique_id;
                            const techObj = TECHNIQUES[tid];
                            const tName = techObj?.name || tid;
                            const tUrl = techObj?.url || `https://attack.mitre.org/techniques/${tid}`;
                            const isStillOpen = evaluatedStep.open_routes.includes(tid);
                            const evidences = evaluatedStep.evidence.filter((e) => e.technique_id === tid);

                            return (
                              <li key={tid}>
                                <a
                                  href={tUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="font-medium underline hover:text-[var(--ink)]"
                                >
                                  {tid} {tName}
                                </a>
                                {isAlt && " (alternative route)"} —{" "}
                                {evidences.length > 0 ? (
                                  evidences.map((e, idx) => (
                                    <React.Fragment key={idx}>
                                      {idx > 0 && "; "}
                                      {TOOL_MAP[e.tool_id]?.short || e.tool_id}{" "}
                                      {e.effect === "stop" ? "blocks" : "detects"} it.{" "}
                                      {e.evidence_type === "ctid_mapping" ? (
                                        e.ctid_support?.map((c, cIdx) => (
                                          <span key={cIdx}>
                                            {cIdx > 0 && " · "}
                                            <b>CTID M365:</b> {c.capability || c.capability_id} — protect, {c.score_value}
                                          </span>
                                        ))
                                      ) : (
                                        <>
                                          {e.evidence_label}
                                          {e.ctid_support && e.ctid_support.length > 0 && (
                                            <>
                                              {" · "}
                                              {e.ctid_support.map((c, cIdx) => (
                                                <span key={cIdx}>
                                                  {cIdx > 0 && " · "}
                                                  <b>CTID M365:</b> {c.capability || c.capability_id} — protect, {c.score_value}
                                                </span>
                                              ))}
                                            </>
                                          )}
                                        </>
                                      )}
                                    </React.Fragment>
                                  ))
                                ) : (
                                  "no tool covers it"
                                )}
                                {isStillOpen ? " · still open" : ""}
                              </li>
                            );
                          })}
                        </ul>
                      </details>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Goal Box (Shown after all steps revealed) */}
          {isFinishedRevealing && (
            <div className="goal flex gap-2.5 items-center p-3 sm:px-3.5 sm:py-3 rounded-[10px] border border-dashed border-[var(--line)] ml-14 font-semibold text-[var(--ink)] mt-2 bg-[var(--surface)]">
              <span className={`w-2.5 h-2.5 rounded-full flex-none ${sevCfg.dotClass}`} />
              <span>
                If every step works: {SCENARIO_GOALS[selectedScenarioId] || "attack succeeds"}
              </span>
            </div>
          )}

          {/* Replay Button */}
          <div className="mt-3.5 flex gap-2.5 flex-wrap">
            <button
              onClick={startAnimation}
              className="flex items-center gap-1.5 border border-[var(--line)] bg-[var(--surface)] hover:bg-[var(--soft)] px-3.5 py-2 rounded-full text-sm font-medium text-[var(--ink)] transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Replay attack</span>
            </button>
          </div>
        </div>

        {/* Right: Sticky Side Card with Math & Attacker View */}
        <div className="side">
          <div className="card bg-[var(--surface)] border border-[var(--line)] rounded-[14px] p-[22px] sticky top-24">
            <div className="text-[var(--muted)] text-sm flex items-center gap-1.5">
              <span>Chance this attack succeeds</span>
              <span className="text-[11.5px] font-semibold border border-current rounded-full px-2 py-0.5">
                Estimate
              </span>
            </div>

            <div className="flex items-center gap-3 my-2 mb-3.5">
              <div className="text-[44px] font-bold leading-none tracking-tight text-[var(--ink)]">
                {pctS(scenRisk.probability)}
              </div>
              <span
                className={`inline-flex items-center gap-1.5 font-bold text-sm px-3 py-1 rounded-full ${sevCfg.pillClass}`}
              >
                {sevCfg.label}
              </span>
            </div>

            <div className="kv flex justify-between gap-2 py-3 border-t border-[var(--line)] text-[15.5px]">
              <span className="text-[var(--muted)]">Blocked steps</span>
              <b className="text-[var(--ink)]">
                {scenRisk.stopping_points} of{" "}
                {scenRisk.steps.filter((s) => s.outcome !== "starting_condition").length}
              </b>
            </div>

            <div className="kv flex justify-between gap-2 py-3 border-t border-[var(--line)] text-[15.5px]">
              <span className="text-[var(--muted)]">Tries per year</span>
              <b className="text-[var(--ink)]">{scenAssump?.attempts_per_year.likely}</b>
            </div>

            <div className="kv flex justify-between gap-2 py-3 border-t border-[var(--line)] text-[15.5px]">
              <span className="text-[var(--muted)]">Cost if it succeeds</span>
              <b className="text-[var(--ink)]">{fmt(scenAssump?.loss_per_success.likely || 0)}</b>
            </div>

            <div className="kv flex justify-between gap-2 py-3 border-t border-[var(--line)] text-[15.5px]">
              <span className="text-[var(--muted)]">Estimated yearly loss</span>
              <b className="text-[var(--ink)]">{fmt(scenRisk.ale_point)}</b>
            </div>

            {/* Expander: How we calculated this */}
            <details className="ev mt-3 text-sm">
              <summary className="cursor-pointer text-[var(--accent)] font-medium list-none outline-none">
                How we calculated this
              </summary>
              <div className="math text-sm text-[var(--muted)] bg-[var(--soft)] rounded-md p-3 mt-2 leading-relaxed font-mono">
                <div>
                  Each blocked step leaves a {Math.round(assumptions.step_pass_probability.stopped * 100)}% chance to get past (controls can fail), a seen step {Math.round(assumptions.step_pass_probability.detected * 100)}%, an uncovered step {Math.round(assumptions.step_pass_probability.missed * 100)}%.
                </div>
                <div className="mt-2 text-[var(--ink)] font-semibold">
                  Chance = {factors.join(" × ")} = {pctS(scenRisk.probability)}
                </div>
                <div className="mt-1 text-[var(--ink)] font-semibold">
                  Yearly loss = {scenAssump?.attempts_per_year.likely} tries × {pctS(scenRisk.probability)} × {fmt(scenAssump?.loss_per_success.likely || 0)} = {fmt(scenRisk.ale_point)}
                </div>
              </div>
            </details>

            {/* Expander: Attacker's view (AI Attacker Agent safe virtual simulation) */}
            <details className="ev mt-3 text-sm" open={!isSimple}>
              <summary className="cursor-pointer text-[var(--accent)] font-medium list-none outline-none flex items-center gap-1.5 hover:underline">
                <Bot className="w-3.5 h-3.5 inline" />
                <span>Attacker&apos;s view (virtual path simulation)</span>
              </summary>
              <div className="mt-2 p-3 bg-[var(--soft)] rounded-md text-xs leading-relaxed text-[var(--ink)]">
                <div className="mb-2">
                  <span data-mode={agentMode} className="inline-block text-[11px] font-semibold px-2.5 py-1 rounded-full bg-[var(--accent-soft)] text-[var(--accent)] border border-[var(--accent)]/30">
                    AI attack simulation — results computed by the rule engine
                  </span>
                </div>
                {narrativeSteps.length > 0 ? (
                  <div className="space-y-1.5">
                    {narrativeSteps.map((ns) => (
                      <div key={ns.order} className="border-l-2 border-[var(--accent)] pl-2 py-0.5">
                        <span className="font-semibold">Step {ns.order}:</span> {ns.narration}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-[var(--muted)]">Generating safe virtual path narrative…</p>
                )}
              </div>
            </details>
          </div>
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
          onClick={onNext}
          className="btn-neon-primary flex items-center gap-2 bg-[var(--accent)] text-white font-semibold text-[16.5px] px-6 py-3.5 rounded-full transition-all shadow-[0_0_14px_rgba(94,124,255,0.3)] hover:shadow-[0_0_22px_rgba(94,124,255,0.55)] cursor-pointer"
        >
          <span>See what each tool returns</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </section>
  );
};
