import type { AppData, ComputedKind, LineDef, MonthKey, MonthResult, Plan, Rates } from "./types";

const clamp0 = (n: number) => (Number.isFinite(n) ? Math.max(0, n) : 0);

/**
 * How closed (actual) months calculate their formula lines. This matches the original spreadsheet,
 * so the books don't shift when forecast logic changes.
 */
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
    case "mktOpenSpots":
      return 0;
  }
}

/** Share of a full caseload a new hire carries in their k-th month (k = 1 is the month they start). */
export const rampShare = (k: number, rampMonths: number) => Math.min(1, k / Math.max(1, Math.round(rampMonths)));

/** Runs the whole timeline for one plan. Closed months use the shared actuals. */
export function runPlan(data: AppData, plan: Plan): MonthResult[] {
  const results: MonthResult[] = [];
  const a = plan.assumptions;
  const R = Math.max(1, Math.round(a.rampMonths ?? 4));
  const perClient = a.sessionsPerClient ?? 2.4;

  // Hires per month (actual or planned) so later months know who is still filling up.
  const hires = data.months.map((m) => {
    const act = data.actuals[m];
    return act ? act.newHires : clamp0(plan.months[m]?.hires ?? 0);
  });

  let extraClientsRunning = 0; // clients added for open spots since the last closed month

  data.months.forEach((month, i) => {
    const actual = data.actuals[month];
    const pm = plan.months[month] ?? { hires: 0, departures: 0 };
    const rates: Rates = actual ? actual.rates : a;

    let fullTime: number, partTime: number, executives: number, newHires: number, departures: number, sessions: number;
    let rampClients = 0;
    let extraClients = 0;

    if (actual) {
      ({ fullTime, partTime, executives, newHires, departures, sessions } = actual);
      extraClientsRunning = 0;
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
      newHires = hires[i];
      departures = clamp0(pm.departures);
      extraClients = clamp0(pm.extraClients ?? 0);
      extraClientsRunning += extraClients;

      const target = a.newHiresJoinAs === "fullTime" ? a.sessions.fullTime : a.sessions.partTime;
      // New hires this month carry a first-month share of a caseload.
      let rampSessions = newHires * target * rampShare(1, R);
      // Earlier hires are already counted at a full caseload in the headcount; take off what they don't have yet.
      for (let j = 1; j < R && i - j >= 0; j++) {
        rampSessions -= hires[i - j] * target * (1 - rampShare(j + 1, R));
      }
      // Their clients are recruited evenly across the ramp.
      for (let j = 0; j < R && i - j >= 0; j++) {
        rampClients += (hires[i - j] * a.clientsPerNewTherapist) / R;
      }

      sessions =
        pm.sessionsOverride != null
          ? pm.sessionsOverride
          : clamp0(
              fullTime * a.sessions.fullTime +
                partTime * a.sessions.partTime +
                executives * a.sessions.executive +
                rampSessions +
                extraClientsRunning * perClient,
            );
    }

    const totalTherapists = fullTime + partTime + executives + newHires;
    const ctx = { sessions, executives, totalTherapists, newHires };
    const turnoverClients = totalTherapists * rates.turnoverClientsPerTherapist;

    const lines: Record<string, number> = {};
    for (const def of data.lines) {
      if (def.computed) {
        const o = actual?.computedOverrides[def.id];
        if (o != null) lines[def.id] = o;
        else if (actual) lines[def.id] = computeLine(def.computed, rates, ctx);
        else if (def.computed === "mktNewHire") lines[def.id] = rampClients * rates.costPerNewClient;
        else if (def.computed === "mktOpenSpots") lines[def.id] = extraClients * rates.costPerNewClient;
        else lines[def.id] = computeLine(def.computed, rates, ctx);
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
    const adSpend = (lines.mktNewHire ?? 0) + (lines.mktMaintenance ?? 0) + (lines.mktOpenSpots ?? 0);

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
      adSpend,
      clientsToRecruit: actual
        ? newHires * rates.clientsPerNewTherapist + turnoverClients
        : rampClients + turnoverClients + extraClients,
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
  adSpend: number;
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
    adSpend: s("adSpend"),
  };
}

export const yearsOf = (months: MonthKey[]) =>
  Array.from(new Set(months.map((m) => Number(m.slice(0, 4))))).sort();

export const monthsOfYear = (months: MonthKey[], year: number) => months.filter((m) => m.startsWith(`${year}-`));

/** Profit from one more session after therapist pay and employment tax. */
export const profitPerSession = (r: Rates) => r.revenuePerSession - r.therapistPayPerSession * (1 + r.employmentTaxRate);
