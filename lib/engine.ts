import type {
  AppData,
  ComputedKind,
  LineDef,
  MonthKey,
  MonthResult,
  Plan,
  Rates,
} from "./types";

const clamp0 = (n: number) => (Number.isFinite(n) ? Math.max(0, n) : 0);

export function computeLine(
  kind: ComputedKind,
  rates: Rates,
  ctx: { sessions: number; executives: number; totalTherapists: number; newHires: number },
): number {
  switch (kind) {
    case "directPay":
      return rates.therapistPayPerSession * clamp0(ctx.sessions - ctx.executives * rates.execSessionsUnpaid);
    case "ceu":
      return (rates.ceuPerTherapistPerYear * ctx.totalTherapists) / 12;
    case "mktNewHire":
      return ctx.newHires * rates.clientsPerNewTherapist * rates.costPerNewClient;
    case "mktMaintenance":
      return ctx.totalTherapists * rates.turnoverClientsPerTherapist * rates.costPerNewClient;
  }
}

/** Runs the whole timeline for one plan. Closed months use the shared actuals. */
export function runPlan(data: AppData, plan: Plan): MonthResult[] {
  const results: MonthResult[] = [];
  const a = plan.assumptions;

  data.months.forEach((month, i) => {
    const actual = data.actuals[month];
    const pm = plan.months[month] ?? { hires: 0, departures: 0 };
    const rates: Rates = actual ? actual.rates : a;

    let fullTime: number, partTime: number, executives: number, newHires: number, departures: number, sessions: number;

    if (actual) {
      ({ fullTime, partTime, executives, newHires, departures, sessions } = actual);
    } else {
      const prev = results[i - 1];
      if (prev) {
        fullTime = prev.fullTime;
        partTime = prev.partTime;
        executives = prev.executives;
        if (a.newHiresJoinAs === "fullTime") fullTime += prev.newHires;
        else partTime += prev.newHires;
        if (a.departuresFrom === "fullTime") fullTime -= prev.departures;
        else partTime -= prev.departures;
      } else {
        ({ fullTime, partTime, executives } = data.startingHeadcount);
      }
      if (pm.fullTime != null) fullTime = pm.fullTime;
      if (pm.partTime != null) partTime = pm.partTime;
      if (pm.executives != null) executives = pm.executives;
      fullTime = clamp0(fullTime);
      partTime = clamp0(partTime);
      executives = clamp0(executives);
      newHires = clamp0(pm.hires);
      departures = clamp0(pm.departures);
      sessions =
        pm.sessionsOverride != null
          ? pm.sessionsOverride
          : fullTime * a.sessions.fullTime +
            partTime * a.sessions.partTime +
            executives * a.sessions.executive +
            newHires * a.sessions.newHire;
    }

    const totalTherapists = fullTime + partTime + executives + newHires;
    const ctx = { sessions, executives, totalTherapists, newHires };

    const lines: Record<string, number> = {};
    for (const def of data.lines) {
      if (def.computed) {
        const o = actual?.computedOverrides[def.id];
        lines[def.id] = o != null ? o : computeLine(def.computed, rates, ctx);
      } else if (actual) {
        lines[def.id] = actual.lines[def.id] ?? 0;
      } else {
        lines[def.id] = plan.lineValues[def.id]?.[month] ?? 0;
      }
    }

    const sum = (g: LineDef["group"]) =>
      data.lines.filter((l) => l.group === g).reduce((s, l) => s + (lines[l.id] || 0), 0);

    const otherRevenue = sum("otherRevenue");
    const revenue =
      actual && actual.revenue != null ? actual.revenue : sessions * rates.revenuePerSession + otherRevenue;

    const practicePayrollPreTax = sum("practicePayroll");
    const practiceTax = practicePayrollPreTax * rates.employmentTaxRate;
    const practicePayroll = practicePayrollPreTax + practiceTax;
    const practiceOverhead = sum("practiceOverhead");
    const practiceNet = revenue - practicePayroll - practiceOverhead;

    const corporatePayrollPreTax = sum("corporatePayroll");
    const corporateTax = corporatePayrollPreTax * rates.employmentTaxRate;
    const corporatePayroll = corporatePayrollPreTax + corporateTax;
    const corporateOverhead = sum("corporateOverhead");
    const corporateTotal = corporatePayroll + corporateOverhead;

    const ebitda = practiceNet - corporateTotal;

    results.push({
      month,
      isActual: !!actual,
      fullTime,
      partTime,
      executives,
      newHires,
      departures,
      totalTherapists,
      sessions,
      sessionRevenue: revenue - otherRevenue,
      otherRevenue,
      revenue,
      lines,
      practicePayrollPreTax,
      practiceTax,
      practicePayroll,
      practiceOverhead,
      practiceNet,
      corporatePayrollPreTax,
      corporateTax,
      corporatePayroll,
      corporateOverhead,
      corporateTotal,
      totalPayroll: practicePayroll + corporatePayroll,
      totalOverhead: practiceOverhead + corporateOverhead,
      ebitda,
      margin: revenue ? ebitda / revenue : 0,
    });
  });

  return results;
}

export interface YearSummary {
  year: number;
  revenue: number;
  ebitda: number;
  margin: number;
  sessions: number;
  totalPayroll: number;
  totalOverhead: number;
  endTherapists: number;
  hires: number;
  departures: number;
  actualMonths: number;
}

export function summarizeYear(results: MonthResult[], year: number): YearSummary {
  const rows = results.filter((r) => r.month.startsWith(`${year}-`));
  const s = (k: keyof MonthResult) => rows.reduce((t, r) => t + (r[k] as number), 0);
  const revenue = s("revenue");
  const ebitda = s("ebitda");
  return {
    year,
    revenue,
    ebitda,
    margin: revenue ? ebitda / revenue : 0,
    sessions: s("sessions"),
    totalPayroll: s("totalPayroll"),
    totalOverhead: s("totalOverhead"),
    endTherapists: rows.length ? rows[rows.length - 1].totalTherapists : 0,
    hires: s("newHires"),
    departures: s("departures"),
    actualMonths: rows.filter((r) => r.isActual).length,
  };
}

export const yearsOf = (months: MonthKey[]) =>
  Array.from(new Set(months.map((m) => Number(m.slice(0, 4))))).sort();

export const monthsOfYear = (months: MonthKey[], year: number) => months.filter((m) => m.startsWith(`${year}-`));
