"use client";

import React from "react";
import Link from "next/link";
import { ShieldCheck, Moon, Sun, SlidersHorizontal, WifiOff } from "lucide-react";

interface HeaderProps {
  currentChapter: number;
  visitedChapters: Set<number>;
  onSelectChapter: (ch: number) => void;
  onOpenAssumptions: () => void;
  isDark: boolean;
  onToggleTheme: () => void;
  isOffline?: boolean;
  presentationMode?: "simple" | "advanced";
  onSelectPresentationMode?: (mode: "simple" | "advanced") => void;
}

const CHAPTERS = [
  { n: 1, name: "The bill", hash: "#bill" },
  { n: 2, name: "The attacks", hash: "#attacks" },
  { n: 3, name: "Tool returns", hash: "#returns" },
  { n: 4, name: "What if", hash: "#whatif" },
  { n: 5, name: "Best plan", hash: "#plan" },
];

export const Header: React.FC<HeaderProps> = ({
  currentChapter,
  visitedChapters,
  onSelectChapter,
  onOpenAssumptions,
  isDark,
  onToggleTheme,
  isOffline,
  presentationMode = "simple",
  onSelectPresentationMode,
}) => {
  return (
    <header className="bg-[var(--surface)] border-b border-[var(--line)] sticky top-0 z-20 transition-colors shadow-xs">
      <div className="wrap flex items-center justify-between min-h-[64px] py-2 gap-4 flex-wrap">
        {/* Brand */}
        <div className="flex items-center gap-2.5 font-bold text-lg whitespace-nowrap">
          <div className="w-[30px] h-[30px] rounded-lg bg-[var(--ink)] flex items-center justify-center text-[var(--surface)] shadow-sm">
            <ShieldCheck className="w-[18px] h-[18px]" strokeWidth={2.4} />
          </div>
          <Link href="/" className="hover:opacity-90 transition-opacity">
            ROI Cyber-Validator
          </Link>
          {isOffline && (
            <span className="flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-300 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-700 ml-2">
              <WifiOff className="w-3 h-3" /> Offline mode
            </span>
          )}
        </div>

        {/* Story Stepper */}
        <nav className="flex items-center gap-1 flex-1 justify-center flex-wrap" aria-label="Story chapters">
          {CHAPTERS.map((ch) => {
            const isCurrent = currentChapter === ch.n;
            const isVisited = visitedChapters.has(ch.n);

            return (
              <button
                key={ch.n}
                onClick={() => onSelectChapter(ch.n)}
                aria-current={isCurrent ? "step" : undefined}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-[15px] font-medium transition-all ${
                  isCurrent
                    ? "bg-[var(--ink)] text-[var(--surface)] shadow-sm font-semibold"
                    : isVisited
                    ? "text-[var(--ink)] hover:bg-[var(--soft)]"
                    : "text-[var(--muted)] hover:bg-[var(--soft)]"
                }`}
              >
                <span
                  className={`w-[22px] h-[22px] rounded-full border-[1.5px] flex items-center justify-center text-xs font-semibold ${
                    isCurrent
                      ? "border-[var(--surface)] text-[var(--surface)]"
                      : "border-current"
                  }`}
                >
                  {ch.n}
                </span>
                <span className="hidden sm:inline">{ch.name}</span>
              </button>
            );
          })}
        </nav>

        {/* Actions: Presentation Mode [ Simple | Advanced ] + Assumptions + Light/Dark */}
        <div className="flex items-center gap-2.5 flex-wrap">
          {/* Global Mode Toggle [ Simple | Advanced ] */}
          {onSelectPresentationMode && (
            <div
              className="flex items-center p-0.5 bg-[var(--soft)] border border-[var(--line)] rounded-full text-xs font-semibold"
              role="group"
              aria-label="Presentation Mode"
            >
              <button
                id="mode-simple-btn"
                onClick={() => onSelectPresentationMode("simple")}
                aria-pressed={presentationMode === "simple"}
                className={`px-3 py-1 rounded-full transition-all flex items-center gap-1.5 cursor-pointer ${
                  presentationMode === "simple"
                    ? "bg-[var(--accent)] text-white font-bold"
                    : "text-[var(--muted)] hover:text-[var(--ink)]"
                }`}
              >
                Simple
              </button>
              <button
                id="mode-advanced-btn"
                onClick={() => onSelectPresentationMode("advanced")}
                aria-pressed={presentationMode === "advanced"}
                className={`px-3 py-1 rounded-full transition-all flex items-center gap-1.5 cursor-pointer ${
                  presentationMode === "advanced"
                    ? "bg-[var(--accent)] text-white font-bold"
                    : "text-[var(--muted)] hover:text-[var(--ink)]"
                }`}
              >
                Advanced
              </button>
            </div>
          )}

          <button
            onClick={onOpenAssumptions}
            className="flex items-center gap-1.5 border border-[var(--line)] bg-[var(--surface)] hover:bg-[var(--soft)] px-3 py-1.5 rounded-full text-sm font-medium text-[var(--ink)] transition-colors"
          >
            <SlidersHorizontal className="w-3.5 h-3.5 text-[var(--muted)]" />
            <span>Assumptions</span>
          </button>

          <button
            onClick={onToggleTheme}
            aria-label="Switch light or dark theme"
            className="flex items-center gap-1.5 border border-[var(--line)] bg-[var(--surface)] hover:bg-[var(--soft)] px-3 py-1.5 rounded-full text-sm font-medium text-[var(--ink)] transition-colors"
          >
            {isDark ? <Sun className="w-3.5 h-3.5 text-amber-400" /> : <Moon className="w-3.5 h-3.5 text-[var(--muted)]" />}
            <span className="hidden md:inline">{isDark ? "Light" : "Dark"}</span>
          </button>
        </div>
      </div>
    </header>
  );
};
