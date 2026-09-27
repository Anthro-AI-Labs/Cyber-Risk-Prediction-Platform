"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { Header } from "../components/Header";
import { ExposureBand } from "../components/ExposureBand";
import { ToolRail } from "../components/ToolRail";
import { ChapterBill } from "../components/ChapterBill";
import { ChapterAttacks } from "../components/ChapterAttacks";
import { ChapterReturns } from "../components/ChapterReturns";
import { ChapterWhatIf } from "../components/ChapterWhatIf";
import { ChapterPlan } from "../components/ChapterPlan";
import { AssumptionsDrawer } from "../components/AssumptionsDrawer";
import { Footer } from "../components/Footer";

import {
  TOOLS,
  DEFAULT_ASSUMPTIONS,
  computeRisk,
  computeOptimizer,
  computeWhatIf,
  BASELINE_TOOLS as BASELINE_TOOL_IDS,
  BASELINE_SPEND,
} from "../lib/engine";
import {
  simulateTools,
  updateAssumptionsApi,
  resetAssumptionsApi,
} from "../lib/api";
import { RiskAssumptions, SimulationResponse, OptimizerPlan, WhatIfDiff, PresentationMode } from "../lib/types";
import { useTheme } from "../lib/useTheme";


const CHAPTER_HASHES: Record<number, string> = {
  1: "#bill",
  2: "#attacks",
  3: "#returns",
  4: "#whatif",
  5: "#plan",
};

const HASH_TO_CHAPTER: Record<string, number> = {
  "#bill": 1,
  "#attacks": 2,
  "#returns": 3,
  "#whatif": 4,
  "#plan": 5,
};

