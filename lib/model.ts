import { runPlan } from "./engine";
import type { AppData, MonthActual, MonthKey, Plan, Scenario } from "./types";

export const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v));

export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);

export function nextMonthKey(m: MonthKey): MonthKey {
  const [y, mo] = m.split("-").map(Number);
  return mo === 12 ? `${y + 1}-01` : `${y}-${String(mo + 1).padStart(2, "0")}`;
}

export function monthLabel(m: MonthKey, style: "short" | "long" = "short"): string {
  const [y, mo] = m.split("-").map(Number);
  return new Date(Date.UTC(y, mo - 1, 1)).toLocaleString("en-US", {
    month: style === "short" ? "short" : "long",
    timeZone: "UTC",
    ...(style === "long" ? { year: "numeric" } : {}),
  });
}

/** Adds the next calendar year. Every plan carries its December costs forward. */
export function addYear(data: AppData): AppData {
  const d = clone(data);
  const last = d.months[d.months.length - 1];
  const added: MonthKey[] = [];
  let m = last;
  for (let i = 0; i < 12; i++) {
    m = nextMonthKey(m);
    added.push(m);
  }
  d.months.push(...added);
  for (const s of d.scenarios) {
    for (const mk of added) s.plan.months[mk] = { hires: 0, departures: 0 };
    for (const lineId of Object.keys(s.plan.lineValues)) {
      const v = s.plan.lineValues[lineId][last] ?? 0;
      for (const mk of added) s.plan.lineValues[lineId][mk] = v;
    }
  }
  return d;
}

export function duplicateScenario(data: AppData, fromId: string, name: string): { data: AppData; id: string } {
  const d = clone(data);
  const src = d.scenarios.find((s) => s.id === fromId)!;
  const now = new Date().toISOString();
  const s: Scenario = { id: uid(), name, notes: "", createdAt: now, updatedAt: now, plan: clone(src.plan) };
  d.scenarios.push(s);
  return { data: d, id: s.id };
}

/** Records a month's actual numbers, prefilled from what the plan forecast for it. */
export function closeMonth(data: AppData, plan: Plan, month: MonthKey): AppData {
  const d = clone(data);
  const r = runPlan(d, plan).find((x) => x.month === month)!;
  const a = plan.assumptions;
  const lines: Record<string, number> = {};
  for (const def of d.lines) if (!def.computed) lines[def.id] = r.lines[def.id] ?? 0;
  const actual: MonthActual = {
    fullTime: r.fullTime,
    partTime: r.partTime,
    executives: r.executives,
    newHires: r.newHires,
    departures: r.departures,
    sessions: Math.round(r.sessions),
    revenue: null,
    rates: {
      revenuePerSession: a.revenuePerSession,
      therapistPayPerSession: a.therapistPayPerSession,
      execSessionsUnpaid: a.execSessionsUnpaid,
      employmentTaxRate: a.employmentTaxRate,
      clientsPerNewTherapist: a.clientsPerNewTherapist,
      turnoverClientsPerTherapist: a.turnoverClientsPerTherapist,
      costPerNewClient: a.costPerNewClient,
      ceuPerTherapistPerYear: a.ceuPerTherapistPerYear,
    },
    lines,
    computedOverrides: {},
  };
  d.actuals[month] = actual;
  return d;
}

export function reopenMonth(data: AppData, month: MonthKey): AppData {
  const d = clone(data);
  delete d.actuals[month];
  return d;
}

export function touch(data: AppData, scenarioId: string): AppData {
  const s = data.scenarios.find((x) => x.id === scenarioId);
  if (s) s.updatedAt = new Date().toISOString();
  return data;
}
