import type { AppData } from "./types";

/**
 * Brings saved data up to the current version. Runs on every load, so it must be safe to run twice.
 * v2: new hires fill up over several months, ad spend follows clients to recruit, $100 per new client.
 */
export function migrate(input: AppData): AppData {
  const d = JSON.parse(JSON.stringify(input)) as AppData;

  if (d.version === 1) {
    for (const s of d.scenarios) {
      const a = s.plan.assumptions;
      a.rampMonths ??= 4;
      a.sessionsPerClient ??= 2.4;
      a.costPerNewClient = 100; // requested change; closed months keep their own frozen rates
    }
    d.version = 2;
  }

  // Always make sure the lines and fields v2 depends on exist.
  for (const s of d.scenarios) {
    s.plan.assumptions.rampMonths ??= 4;
    s.plan.assumptions.sessionsPerClient ??= 2.4;
  }
  if (!d.lines.some((l) => l.id === "mktOpenSpots")) {
    const i = d.lines.findIndex((l) => l.id === "mktMaintenance");
    d.lines.splice(i >= 0 ? i + 1 : d.lines.length, 0, {
      id: "mktOpenSpots",
      name: "Marketing to fill open spots",
      group: "practiceOverhead",
      computed: "mktOpenSpots",
      note: "Extra clients you plan to recruit × cost per new client",
    });
  }
  const nh = d.lines.find((l) => l.id === "mktNewHire");
  if (nh) nh.note = "Each new hire's clients are recruited evenly over the months it takes them to fill up";
  return d;
}
