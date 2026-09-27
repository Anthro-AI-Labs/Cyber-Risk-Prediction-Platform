// Runs the TypeScript engine (src/lib/engine.ts) outside the browser so scripts/validate.py can
// compare it with the Python engine. Reads a JSON request on stdin, writes JSON results to stdout.
//
// Request:  { "configs": [["tool_id", ...], ...], "range_tools": ["tool_id", ...] }
// Response: { "results": [{ active_tool_ids, total_ale_point_rounded, scenarios: {id: {...}} }],
//             "range": { tools, iterations, p10, p50, p90 } }
import { createServer } from "vite";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

let input = "";
for await (const chunk of process.stdin) input += chunk;
const request = JSON.parse(input || "{}");

const server = await createServer({
  root,
  configFile: false,
  logLevel: "error",
  appType: "custom",
  server: { middlewareMode: true, hmr: false },
  optimizeDeps: { noDiscovery: true, include: [] },
});

try {
  const engine = await server.ssrLoadModule("/src/lib/engine.ts");
  const results = (request.configs || []).map((tools) => {
    const sim = engine.computeRisk(tools, engine.DEFAULT_ASSUMPTIONS, 0); // point values only
    const scenarios = {};
    for (const [id, sc] of Object.entries(sim.scenarios)) {
      scenarios[id] = {
        ale_point_rounded: sc.ale_point_rounded,
        risk_score_display: sc.risk_score_display,
        severity: sc.severity,
        outcomes: sc.steps.map((s) => s.outcome),
      };
    }
    return { active_tool_ids: tools, total_ale_point_rounded: sim.total_ale_point_rounded, scenarios };
  });

  let range = null;
  if (request.range_tools) {
    const sim = engine.computeRisk(request.range_tools, engine.DEFAULT_ASSUMPTIONS);
    range = { tools: request.range_tools, iterations: engine.DEFAULT_MC_ITERATIONS ?? null, ...sim.total_ale_range };
  }
  process.stdout.write(JSON.stringify({ results, range }));
} finally {
  await server.close();
}