export default function HomePage() {
  // State
  const [presentationMode, setPresentationMode] = useState<PresentationMode>("simple");

  useEffect(() => {
    try {
      const stored = localStorage.getItem("cyber_validator_presentation_mode");
      if (stored === "simple" || stored === "advanced") {
        setPresentationMode(stored);
      }
    } catch {}
  }, []);
  const [activeToolIds, setActiveToolIds] = useState<Set<string>>(
    () => new Set(BASELINE_TOOL_IDS)
  );
  const [currentChapter, setCurrentChapter] = useState<number>(1);
  const [visitedChapters, setVisitedChapters] = useState<Set<number>>(
    () => new Set([1])
  );
  const [selectedScenarioId, setSelectedScenarioId] = useState<string>("S1");
  const [assumptions, setAssumptions] = useState<RiskAssumptions>(
    () => JSON.parse(JSON.stringify(DEFAULT_ASSUMPTIONS))
  );
  const [activePreset, setActivePreset] = useState<string | null>(null);
  const [budget, setBudget] = useState<number>(BASELINE_SPEND);
  const [allowRemoveBaseline, setAllowRemoveBaseline] = useState<boolean>(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState<boolean>(false);
  const { isDark, toggleTheme } = useTheme();
  const [isOffline, setIsOffline] = useState<boolean>(false);


  // Mode switcher handler with persistence
  const handleSelectPresentationMode = useCallback((mode: PresentationMode) => {
    setPresentationMode(mode);
    try {
      localStorage.setItem("cyber_validator_presentation_mode", mode);
    } catch {}
  }, []);

  // Synchronize hash on load and popstate
  useEffect(() => {
    const handleHash = () => {
      const hash = window.location.hash;
      if (hash && HASH_TO_CHAPTER[hash]) {
        const ch = HASH_TO_CHAPTER[hash];
        setCurrentChapter(ch);
        setVisitedChapters((prev) => new Set([...prev, ch]));
      }
    };

    handleHash();
    window.addEventListener("hashchange", handleHash);
    return () => window.removeEventListener("hashchange", handleHash);
  }, []);


  // Navigation helper
  const goToChapter = useCallback(
    (ch: number) => {
      if (ch < 1 || ch > 5) return;
      setCurrentChapter(ch);
      setVisitedChapters((prev) => new Set([...prev, ch]));
      if (CHAPTER_HASHES[ch]) {
        window.history.replaceState(null, "", CHAPTER_HASHES[ch]);
      }
      window.scrollTo({ top: 0, behavior: "smooth" });
    },
    []
  );

  // Keyboard navigation: Left/Right arrows
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }
      if (e.key === "ArrowRight") {
        goToChapter(currentChapter + 1);
      } else if (e.key === "ArrowLeft") {
        goToChapter(currentChapter - 1);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [currentChapter, goToChapter]);

  // Pure TS Engine Calculations (Instantaneous)
  const baselineSim: SimulationResponse = useMemo(() => {
    return computeRisk(BASELINE_TOOL_IDS, assumptions);
  }, [assumptions]);

  const currentSim: SimulationResponse = useMemo(() => {
    const toolList = Array.from(activeToolIds);
    return computeRisk(toolList, assumptions);
  }, [activeToolIds, assumptions]);

  const whatIfDiff: WhatIfDiff = useMemo(() => {
    const toolList = Array.from(activeToolIds);
    return computeWhatIf(BASELINE_TOOL_IDS, toolList, assumptions).diff;
  }, [activeToolIds, assumptions]);

  const plan: OptimizerPlan | null = useMemo(() => {
    return computeOptimizer(budget, allowRemoveBaseline, assumptions);
  }, [assumptions, budget, allowRemoveBaseline]);

  // Background API verification (detects offline mode)
  useEffect(() => {
    let active = true;
    simulateTools(Array.from(activeToolIds), assumptions).then((res) => {
      if (active) {
        setIsOffline(res.isOffline);
      }
    });
    return () => {
      active = false;
    };
  }, [activeToolIds, assumptions]);

  // Tool Rail handlers
  const handleToggleTool = useCallback((toolId: string) => {
    setActiveToolIds((prev) => {
      const next = new Set(prev);
      if (next.has(toolId)) {
        next.delete(toolId);
      } else {
        next.add(toolId);
      }
      return next;
    });
    setActivePreset(null);
  }, []);

  const handleResetTools = useCallback(() => {
    setActiveToolIds(new Set(BASELINE_TOOL_IDS));
    setActivePreset(null);
  }, []);

  // What-If preset selector
  const handleSelectPreset = useCallback((presetId: string) => {
    const nextTools = new Set(BASELINE_TOOL_IDS);

    if (presetId === "reset") {
      setActivePreset(null);
      setActiveToolIds(nextTools);
      return;
    }

    setActivePreset(presetId);
    if (presetId === "rmx") {
      nextTools.delete("tool_x");
    } else if (presetId === "rme") {
      nextTools.delete("edr");
    } else if (presetId === "mfa") {
      nextTools.add("mfa_owned");
    } else if (presetId === "ids") {
      nextTools.add("identity_suite");
    } else if (presetId === "pay") {
      nextTools.add("payment_process");
    }
    setActiveToolIds(nextTools);
  }, []);

  // Optimizer Plan handlers
  const handleApplyPlan = useCallback(() => {
    if (plan) {
      setActiveToolIds(new Set(plan.recommended_tools));
      setActivePreset(null);
    }
  }, [plan]);

  const handleRestart = useCallback(() => {
    setActiveToolIds(new Set(BASELINE_TOOL_IDS));
    setActivePreset(null);
    setBudget(BASELINE_SPEND);
    setAllowRemoveBaseline(false);
    setSelectedScenarioId("S1");
    setVisitedChapters(new Set([1]));
    goToChapter(1);
  }, [goToChapter]);

  // Assumptions Handlers
  const handleUpdateAssumptions = useCallback(
    (newAssumptions: RiskAssumptions) => {
      setAssumptions(newAssumptions);
      updateAssumptionsApi(newAssumptions).catch(() => {});
    },
    []
  );

  const handleResetAssumptions = useCallback(() => {
    const resetValues = JSON.parse(JSON.stringify(DEFAULT_ASSUMPTIONS));
    setAssumptions(resetValues);
    resetAssumptionsApi().catch(() => {});
  }, []);

  return (
    <div className="min-h-screen flex flex-col bg-[var(--paper)] text-[var(--ink)]">
      {/* Header with Story Stepper & Controls */}
      <Header
        currentChapter={currentChapter}
        visitedChapters={visitedChapters}
        onSelectChapter={goToChapter}
        onOpenAssumptions={() => setIsDrawerOpen(true)}
        presentationMode={presentationMode}
        onSelectPresentationMode={handleSelectPresentationMode}
        isDark={isDark}
        onToggleTheme={toggleTheme}
        isOffline={isOffline}
      />

      {/* Exposure Band (always visible, top) */}
      <ExposureBand currentSim={currentSim} baselineSim={baselineSim} mode={presentationMode} />

      {/* Main 2-Column Story Experience */}
      <main className="flex-1">
        <div className="wrap grid grid-cols-1 lg:grid-cols-[330px_1fr] gap-7 pt-7 pb-10">
          {/* Left Column: Tool Rail (sticky) */}
          <aside className="rail lg:sticky lg:top-24 self-start flex flex-col gap-4.5" aria-label="Your security tools">
            <ToolRail
              tools={TOOLS}
              activeToolIds={activeToolIds}
              onToggleTool={handleToggleTool}
              onResetTools={handleResetTools}
              mode={presentationMode}
            />
          </aside>

          {/* Right Column: Story Chapters (one active at a time) */}
          <div className="min-w-0">
            {currentChapter === 1 && (
              <ChapterBill onNext={() => goToChapter(2)} mode={presentationMode} />
            )}

            {currentChapter === 2 && (
              <ChapterAttacks
                currentSim={currentSim}
                selectedScenarioId={selectedScenarioId}
                onSelectScenario={setSelectedScenarioId}
                assumptions={assumptions}
                onPrev={() => goToChapter(1)}
                onNext={() => goToChapter(3)}
                mode={presentationMode}
              />
            )}

            {currentChapter === 3 && (
              <ChapterReturns
                currentSim={currentSim}
                onPrev={() => goToChapter(2)}
                onNext={() => goToChapter(4)}
                mode={presentationMode}
              />
            )}

            {currentChapter === 4 && (
              <ChapterWhatIf
                currentSim={currentSim}
                baselineSim={baselineSim}
                whatIfDiff={whatIfDiff}
                activePreset={activePreset}
                onSelectPreset={handleSelectPreset}
                onPrev={() => goToChapter(3)}
                onNext={() => goToChapter(5)}
                mode={presentationMode}
              />
            )}

            {currentChapter === 5 && (
              <ChapterPlan
                plan={plan}
                baselineSim={baselineSim}
                budget={budget}
                onBudgetChange={setBudget}
                allowRemoveBaseline={allowRemoveBaseline}
                onAllowRemoveBaselineChange={setAllowRemoveBaseline}
                onApplyPlan={handleApplyPlan}
                onPrev={() => goToChapter(4)}
                onRestart={handleRestart}
                mode={presentationMode}
              />
            )}
          </div>
        </div>
      </main>

      {/* Footer */}
      <Footer />

      {/* Assumptions Drawer */}
      <AssumptionsDrawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        assumptions={assumptions}
        onUpdateAssumptions={handleUpdateAssumptions}
        onResetAssumptions={handleResetAssumptions}
      />
    </div>
  );
}
