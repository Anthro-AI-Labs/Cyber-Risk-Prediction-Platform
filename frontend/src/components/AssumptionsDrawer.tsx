"use client";

import React, { useEffect } from "react";
import { X, RotateCcw } from "lucide-react";
import { RiskAssumptions } from "../lib/types";
import { SCENARIOS } from "../lib/engine";

interface AssumptionsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  assumptions: RiskAssumptions;
  onUpdateAssumptions: (newAssumptions: RiskAssumptions) => void;
  onResetAssumptions: () => void;
}

export const AssumptionsDrawer: React.FC<AssumptionsDrawerProps> = ({
  isOpen,
  onClose,
  assumptions,
  onUpdateAssumptions,
  onResetAssumptions,
}) => {
  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  const handlePassProbChange = (field: "stopped" | "detected" | "missed", val: number) => {
    if (isNaN(val) || val < 0 || val > 1) return;
    const updated: RiskAssumptions = {
      ...assumptions,
      step_pass_probability: {
        ...assumptions.step_pass_probability,
        [field]: val,
      },
    };
    onUpdateAssumptions(updated);
  };

  const handleScenarioParamChange = (
    scId: string,
    field: "f" | "l",
    val: number
  ) => {
    if (isNaN(val) || val < 0) return;
    const currentSc = assumptions.scenarios[scId];
    if (!currentSc) return;

    const updatedScenarios = { ...assumptions.scenarios };
    if (field === "f") {
      updatedScenarios[scId] = {
        ...currentSc,
        attempts_per_year: {
          min: val / 2,
          likely: val,
          max: val * 2,
        },
      };
    } else {
      updatedScenarios[scId] = {
        ...currentSc,
        loss_per_success: {
          min: val / 2,
          likely: val,
          max: val * 3,
        },
      };
    }

    onUpdateAssumptions({
      ...assumptions,
      scenarios: updatedScenarios,
    });
  };

  return (
    <>
      {/* Scrim Overlay */}
      <div
        className={`scrim fixed inset-0 bg-[#0A101A]/45 z-40 transition-opacity duration-300 ${
          isOpen ? "opacity-100 pointer-events-auto block" : "opacity-0 pointer-events-none hidden"
        }`}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer Panel */}
      <aside
        className={`drawer fixed top-0 right-0 bottom-0 w-full max-w-[520px] bg-[var(--surface)] z-41 shadow-xl flex flex-col transition-transform duration-300 ease-in-out border-l border-[var(--line)] ${
          isOpen ? "translate-x-0" : "translate-x-full"
        }`}
        aria-label="Assumptions drawer"
        aria-hidden={!isOpen}
      >
        {/* Header */}
        <div className="hd flex justify-between items-center px-[22px] py-[18px] border-b border-[var(--line)]">
          <h2 className="text-[21px] font-bold text-[var(--ink)]">Assumptions</h2>
          <button
            onClick={onClose}
            className="flex items-center gap-1 border border-[var(--line)] bg-[var(--surface)] hover:bg-[var(--soft)] px-3 py-1.5 rounded-full text-sm font-medium text-[var(--ink)] transition-colors"
          >
            <X className="w-4 h-4" />
            <span>Close</span>
          </button>
        </div>

        {/* Body Content */}
        <div className="bd overflow-y-auto p-[22px] flex-1 space-y-4">
          <p className="text-[14.5px] text-[var(--muted)] leading-relaxed">
            Every number here is a sample assumption. Replace it with your organization&apos;s data or a sourced industry figure, and the whole app recalculates live.
          </p>

          <div className="formula bg-[var(--soft)] rounded-[8px] p-3 text-[14.5px] font-medium text-[var(--ink)] leading-normal">
            Yearly loss = tries per year × chance of success × cost per success
            <br />
            Chance of success = product of the step chances below
          </div>

          {/* Step Pass Chances */}
          <div>
            <h3 className="text-[16px] font-semibold text-[var(--ink)] mb-2">
              Chance an attacker gets past a step
            </h3>
            <div className="fgrid grid grid-cols-[1fr_110px] gap-2.5 items-center text-[15px] text-[var(--ink)]">
              <label htmlFor="passStopped">Blocked step</label>
              <input
                id="passStopped"
                type="number"
                step="0.05"
                min="0"
                max="1"
                value={assumptions.step_pass_probability.stopped}
                onChange={(e) => handlePassProbChange("stopped", parseFloat(e.target.value))}
                className="w-full px-2.5 py-1.5 border border-[var(--line)] rounded-lg bg-[var(--paper)] text-right font-medium"
              />

              <label htmlFor="passDetected">Seen, not blocked</label>
              <input
                id="passDetected"
                type="number"
                step="0.05"
                min="0"
                max="1"
                value={assumptions.step_pass_probability.detected}
                onChange={(e) => handlePassProbChange("detected", parseFloat(e.target.value))}
                className="w-full px-2.5 py-1.5 border border-[var(--line)] rounded-lg bg-[var(--paper)] text-right font-medium"
              />

              <label htmlFor="passMissed">No tool reacted</label>
              <input
                id="passMissed"
                type="number"
                step="0.05"
                min="0"
                max="1"
                value={assumptions.step_pass_probability.missed}
                onChange={(e) => handlePassProbChange("missed", parseFloat(e.target.value))}
                className="w-full px-2.5 py-1.5 border border-[var(--line)] rounded-lg bg-[var(--paper)] text-right font-medium"
              />
            </div>
          </div>

          {/* Scenario Specific Inputs */}
          {SCENARIOS.map((sc) => {
            const scAssump = assumptions.scenarios[sc.id];
            if (!scAssump) return null;

            return (
              <div key={sc.id} className="pt-2 border-t border-[var(--line)]">
                <h3 className="text-[16px] font-semibold text-[var(--ink)] mb-2">{sc.name}</h3>
                <div className="fgrid grid grid-cols-[1fr_110px] gap-2.5 items-center text-[15px] text-[var(--ink)]">
                  <label htmlFor={`tries-${sc.id}`}>Tries per year (likely)</label>
                  <input
                    id={`tries-${sc.id}`}
                    type="number"
                    step="0.5"
                    min="0.1"
                    value={scAssump.attempts_per_year.likely}
                    onChange={(e) =>
                      handleScenarioParamChange(sc.id, "f", parseFloat(e.target.value))
                    }
                    className="w-full px-2.5 py-1.5 border border-[var(--line)] rounded-lg bg-[var(--paper)] text-right font-medium"
                  />

                  <label htmlFor={`cost-${sc.id}`}>Cost per success, $ (likely)</label>
                  <input
                    id={`cost-${sc.id}`}
                    type="number"
                    step="5000"
                    min="0"
                    value={scAssump.loss_per_success.likely}
                    onChange={(e) =>
                      handleScenarioParamChange(sc.id, "l", parseFloat(e.target.value))
                    }
                    className="w-full px-2.5 py-1.5 border border-[var(--line)] rounded-lg bg-[var(--paper)] text-right font-medium"
                  />
                </div>
              </div>
            );
          })}

          <div className="pt-3 border-t border-[var(--line)] space-y-2 text-[14px] text-[var(--muted)] leading-relaxed">
            <p>
              Ranges use low = half and high = double the tries, and low = half and high = three times the cost, with a PERT distribution (10,000 iterations, fixed seed).
            </p>
            <p>
              Severity: Critical from {assumptions.severity_thresholds.critical * 100}% chance, High from {assumptions.severity_thresholds.high * 100}%, Medium from {assumptions.severity_thresholds.medium * 100}%.
            </p>
            <p>
              Methods: loss follows the FAIR structure (Open Group). Return on security investment follows the ROSI formula described by ENISA. Attack steps come from MITRE ATT&CK.
            </p>
          </div>

          <div className="pt-3">
            <button
              onClick={onResetAssumptions}
              className="flex items-center gap-1.5 border border-[var(--line)] bg-[var(--surface)] hover:bg-[var(--soft)] px-4 py-2.5 rounded-full text-sm font-semibold text-[var(--ink)] transition-colors cursor-pointer"
            >
              <RotateCcw className="w-4 h-4 text-[var(--muted)]" />
              <span>Reset to sample values</span>
            </button>
          </div>
        </div>
      </aside>
    </>
  );
};
