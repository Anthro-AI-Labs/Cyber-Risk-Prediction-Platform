import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import crypto from "crypto";

describe("Data Sync & Single Source of Truth Guards", () => {
  const repoRoot = path.resolve(__dirname, "../../../");
  const metaPath = path.resolve(__dirname, "../data/generated.meta.json");
  const generatedPath = path.resolve(__dirname, "../data/generated.json");

  it("verifies that generated.meta.json matches current backend data file hashes", () => {
    expect(fs.existsSync(metaPath)).toBe(true);
    const meta = JSON.parse(fs.readFileSync(metaPath, "utf-8"));

    for (const [relPath, expectedHash] of Object.entries(meta.files as Record<string, string>)) {
      const fullPath = path.resolve(repoRoot, relPath);
      expect(fs.existsSync(fullPath), `Backend file not found: ${relPath}`).toBe(true);
      const content = fs.readFileSync(fullPath);
      const computedHash = crypto.createHash("sha256").update(content).digest("hex");
      expect(
        computedHash,
        `Hash mismatch for ${relPath}. Backend source file changed — run 'npm run sync-data'.`
      ).toBe(expectedHash);
    }
  });

  it("guards against hard-coded technique IDs or scenario step text in frontend/src (excluding src/data/)", () => {
    const srcDir = path.resolve(__dirname, "../");
    const dataDir = path.resolve(__dirname, "../data");

    expect(fs.existsSync(generatedPath)).toBe(true);
    const generated = JSON.parse(fs.readFileSync(generatedPath, "utf-8"));

    const scenarioStepTexts: string[] = [];
    if (generated.scenarios && Array.isArray(generated.scenarios)) {
      for (const sc of generated.scenarios) {
        if (sc.steps && Array.isArray(sc.steps)) {
          for (const st of sc.steps) {
            if (st.step && typeof st.step === "string") {
              scenarioStepTexts.push(st.step);
            }
          }
        }
      }
    }

    const techniqueRegex = /\bT\d{4}(?:\.\d{3})?\b/;

    const violations: { file: string; type: string; match: string }[] = [];

    function scanDir(dir: string) {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          if (fullPath === dataDir) {
            continue; // Skip src/data/
          }
          scanDir(fullPath);
        } else if (entry.isFile()) {
          // Only check source files (.ts, .tsx, .js, .jsx, .json, .css, etc.)
          if (!/\.(tsx?|jsx?|json|css|html)$/.test(entry.name)) continue;

          const content = fs.readFileSync(fullPath, "utf-8");

          // Check technique pattern
          const techMatch = content.match(techniqueRegex);
          if (techMatch) {
            violations.push({
              file: path.relative(repoRoot, fullPath),
              type: "technique_id",
              match: techMatch[0],
            });
          }

          // Check scenario step text
          for (const stepText of scenarioStepTexts) {
            if (content.includes(stepText)) {
              violations.push({
                file: path.relative(repoRoot, fullPath),
                type: "scenario_step_text",
                match: stepText,
              });
            }
          }
        }
      }
    }

    scanDir(srcDir);

    expect(
      violations,
      `Found hardcoded techniques or scenario step text outside src/data/:\n${JSON.stringify(
        violations,
        null,
        2
      )}`
    ).toEqual([]);
  });
});
