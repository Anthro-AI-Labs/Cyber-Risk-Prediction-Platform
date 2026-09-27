#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, "..");

export const INPUT_FILES = [
  "backend/data/mitre/MITRE_ATTACK_demo_subset.json",
  "backend/data/tools.json",
  "backend/data/mappings.json",
  "backend/data/risk_assumptions.json",
  "backend/data/scenario_overrides.json",
  "backend/data/normal_day.json",
  "backend/data/ctid/ctid_m365_mappings_subset.json",
];

export function computeSha256(filePath) {
  const content = fs.readFileSync(filePath);
  return crypto.createHash("sha256").update(content).digest("hex");
}

export function syncData() {
  const fileHashes = {};
  for (const relPath of INPUT_FILES) {
    const absPath = path.join(REPO_ROOT, relPath);
    if (!fs.existsSync(absPath)) {
      throw new Error(`Missing required input file: ${relPath} (at ${absPath})`);
    }
    fileHashes[relPath] = computeSha256(absPath);
  }

  // Read files
  const mitreData = JSON.parse(
    fs.readFileSync(path.join(REPO_ROOT, INPUT_FILES[0]), "utf8")
  );
  const rawTools = JSON.parse(
    fs.readFileSync(path.join(REPO_ROOT, INPUT_FILES[1]), "utf8")
  );
  const mappings = JSON.parse(
    fs.readFileSync(path.join(REPO_ROOT, INPUT_FILES[2]), "utf8")
  );
  const assumptions = JSON.parse(
    fs.readFileSync(path.join(REPO_ROOT, INPUT_FILES[3]), "utf8")
  );
  const scenarioOverrides = JSON.parse(
    fs.readFileSync(path.join(REPO_ROOT, INPUT_FILES[4]), "utf8")
  );
  const normalDay = JSON.parse(
    fs.readFileSync(path.join(REPO_ROOT, INPUT_FILES[5]), "utf8")
  );
  const ctidData = JSON.parse(
    fs.readFileSync(path.join(REPO_ROOT, INPUT_FILES[6]), "utf8")
  );

  // Build short names mapping
  const SHORT_NAMES = {
    email_security: "Email Security",
    edr: "EDR",
    firewall: "Firewall",
    siem: "SIEM",
    tool_x: "Tool X",
    mfa_owned: "MFA",
    identity_suite: "Identity Suite",
    payment_process: "Payment check",
  };

  const tools = rawTools.map((t) => ({
    ...t,
    short: SHORT_NAMES[t.id] || t.name,
  }));

  // Build techniques map
  const techniques = {};
  for (const t of mitreData.techniques || []) {
    techniques[t.id] = {
      id: t.id,
      name: t.name,
      url: t.url,
      tactics: t.tactics,
      platforms: t.platforms,
      description: t.description,
      mitigations: t.mitigations,
      detection_strategies: t.detection_strategies,
      known_groups_count: t.known_groups_count,
      used_by_scattered_spider: t.used_by_scattered_spider,
      known_groups_sample: t.known_groups_sample,
      control_layer_team_assumption: t.control_layer_team_assumption,
    };
  }

  // Filter CTID rows referenced by ctid_support
  const referencedCtidPairs = new Set();
  for (const m of mappings) {
    for (const cs of m.ctid_support || []) {
      referencedCtidPairs.add(`${cs.capability_id}::${m.technique_id}`);
    }
  }

  const ctidReferencedRows = (ctidData.mapping_objects || []).filter((row) =>
    referencedCtidPairs.has(`${row.capability_id}::${row.attack_object_id}`)
  );

  // Compute noise data from normal_day.json
  const noise = {};
  for (const t of tools) {
    if (t.id === "identity_suite") {
      noise[t.id] = null;
    } else {
      let count = 0;
      for (const ev of normalDay.event_types || []) {
        if ((ev.alerting_tools || []).includes(t.id)) {
          count += ev.count;
        }
      }
      noise[t.id] = count;
    }
  }

  // Limitations text is computed from the data so it cannot drift from it.
  const ctidTechniques = new Set((ctidData.mapping_objects || []).map((r) => r.attack_object_id));
  const techniqueIds = Object.keys(techniques);
  const noCtid = techniqueIds.filter((id) => !ctidTechniques.has(id)).sort();
  const teamAssumptions = mappings.filter((m) => m.evidence_type === "team_assumption").length;
  const vendorClaims = mappings.filter((m) => m.evidence_type === "vendor_claim").length;
  const mc = assumptions.monte_carlo || {};
  const limitations = [
    {
      title: "Dataset version gap",
      description: `CTID mappings use ATT&CK v${ctidData.source?.attack_version_of_mapping} while the attack scenarios use v${mitreData.source?.version}; ${noCtid.length} of ${techniqueIds.length} techniques have no CTID Microsoft 365 row (${noCtid.join(", ")}).`,
    },
    {
      title: "Coverage gap",
      description: `${teamAssumptions} of ${mappings.length} tool-technique mappings rely on team assumptions and ${vendorClaims} on vendor descriptions, because no official mapping exists for them.`,
    },
    {
      title: "Monte Carlo",
      description: `Ranges use ${Number(mc.iterations).toLocaleString("en-US")} iterations with a fixed seed (${mc.seed}), so they repeat exactly on every run; they describe uncertainty in the assumptions, not measured variability.`,
    },
    {
      title: "Independent steps",
      description:
        "The model treats scenario steps as conditionally independent given tool configuration.",
    },
    {
      title: "Linear noise",
      description:
        "Normal-day baseline is an additive floor, not an attack-correlated multiplier.",
    },
  ];

  const generatedData = {
    source: mitreData.source || {},
    ctid_source: ctidData.source || {},
    tools,
    scenarios: mitreData.scenarios || [],
    techniques,
    mappings,
    noise,
    assumptions,
    scenario_overrides: scenarioOverrides,
    normal_day: normalDay,
    ctid_referenced_rows: ctidReferencedRows,
    limitations,
  };

  const metaData = {
    timestamp: new Date().toISOString(),
    files: fileHashes,
  };

  const outDataDir = path.join(REPO_ROOT, "frontend/src/data");
  if (!fs.existsSync(outDataDir)) {
    fs.mkdirSync(outDataDir, { recursive: true });
  }

  const outDataPath = path.join(outDataDir, "generated.json");
  const outMetaPath = path.join(outDataDir, "generated.meta.json");

  fs.writeFileSync(outDataPath, JSON.stringify(generatedData, null, 2), "utf8");
  fs.writeFileSync(outMetaPath, JSON.stringify(metaData, null, 2), "utf8");

  // Offline copy of the last validation run (written by scripts/validate.py) for the /validation page.
  const reportSrc = path.join(REPO_ROOT, "validation_report.json");
  const reportDst = path.join(outDataDir, "validation-report.json");
  if (fs.existsSync(reportSrc)) {
    fs.copyFileSync(reportSrc, reportDst);
    console.log(`  - ${reportDst} (copy of validation_report.json)`);
  } else if (!fs.existsSync(reportDst)) {
    fs.writeFileSync(reportDst, JSON.stringify({ scorecard: [], all_passed: false, missing: true }, null, 2), "utf8");
  }

  console.log(`[sync-data] Synced verified backend data to frontend:`);
  console.log(`  - ${outDataPath} (${(fs.statSync(outDataPath).size / 1024).toFixed(1)} KB)`);
  console.log(`  - ${outMetaPath}`);
  return { generatedData, metaData };
}

// Run if called as CLI
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  syncData();
}
