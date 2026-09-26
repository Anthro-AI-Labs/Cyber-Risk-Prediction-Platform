"use client";

import React, { useState } from "react";
import { fmtK } from "../lib/format";
import { PresentationMode, Tool } from "../lib/types";
import { ChevronDown, ChevronUp } from "lucide-react";

interface ToolRailProps {
  tools: Tool[];
  activeToolIds: Set<string>;
  onToggleTool: (toolId: string) => void;
  onResetTools: () => void;
  mode?: PresentationMode;
}

export const ToolRail: React.FC<ToolRailProps> = ({
  tools,
  activeToolIds,
  onToggleTool,
  onResetTools,
  mode = "simple",
}) => {
  const [flashingToolId, setFlashingToolId] = useState<string | null>(null);
  const [expandedToolIds, setExpandedToolIds] = useState<Set<string>>(new Set());

  const isSimple = mode === "simple";

  const handleToggle = (id: string) => {
    setFlashingToolId(id);
    onToggleTool(id);
    setTimeout(() => {
      setFlashingToolId((curr) => (curr === id ? null : curr));
    }, 700);
  };

  const toggleExpand = (id: string) => {
    setExpandedToolIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const activeGroup = tools.filter((t) => t.status === "active");
  const ownedGroup = tools.filter((t) => t.status === "owned_not_enabled");
  const candidateGroup = tools.filter((t) => t.status === "candidate");

  const renderToolCard = (tool: Tool) => {
    const isOn = activeToolIds.has(tool.id);
    const isFlashing = flashingToolId === tool.id;
    const isExpanded = !isSimple || expandedToolIds.has(tool.id);

    let tagContent: React.ReactNode = null;
    if (tool.status === "candidate") {
      const isVendor = tool.id === "identity_suite";
      tagContent = (
        <span
          className={`inline-block text-[11px] font-semibold px-2 py-0.5 rounded-full mt-1 border ${
            isVendor
              ? "border-[#8B6CD9] text-[#7B5CD0] dark:border-[#A78BFA] dark:text-[#C4B5FD]"
              : "border-[var(--line)] text-[var(--muted)]"
          }`}
        >
          {isVendor ? "Vendor description — not tested" : "Process change"}
        </span>
      );
    } else if (tool.status === "owned_not_enabled") {
      tagContent = (
        <span className="inline-block text-[11px] font-semibold px-2 py-0.5 rounded-full mt-1 border border-[var(--line)] text-[var(--muted)]">
          Included in your license
        </span>
      );
    } else if (tool.baseline_required) {
      tagContent = (
        <span className="inline-block text-[11px] font-semibold px-2 py-0.5 rounded-full mt-1 border border-[var(--line)] text-[var(--muted)]">
          Required baseline
        </span>
      );
    }

    return (
      <div
        key={tool.id}
        id={`tc-${tool.id}`}
        className={`flex gap-3 items-start p-3 border rounded-[10px] bg-[var(--surface)] mb-2 transition-all duration-200 ${
          isOn
            ? "border-[var(--accent)] shadow-[0_0_12px_rgba(94,124,255,0.18)]"
            : "border-[var(--line)]"
        } ${isFlashing ? "!bg-[var(--accent-soft)]" : ""}`}
      >
        {/* Toggle switch */}
        <label className="switch mt-0.5">
          <input
            type="checkbox"
            checked={isOn}
            onChange={() => handleToggle(tool.id)}
            aria-label={`Toggle ${tool.name}`}
          />
          <span />
        </label>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-1">
            <div className="font-semibold text-[15.5px] leading-snug text-[var(--ink)]">
              {tool.name}
            </div>
            {isSimple && (
              <button
                type="button"
                onClick={() => toggleExpand(tool.id)}
                className="text-[var(--muted)] hover:text-[var(--ink)] p-0.5"
                title={isExpanded ? "Hide details" : "Show details"}
                aria-label={isExpanded ? "Hide details" : "Show details"}
              >
                {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </button>
            )}
          </div>

          {/* Description shown always in Advanced mode, or when expanded in Simple mode */}
          {isExpanded && (
            <div className="text-[13px] text-[var(--muted)] leading-tight mt-1">
              {tool.description}
            </div>
          )}

          {tagContent}
        </div>

        {/* Cost */}
        <div className="font-semibold text-sm whitespace-nowrap text-[var(--ink)]">
          {tool.annual_cost ? fmtK(tool.annual_cost) : "$0"}
        </div>
      </div>
    );
  };

  return (
    <aside className="rail flex flex-col gap-4.5" aria-label="Your security tools">
      {/* You pay for these */}
      <div>
        <h3 className="text-sm text-[var(--muted)] font-semibold mb-2">
          You pay for these
        </h3>
        <div>{activeGroup.map(renderToolCard)}</div>
      </div>

      {/* You already own, but it's switched off */}
      <div>
        <h3 className="text-sm text-[var(--muted)] font-semibold mb-2">
          You already own, but it&apos;s switched off
        </h3>
        <div>{ownedGroup.map(renderToolCard)}</div>
      </div>

      {/* You're considering */}
      <div>
        <h3 className="text-sm text-[var(--muted)] font-semibold mb-2">
          You&apos;re considering
        </h3>
        <div>{candidateGroup.map(renderToolCard)}</div>
      </div>

      <button
        onClick={onResetTools}
        className="text-sm border-0 bg-transparent text-[var(--accent)] hover:underline font-semibold text-left p-0 cursor-pointer"
      >
        Reset to today&apos;s setup
      </button>
    </aside>
  );
};
