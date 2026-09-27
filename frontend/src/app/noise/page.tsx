"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, BellOff, AlertCircle, Info, ShieldCheck } from "lucide-react";
import { Header } from "../../components/Header";
import { Footer } from "../../components/Footer";
import { NormalDayResponse } from "../../lib/types";
import { fetchNormalDay } from "../../lib/api";
import { useTheme } from "../../lib/useTheme";
import { BASELINE_TOOLS as BASELINE_TOOL_IDS, TOOLS, TOOL_MAP, NOISE_DATA } from "../../lib/engine";
import generated from "../../data/generated.json";

interface NormalDayEvent {
  id: string;
  name: string;
  count: number;
  alerting_tools: string[];
}

// Events and counts come from backend/data/normal_day.json via the generated data.
const NORMAL_EVENTS = ((generated as { normal_day: { event_types: NormalDayEvent[] } }).normal_day.event_types || []).map(
  (ev) => ({
    ...ev,
    alerting_tool_names: ev.alerting_tools.length
      ? ev.alerting_tools.map((id) => TOOL_MAP[id]?.name || id)
      : ["None (benign)"],
  })
);

// Per-tool false-alarm counts (NOISE_DATA is computed from normal_day.json by sync-data).
const TOOL_SUMMARIES = TOOLS.map((t) => {
  const count = NOISE_DATA[t.id] ?? null;
  const events = NORMAL_EVENTS.filter((ev) => ev.alerting_tools.includes(t.id)).map((ev) => ev.name.toLowerCase());
  const note =
    count === null
      ? "Not measured (not owned)"
      : events.length
      ? `Alerts on: ${events.join("; ")}`
      : "Generates no false alarms during normal operations";
  return { id: t.id, name: t.name, count, category: t.category, note };
});

