export const fmt = (n: number): string => {
  return "$" + Math.round(n).toLocaleString("en-US");
};

export const fmtK = (n: number): string => {
  if (n >= 1e6) {
    return "$" + (n / 1e6).toFixed(2).replace(/\.?0+$/, "") + "M";
  }
  if (n >= 1e3) {
    return "$" + Math.round(n / 1e3) + "K";
  }
  return "$" + Math.round(n);
};

export const pctS = (p: number): string => {
  const pct = p * 100;
  if (pct < 0.1) {
    return "under 0.1%";
  }
  return pct.toFixed(1) + "%";
};

export const SEVERITY_CONFIG: Record<
  string,
  { label: string; dotClass: string; pillClass: string; color: string }
> = {
  critical: {
    label: "Critical",
    dotClass: "bg-[var(--critical)] shadow-[0_0_8px_rgba(255,56,56,0.5)]",
    pillClass: "bg-[var(--critical)] text-white shadow-[0_0_10px_rgba(255,56,56,0.3)]",
    color: "var(--critical)",
  },
  high: {
    label: "High",
    dotClass: "bg-[var(--high)] shadow-[0_0_8px_rgba(255,159,26,0.5)]",
    pillClass: "bg-[var(--high)] text-white shadow-[0_0_10px_rgba(255,159,26,0.3)]",
    color: "var(--high)",
  },
  medium: {
    label: "Medium",
    dotClass: "bg-[var(--medium)] shadow-[0_0_8px_rgba(255,192,72,0.5)]",
    pillClass: "bg-[var(--medium)] text-[#080D15] font-bold shadow-[0_0_10px_rgba(255,192,72,0.3)]",
    color: "var(--medium)",
  },
  low: {
    label: "Low",
    dotClass: "bg-[var(--low)] shadow-[0_0_8px_rgba(46,213,115,0.5)]",
    pillClass: "bg-[var(--low)] text-[#080D15] font-bold shadow-[0_0_10px_rgba(46,213,115,0.3)]",
    color: "var(--low)",
  },
};

export const OUTCOME_CONFIG: Record<
  string,
  { label: string; badgeClass: string; icon: string; nodeClass: string }
> = {
  stopped: {
    label: "Blocked",
    badgeClass: "b-stopped",
    icon: "✓",
    nodeClass: "border-[var(--stop)] bg-[var(--stop)] text-[#080D15] font-black shadow-[0_0_14px_rgba(0,240,159,0.35)]",
  },
  detected: {
    label: "Seen, not blocked",
    badgeClass: "b-detected",
    icon: "◉",
    nodeClass: "border-[var(--det)] bg-[var(--det)] text-[#080D15] font-black shadow-[0_0_14px_rgba(255,186,8,0.35)]",
  },
  missed: {
    label: "No tool reacted",
    badgeClass: "b-missed",
    icon: "✕",
    nodeClass: "border-[var(--miss)] bg-[var(--miss)] text-white font-black shadow-[0_0_14px_rgba(255,71,87,0.35)]",
  },
  starting_condition: {
    label: "Starting point",
    badgeClass: "b-start",
    icon: "•",
    nodeClass: "border-dashed border-[var(--start)] text-[var(--start)] bg-[var(--soft)]",
  },
};
