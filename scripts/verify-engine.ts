// Checks the app's math against the numbers the spreadsheet calculated.
import seed from "../lib/seed-data.json";
import expected from "./expected.json";
import { runPlan, summarizeYear } from "../lib/engine";
import type { AppData } from "../lib/types";

const data = seed as unknown as AppData;
const plan = data.scenarios.find((s) => s.id === data.baselineId)!.plan;
const res = runPlan(data, plan);
const exp = expected as Record<string, Record<string, number>>;
let bad = 0;
for (const r of res) {
  const e = exp[r.month];
  for (const [k, v] of Object.entries({ practiceNet: r.practiceNet, corporateTotal: r.corporateTotal, revenue: r.revenue, sessions: r.sessions })) {
    if (Math.abs(v - e[k]) > 0.01) { bad++; console.log(`MISMATCH ${r.month} ${k}: app ${v.toFixed(2)} sheet ${e[k].toFixed(2)}`); }
  }
}
for (const y of [2024, 2025, 2026]) console.log(y, "EBITDA", summarizeYear(res, y).ebitda.toFixed(2));
console.log(bad ? `${bad} mismatches` : "All months match the spreadsheet.");
process.exit(bad ? 1 : 0);