export default function NoisePage() {
  const [data, setData] = useState<NormalDayResponse | null>(null);
  const { isDark, toggleTheme } = useTheme();

  useEffect(() => {
    fetchNormalDay(BASELINE_TOOL_IDS).then((res) => {
      setData(res.data);
    });
  }, []);



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
            <BellOff className="w-8 h-8 text-[var(--high)]" />
            <span>Alert Noise &amp; False Alarm Analysis</span>
          </h1>

          <p className="text-[18px] text-[var(--muted)] mb-8 leading-relaxed">
            Measuring operational alert overhead during a routine workday with zero attacks.
          </p>

          {/* Mandatory Callout */}
          <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-[12px] p-5 mb-8 flex items-start gap-3.5">
            <AlertCircle className="w-6 h-6 text-amber-600 dark:text-amber-400 flex-none mt-0.5" />
            <div>
              <h3 className="font-bold text-base text-amber-900 dark:text-amber-200">
                Every alert here is a false alarm — no attack happened.
              </h3>
              <p className="text-sm text-amber-800 dark:text-amber-300 mt-1 leading-normal">
                This simulation models a completely normal workday. Any security alert raised represents benign business activity flagged by controls. Alert fatigue dilutes security operations focus.
              </p>
            </div>
          </div>

          {/* Noise Total Stat Card */}
          <div className="bg-[var(--surface)] border border-[var(--line)] rounded-[14px] p-6 mb-8 flex items-center justify-between flex-wrap gap-4">
            <div>
              <div className="text-sm font-medium text-[var(--muted)]">
                Total False Alarms per Normal Workday (Baseline)
              </div>
              <div className="text-4xl font-bold font-mono text-[var(--ink)] mt-1">
                {data ? data.total_active_noise : 68} alerts / day
              </div>
              <div className="text-xs text-[var(--muted)] mt-1">
                Across 5 active baseline tools (Tool X responsible for nearly half)
              </div>
            </div>

            <div className="text-right">
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full bg-[var(--soft)] text-[var(--muted)] border border-[var(--line)]">
                <Info className="w-3.5 h-3.5" /> Alert counts are never converted to financial loss
              </span>
            </div>
          </div>

          {/* Per-Tool False Alarm Breakdown */}
          <section className="bg-[var(--surface)] border border-[var(--line)] rounded-[14px] p-6 mb-8">
            <h2 className="text-[20px] font-bold text-[var(--ink)] mb-4">
              False Alarm Count by Security Control
            </h2>

            <div className="divide-y divide-[var(--line)]">
              {TOOL_SUMMARIES.map((tool) => {
                const isBaseline = BASELINE_TOOL_IDS.includes(tool.id);
                return (
                  <div key={tool.id} className="py-3.5 flex items-center justify-between gap-4 flex-wrap">
                    <div className="min-w-[200px]">
                      <div className="font-semibold text-[15.5px] text-[var(--ink)] flex items-center gap-2">
                        <span>{tool.name}</span>
                        {isBaseline && (
                          <span className="text-[11px] font-medium px-2 py-0.2 rounded-full bg-[var(--soft)] text-[var(--muted)]">
                            Active
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-[var(--muted)] mt-0.5">
                        {tool.note}
                      </div>
                    </div>

                    <div className="text-right">
                      {tool.count !== null ? (
                        <div className="font-mono font-bold text-lg text-[var(--ink)]">
                          {tool.count} <span className="text-xs font-normal text-[var(--muted)]">alerts</span>
                        </div>
                      ) : (
                        <div className="text-xs font-medium text-[var(--muted)] italic">
                          Not measured (not owned)
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Event Breakdown Table */}
          <section className="bg-[var(--surface)] border border-[var(--line)] rounded-[14px] p-6 mb-8">
            <h2 className="text-[20px] font-bold text-[var(--ink)] mb-2">
              Normal Workday Event Catalog
            </h2>
            <p className="text-sm text-[var(--muted)] mb-4">
              A catalog of typical employee and administrative actions during an 8-hour workday.
            </p>

            <div className="overflow-x-auto border border-[var(--line)] rounded-[10px]">
              <table className="w-full text-left text-sm">
                <thead className="bg-[var(--soft)] text-[var(--muted)] uppercase text-xs border-b border-[var(--line)]">
                  <tr>
                    <th className="py-2.5 px-3 font-semibold">Event ID</th>
                    <th className="py-2.5 px-3 font-semibold">Routine Business Event</th>
                    <th className="py-2.5 px-3 font-semibold">Daily Occurrences</th>
                    <th className="py-2.5 px-3 font-semibold">Tools Triggering False Alarms</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--line)]">
                  {NORMAL_EVENTS.map((ev) => (
                    <tr key={ev.id} className="hover:bg-[var(--soft)]/50">
                      <td className="py-2.5 px-3 font-mono font-bold text-[var(--muted)]">
                        {ev.id}
                      </td>
                      <td className="py-2.5 px-3 text-[var(--ink)]">
                        {ev.name}
                      </td>
                      <td className="py-2.5 px-3 font-mono font-semibold text-[var(--ink)]">
                        {ev.count}
                      </td>
                      <td className="py-2.5 px-3 text-xs">
                        {ev.alerting_tool_names.map((tName, i) => (
                          <span
                            key={i}
                            className={`inline-block mr-1.5 px-2 py-0.5 rounded-full font-medium ${
                              ev.alerting_tools.length === 0
                                ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                                : "bg-[var(--soft)] text-[var(--ink)]"
                            }`}
                          >
                            {tName}
                          </span>
                        ))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* Key Insight */}
          <div className="bg-[var(--surface)] border border-[var(--line)] rounded-[14px] p-6 text-sm text-[var(--muted)] leading-relaxed space-y-2">
            <h3 className="font-bold text-base text-[var(--ink)] flex items-center gap-2">
              <ShieldCheck className="w-4.5 h-4.5 text-[var(--accent)]" />
              <span>Noise &amp; Return Correlation</span>
            </h3>
            <p>
              In our simulated baseline, <strong>Tool X (Script Control)</strong> generates 31 of the 68 daily false alarms (45.6% of all daily alert noise), while providing $0 in net risk reduction across tested attack scenarios because modern EDR already intercepts unapproved script interpreters.
            </p>
            <p>
              Retiring or tuning low-return controls directly reduces alert fatigue without increasing exposure to tested threats.
            </p>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
