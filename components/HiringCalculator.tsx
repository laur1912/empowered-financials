"use client";

import { useMemo, useState } from "react";
import { runPlan } from "@/lib/engine";
import { count, money, moneyK, signed } from "@/lib/format";
import { addYear, clone, monthLabel } from "@/lib/model";
import type { AppData, Plan, Scenario } from "@/lib/types";
import { Stepper } from "./Inputs";
import Sheet from "./Sheet";

const WINDOW = 12;

interface Diff {
  month: string;
  ad: number;
  payroll: number;
  otherCosts: number;
  revenue: number;
  sessions: number;
  profit: number;
  cum: number;
}

export default function HiringCalculator({
  data,
  scenario,
  updatePlan,
  onClose,
}: {
  data: AppData;
  scenario: Scenario;
  updatePlan: (fn: (p: Plan) => void) => void;
  onClose: () => void;
}) {
  const forecastMonths = data.months.filter((m) => !data.actuals[m]);
  const [n, setN] = useState(1);
  const [start, setStart] = useState(forecastMonths[0] ?? "");
  const [added, setAdded] = useState(false);
  const a = scenario.plan.assumptions;

  const calc = useMemo(() => {
    if (!start) return null;
    // Look a full year ahead even if the planner doesn't have the next year yet.
    let d = data;
    let extended = false;
    while (d.months.length - d.months.indexOf(start) < WINDOW) {
      d = addYear(d);
      extended = true;
    }
    const plan = d.scenarios.find((s) => s.id === scenario.id)!.plan;
    const withHire = clone(plan);
    withHire.months[start] = { ...(withHire.months[start] ?? { hires: 0, departures: 0 }) };
    withHire.months[start].hires += n;
    const A = runPlan(d, plan);
    const B = runPlan(d, withHire);
    const i0 = d.months.indexOf(start);
    const rows: Diff[] = [];
    let cum = 0;
    let payback: string | null = null;
    let wentNegative = false;
    for (let i = i0; i < i0 + WINDOW; i++) {
      const diff: Diff = {
        month: d.months[i],
        ad: B[i].adSpend - A[i].adSpend,
        payroll: B[i].totalPayroll - A[i].totalPayroll,
        otherCosts: B[i].totalOverhead - A[i].totalOverhead - (B[i].adSpend - A[i].adSpend),
        revenue: B[i].revenue - A[i].revenue,
        sessions: B[i].sessions - A[i].sessions,
        profit: B[i].ebitda - A[i].ebitda,
        cum: 0,
      };
      cum += diff.profit;
      diff.cum = cum;
      if (cum < 0) wentNegative = true;
      if (!payback && wentNegative && cum >= 0) payback = diff.month;
      rows.push(diff);
    }
    const sum = (k: "ad" | "payroll" | "otherCosts" | "revenue" | "profit" | "sessions") =>
      rows.reduce((s, r) => s + r[k], 0);
    const full = rows[Math.min(rows.length - 1, Math.max(1, Math.round(a.rampMonths)))];
    return {
      rows,
      extended,
      lastReal: data.months[data.months.length - 1],
      totals: {
        ad: sum("ad"),
        payroll: sum("payroll"),
        otherCosts: sum("otherCosts"),
        revenue: sum("revenue"),
        profit: sum("profit"),
        sessions: sum("sessions"),
      },
      payback,
      everNegative: wentNegative,
      full,
    };
  }, [data, scenario.id, start, n, a.rampMonths]);

  if (!start || !calc) {
    return (
      <Sheet open onClose={onClose} title="What will hiring cost?">
        <p>Every month in the planner has actual numbers. Add the next year to plan a hire.</p>
      </Sheet>
    );
  }

  const who = n === 1 ? "one therapist" : `${n} therapists`;
  const maxAd = Math.max(1, ...calc.rows.map((r) => Math.abs(r.ad)));
  const maxProfit = Math.max(1, ...calc.rows.map((r) => Math.abs(r.profit)));
  const rampAds = calc.rows.slice(0, Math.max(1, Math.round(a.rampMonths)));
  const firstAd = rampAds[0]?.ad ?? 0;

  return (
    <Sheet
      open
      onClose={onClose}
      title="What will hiring cost?"
      subtitle={`Compared with ${scenario.name} as it is now. Nothing changes until you add it to the plan.`}
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-lg">
        <span>If we hire</span>
        <span className="rounded-full bg-paper px-2 py-1">
          <Stepper value={n} onChange={(v) => setN(Math.max(1, v))} label="hires" />
        </span>
        <span>{n === 1 ? "therapist" : "therapists"} starting in</span>
        <select
          value={start}
          onChange={(e) => setStart(e.target.value)}
          aria-label="Start month"
          className="rounded-full border border-rule bg-paper px-3 py-1.5 text-base font-medium"
        >
          {forecastMonths.map((m) => (
            <option key={m} value={m}>
              {monthLabel(m, "long")}
            </option>
          ))}
        </select>
      </div>

      <p className="display mt-6 max-w-3xl text-3xl leading-snug">
        Ad spend goes up about <span className="num text-plum">{money(firstAd)}</span> a month for the first{" "}
        {rampAds.length} months while {who} fill{n === 1 ? "s" : ""} up
        {!calc.everNegative ? (
          <>
            , and it adds profit from the first month because therapists are paid per session.
          </>
        ) : calc.payback ? (
          <>
            , and the hire pays for itself by <span className="text-gain">{monthLabel(calc.payback, "long")}</span>.
          </>
        ) : (
          <>, and it hasn&apos;t paid for itself within a year.</>
        )}
      </p>

      <dl className="mt-8 grid grid-cols-2 gap-4 md:grid-cols-5">
        <Tile label="Extra ad spend" value={money(calc.totals.ad)} tone="plum" />
        <Tile label="Extra payroll" value={money(calc.totals.payroll)} />
        <Tile label="Other extra costs" value={money(calc.totals.otherCosts)} hint="CEU and similar" />
        <Tile label="Extra revenue" value={money(calc.totals.revenue)} />
        <Tile
          label="Profit effect"
          value={signed(calc.totals.profit, money)}
          tone={calc.totals.profit >= 0 ? "gain" : "loss"}
        />
      </dl>
      <p className="mt-2 text-sm text-muted">Totals for the first 12 months.</p>

      <section className="card mt-8 p-5" aria-label="Month by month">
        <div className="grid grid-cols-[7rem_repeat(12,minmax(0,1fr))] items-end gap-1.5 text-xs">
          <span className="self-center text-muted">Ad spend</span>
          {calc.rows.map((r) => (
            <div key={r.month} className="flex h-20 flex-col items-center justify-end" title={`${monthLabel(r.month, "long")}: +${money(r.ad)}`}>
              <span className="num mb-0.5 text-[10px] text-muted">{r.ad >= 1 ? moneyK(r.ad) : ""}</span>
              <div className="w-full max-w-7 rounded-t bg-plum" style={{ height: `${(Math.max(0, r.ad) / maxAd) * 100}%` }} />
            </div>
          ))}

          <span className="self-center text-muted">Profit effect</span>
          {calc.rows.map((r) => (
            <div key={r.month} className="relative flex h-24 flex-col items-center" title={`${monthLabel(r.month, "long")}: ${signed(r.profit, money)}`}>
              <div className="absolute top-1/2 h-px w-full bg-rule" />
              <div className="flex h-1/2 w-full flex-col items-center justify-end">
                {r.profit > 0 && <div className="w-full max-w-7 rounded-t bg-gain" style={{ height: `${(r.profit / maxProfit) * 100}%` }} />}
              </div>
              <div className="flex h-1/2 w-full flex-col items-center">
                {r.profit < 0 && <div className="w-full max-w-7 rounded-b bg-loss" style={{ height: `${(-r.profit / maxProfit) * 100}%` }} />}
              </div>
            </div>
          ))}

          <span />
          {calc.rows.map((r) => (
            <span key={r.month} className={`text-center ${r.month === calc.payback ? "font-semibold text-gain" : "text-muted"}`}>
              {monthLabel(r.month)}
            </span>
          ))}
        </div>
      </section>

      <p className="mt-6 max-w-prose text-sm text-muted">
        Once full, {who} add{n === 1 ? "s" : ""} about{" "}
        <span className="num font-medium text-ink">{count(calc.full.sessions)} sessions</span> and{" "}
        <span className="num font-medium text-ink">{signed(calc.full.profit, money)}</span> in profit a month. New hires take{" "}
        {Math.round(a.rampMonths)} months to fill up, with {a.clientsPerNewTherapist} clients each recruited at $
        {a.costPerNewClient} per client. Change these under Costs, then Ad spend.
        {calc.extended && ` Months after ${monthLabel(calc.lastReal, "long")} assume December's costs continue.`}
      </p>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <button
          onClick={() => {
            updatePlan((p) => {
              p.months[start] = { ...(p.months[start] ?? { hires: 0, departures: 0 }) };
              p.months[start].hires += n;
            });
            setAdded(true);
          }}
          className="btn"
        >
          Add {n === 1 ? "this hire" : "these hires"} to {scenario.name}
        </button>
        {added && (
          <p className="text-sm text-gain" role="status">
            Added. The numbers above now compare against the updated plan.
          </p>
        )}
      </div>
    </Sheet>
  );
}

function Tile({ label, value, hint, tone }: { label: string; value: string; hint?: string; tone?: "plum" | "gain" | "loss" }) {
  const color = tone === "plum" ? "text-plum" : tone === "gain" ? "text-gain" : tone === "loss" ? "text-loss" : "";
  return (
    <div className="rounded-xl bg-paper px-4 py-3">
      <dt className="text-xs text-muted">{label}</dt>
      <dd className={`num text-xl font-semibold ${color}`}>{value}</dd>
      {hint && <dd className="text-xs text-muted">{hint}</dd>}
    </div>
  );
}
