import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import { computeRisk, BASELINE_TOOLS, BASELINE_SPEND, DEFAULT_ASSUMPTIONS, TOOLS } from "./engine";

const repoRoot = path.resolve(__dirname, "../../../");
const srcDir = path.resolve(__dirname, "../");
const dataDir = path.resolve(__dirname, "../data");
const generatedPath = path.join(dataDir, "generated.json");
const metaPath = path.join(dataDir, "generated.meta.json");

/** Source files in frontend/src outside src/data/, excluding tests (which assert expected values). */
function sourceFiles(): string[] {
  const out: string[] = [];
  const walk = (dir: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (full !== dataDir) walk(full);
      } else if (/\.(tsx?|jsx?|json|css|html)$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name)) {
        out.push(full);
      }
    }
  };
  walk(srcDir);
  return out;
}

describe("Data Sync & Single Source of Truth Guards", () => {
  it("committed generated data equals what sync-data builds from the current backend files", async () => {
    // Not tautological: `npm test` no longer re-syncs first, and this rebuilds in memory without writing.
    const syncPath = path.join(repoRoot, "scripts/sync-data.mjs");
    const sync = await import(/* @vite-ignore */ syncPath);
    const { generatedData, metaData } = sync.buildGenerated();
    expect(
      fs.readFileSync(metaPath, "utf-8"),
      "generated.meta.json is stale — backend data changed; run 'npm run sync-data'"
    ).toBe(sync.serialize(metaData));
    expect(
      fs.readFileSync(generatedPath, "utf-8"),
      "generated.json is stale — backend data or sync-data.mjs changed; run 'npm run sync-data'"
    ).toBe(sync.serialize(generatedData));
  });

  it("guards against hard-coded technique IDs or scenario step text in frontend/src (excluding src/data/)", () => {
    const generated = JSON.parse(fs.readFileSync(generatedPath, "utf-8"));
    const stepTexts: string[] = (generated.scenarios || []).flatMap((sc: { steps?: { step?: string }[] }) =>
      (sc.steps || []).map((st) => st.step).filter((t): t is string => typeof t === "string")
    );
    const techniqueRegex = /\bT\d{4}(?:\.\d{3})?\b/;

    const violations: string[] = [];
    for (const file of sourceFiles()) {
      const content = fs.readFileSync(file, "utf-8");
      const rel = path.relative(repoRoot, file);
      const tech = content.match(techniqueRegex);
      if (tech) violations.push(`${rel}: technique id ${tech[0]}`);
      for (const text of stepTexts) if (content.includes(text)) violations.push(`${rel}: scenario step text "${text}"`);
    }
    expect(violations, violations.join("\n")).toEqual([]);
  });

  it("guards against hard-coded data values and computed results in frontend/src (excluding src/data/)", () => {
    const a = DEFAULT_ASSUMPTIONS;
    const sim = computeRisk(BASELINE_TOOLS, a, 0);

    // Every number >= 1,000 that comes from the data files, plus key computed results.
    const values = new Map<number, string>();
    const add = (n: number, label: string) => {
      if (Number.isFinite(n) && Math.abs(n) >= 1000 && !values.has(Math.round(n))) values.set(Math.round(n), label);
    };
    for (const t of TOOLS) add(t.annual_cost, `${t.id} annual_cost`);
    add(BASELINE_SPEND, "baseline spend");
    for (const [id, sc] of Object.entries(a.scenarios)) {
      for (const field of ["attempts_per_year", "loss_per_success"] as const) {
        for (const k of ["min", "likely", "max"] as const) add(sc[field][k], `${id}.${field}.${k}`);
      }
    }
    add(a.monte_carlo.iterations, "monte_carlo.iterations");
    add(sim.total_ale_point_rounded, "baseline total ALE");
    for (const [id, sc] of Object.entries(sim.scenarios)) add(sc.ale_point_rounded, `baseline ${id} ALE`);

    const variants = (n: number): string[] => {
      const plain = String(n);
      const grouped = n.toLocaleString("en-US");
      const underscored = plain.replace(/\B(?=(\d{3})+(?!\d))/g, "_");
      const forms = [plain, grouped, underscored];
      if (n % 1000 === 0) forms.push(`$${n / 1000}K`);
      return [...new Set(forms)];
    };

    const toolIds = TOOLS.map((t) => t.id).join("|");
    const toolArray = new RegExp(`\\[\\s*"(?:${toolIds})"\\s*,\\s*"(?:${toolIds})"`);

    const violations: string[] = [];
    for (const file of sourceFiles()) {
      const content = fs.readFileSync(file, "utf-8");
      const rel = path.relative(repoRoot, file);
      for (const [n, label] of values) {
        for (const form of variants(n)) {
          const re = new RegExp(`(?<![\\w.,:])${form.replace(/[$.]/g, "\\$&")}(?![\\w,]|\\.\\d)`);
          if (re.test(content)) violations.push(`${rel}: ${form} (${label})`);
        }
      }
      const arr = content.match(toolArray);
      if (arr) violations.push(`${rel}: hard-coded tool list ${arr[0]}…`);
    }
    expect(violations, `Hard-coded data outside src/data/:\n${violations.join("\n")}`).toEqual([]);
  });
});
