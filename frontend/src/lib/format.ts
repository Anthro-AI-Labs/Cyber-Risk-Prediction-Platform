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
    dotClass: "bg-[var(--critical)]",
    pillClass: "bg-[var(--critical)] text-white",
    color: "var(--critical)",
  },
  high: {
    label: "High",
    dotClass: "bg-[var(--high)]",
    pillClass: "bg-[var(--high)] text-white",
    color: "var(--high)",
  },
  medium: {
    label: "Medium",
    dotClass: "bg-[var(--medium)]",
    pillClass: "bg-[var(--medium)] text-white font-bold",
    color: "var(--medium)",
  },
  low: {
    label: "Low",
    dotClass: "bg-[var(--low)]",
    pillClass: "bg-[var(--low)] text-white font-bold",
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
    nodeClass: "border-[var(--stop)] bg-[var(--stop)] text-white font-bold",
  },
  detected: {
    label: "Seen, not blocked",
    badgeClass: "b-detected",
    icon: "◉",
    nodeClass: "border-[var(--det)] bg-[var(--det)] text-white font-bold",
  },
  missed: {
    label: "No tool reacted",
    badgeClass: "b-missed",
    icon: "✕",
    nodeClass: "border-[var(--miss)] bg-[var(--miss)] text-white font-bold",
  },
  starting_condition: {
    label: "Starting point",
    badgeClass: "b-start",
    icon: "•",
    nodeClass: "border-dashed border-[var(--start)] text-[var(--start)] bg-[var(--soft)]",
  },
};
