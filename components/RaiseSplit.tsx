"use client";

import { useMemo, useState } from "react";
import { runPlan } from "@/lib/engine";
import { cents, money, pct, signed } from "@/lib/format";
import { addYear, clone, monthLabel } from "@/lib/model";
import type { AppData, Plan, Scenario } from "@/lib/types";
import { NumField } from "./Inputs";
import Sheet from "./Sheet";

const WINDOW = 12;
const OPTIONS = [0, 0.25, 0.5, 0.75, 1];

/**
 * How much of a higher blended revenue per session to pass on to therapists.
 * The raise is a flat amount added to pay per session; the practice keeps the rest.
 */
export default function RaiseSplit({
  data,
  scenario,
  baseline,
  updatePlan,
  onClose,
}: {
  data: AppData;
  scenario: Scenario;
  baseline: Scenario;
  updatePlan: (fn: (p: Plan) => void) => void;
  onClose: () => void;
}) {
  const a = scenario.plan.assumptions;
  const [oldRate, setOldRate] = useState(baseline.plan.assumptions.revenuePerSession);
  const [newRate, setNewRate] = useState(
    a.revenuePerSession > baseline.plan.assumptions.revenuePerSession ? a.revenuePerSession : 160,
  );
  const [oldPay, setOldPay] = useState(baseline.plan.assumptions.therapistPayPerSession);
  const [share, setShare] = useState(0.5); // share of the increase passed on
  const [applied, setApplied] = useState(false);

  const increase = Math.max(0, newRate - oldRate);
  const raise = Math.round(increase * share * 100) / 100;
  const newPay = oldPay + raise;
  const tax = a.employmentTaxRate;

  const firstOpen = data.months.find((m) => !data.actuals[m]);

  const calc = useMemo(() => {
    if (!firstOpen) return null;
    let d = data;
    let extended = false;
    while (d.months.length - d.months.indexOf(firstOpen) < WINDOW) {
      d = addYear(d);
      extended = true;
    }
    const plan = d.scenarios.find((s) => s.id === scenario.id)!.plan;
    const i0 = d.months.indexOf(firstOpen);
    const run = (rate: number, pay: number) => {
      const p = clone(plan);
      p.assumptions.revenuePerSession = rate;
      p.assumptions.therapistPayPerSession = pay;
      const rows = runPlan(d, p).slice(i0, i0 + WINDOW);
      const sum = (k: "revenue" | "ebitda" | "practicePayroll" | "sessions") => rows.reduce((s, r) => s + r[k], 0);
      const revenue = sum("revenue");
      const directPay = rows.reduce((s, r) => s + (r.lines.directPay ?? 0), 0);
      return { revenue, ebitda: sum("ebitda"), directPay, sessions: sum("sessions"), margin: revenue ? sum("ebitda") / revenue : 0 };
    };
    const today = run(oldRate, oldPay);
    const options = OPTIONS.map((s) => {
      const r = Math.round(increase * s * 100) / 100;
      return { share: s, pay: oldPay + r, result: run(newRate, oldPay + r) };
    });
    const chosen = run(newRate, newPay);
    return { today, options, chosen, extended, from: firstOpen, to: d.months[i0 + WINDOW - 1] };
  }, [data, scenario.id, firstOpen, oldRate, newRate, oldPay, newPay, increase]);

  if (!calc) {
    return (
      <Sheet open onClose={onClose} title="How much of the increase to pass on?">
        <p>Every month in the planner has actual numbers. Add the next year to use this tool.</p>
      </Sheet>
    );
  }

  const extraRevenue = calc.chosen.revenue - calc.today.revenue;
  const toTherapists = (calc.chosen.directPay - calc.today.directPay) * (1 + tax);
  const kept = calc.chosen.ebitda - calc.today.ebitda;
  const perYear = (sessionsPerMonth: number) => raise * sessionsPerMonth * 12;
  const keptPerSession = increase - raise * (1 + tax);

  return (
    <Sheet
      open
      onClose={onClose}
      title="How much of the increase to pass on?"
      subtitle={`Next 12 months of ${scenario.name}: ${monthLabel(calc.from, "long")} to ${monthLabel(calc.to, "long")}.`}
    >
      <div className="grid gap-8 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <section aria-label="Rates" className="grid content-start gap-3">
          <Field label="Blended revenue per session today" prefix="$" value={oldRate} onChange={setOldRate} />
          <Field
            label="New blended revenue per session"
            hint="Only some session rates are going up; this is the new average across all of them"
            prefix="$"
            value={newRate}
            onChange={setNewRate}
          />
          <Field label="Therapist pay per session today" prefix="$" value={oldPay} onChange={setOldPay} />

          <div className="card p-5">
            <div className="flex items-baseline justify-between gap-4">
              <p className="text-sm font-medium">Share of the increase passed on</p>
              <p className="num text-lg font-semibold">{Math.round(share * 100)}%</p>
            </div>
            <input
              type="range"
              aria-label="Share of the increase passed on"
              min={0}
              max={100}
              step={5}
              value={Math.round(share * 100)}
              onChange={(e) => setShare(Number(e.target.value) / 100)}
              className="mt-3 w-full"
            />
            <div className="mt-1 flex justify-between text-xs text-muted">
              <span>Keep it all</span>
              <span>Pass it all on</span>
            </div>
            <div className="mt-4 flex items-center justify-between gap-4 border-t border-rule pt-4">
              <p className="text-sm">Or set new pay per session</p>
              <span className="flex items-center gap-1 text-sm text-muted">
                $
                <NumField
                  ariaLabel="New pay per session"
                  value={newPay}
                  onCommit={(v) => {
                    if (v == null || !increase) return;
                    setShare(Math.min(1, Math.max(0, (v - oldPay) / increase)));
                  }}
                  className="w-20 font-semibold text-ink"
                />
              </span>
            </div>
          </div>
        </section>

        <section aria-label="Result" className="grid content-start gap-5">
          <p className="display text-3xl leading-snug">
            Of the <span className="num">{cents(increase)}</span> increase per session, therapists get{" "}
            <span className="num text-plum">{cents(raise)}</span> and the practice keeps about{" "}
            <span className={`num ${keptPerSession >= 0 ? "text-gain" : "text-loss"}`}>{cents(keptPerSession)}</span> after employment tax.
          </p>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="card p-5">
              <p className="eyebrow">For therapists</p>
              <p className="num mt-2 text-2xl font-semibold">
                {cents(oldPay)} → {cents(newPay)}
              </p>
              <p className="text-sm text-muted">
                per session, a {pct(oldPay ? raise / oldPay : 0)} raise
              </p>
              <ul className="mt-3 grid gap-1 text-sm">
                <li>
                  Full-time ({a.sessions.fullTime} sessions/mo):{" "}
                  <span className="num font-semibold">{signed(perYear(a.sessions.fullTime), money)}</span> a year
                </li>
                <li>
                  Part-time ({a.sessions.partTime} sessions/mo):{" "}
                  <span className="num font-semibold">{signed(perYear(a.sessions.partTime), money)}</span> a year
                </li>
              </ul>
            </div>
            <div className="card p-5">
              <p className="eyebrow">For the practice</p>
              <dl className="mt-2 grid gap-1.5 text-sm">
                <Row label="Extra revenue from the new rate" value={money(extraRevenue)} />
                <Row label="Passed on to therapists (with tax)" value={`−${money(toTherapists)}`} />
                <Row label="Extra profit kept" value={signed(kept, money)} strong />
                <Row
                  label="Margin"
                  value={`${pct(calc.today.margin)} → ${pct(calc.chosen.margin)}`}
                />
              </dl>
            </div>
          </div>

          <div className="card overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm">
              <caption className="px-4 pt-4 text-left text-sm font-medium">Compare splits over the next 12 months</caption>
              <thead>
                <tr className="border-b border-rule text-muted">
                  <th className="px-4 py-2 text-left font-medium">Passed on</th>
                  <th className="px-3 py-2 text-right font-medium">Pay / session</th>
                  <th className="px-3 py-2 text-right font-medium">Full-timer raise / yr</th>
                  <th className="px-3 py-2 text-right font-medium">Profit</th>
                  <th className="px-4 py-2 text-right font-medium">Margin</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-rule text-muted">
                  <td className="whitespace-nowrap px-4 py-2">Today ({cents(oldRate)})</td>
                  <td className="num px-3 py-2 text-right">{cents(oldPay)}</td>
                  <td className="num px-3 py-2 text-right">–</td>
                  <td className="num px-3 py-2 text-right">{money(calc.today.ebitda)}</td>
                  <td className="num px-4 py-2 text-right">{pct(calc.today.margin)}</td>
                </tr>
                {calc.options.map((o) => {
                  const active = Math.abs(o.share - share) < 0.001;
                  return (
                    <tr
                      key={o.share}
                      onClick={() => setShare(o.share)}
                      className={`cursor-pointer border-b border-rule last:border-0 ${active ? "bg-sea-wash font-semibold" : "hover:bg-fog"}`}
                    >
                      <td className="px-4 py-2">{Math.round(o.share * 100)}%</td>
                      <td className="num px-3 py-2 text-right">{cents(o.pay)}</td>
                      <td className="num px-3 py-2 text-right">{money((o.pay - oldPay) * a.sessions.fullTime * 12)}</td>
                      <td className="num px-3 py-2 text-right">{money(o.result.ebitda)}</td>
                      <td className="num px-4 py-2 text-right">{pct(o.result.margin)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {increase > 0 && (
            <p className={`text-sm ${share > 1 / (1 + tax) ? "font-medium text-loss" : "text-muted"}`}>
              Because employment tax ({pct(tax)}) is added to every dollar of raise, passing on more than about{" "}
              {Math.floor((100 / (1 + tax)))}% leaves the practice with less profit than today.
            </p>
          )}

          <p className="text-sm text-muted">
            The raise is a flat amount added to every paid session, whichever sessions actually went up. Executives&apos;
            first {a.execSessionsUnpaid} sessions a month are covered by salary, so they don&apos;t get it.
            {calc.extended && " Months past the last planned year assume December's costs continue."}
          </p>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => {
                updatePlan((p) => {
                  p.assumptions.revenuePerSession = newRate;
                  p.assumptions.therapistPayPerSession = Math.round(newPay * 100) / 100;
                });
                setApplied(true);
              }}
              className="btn"
            >
              Use {cents(newRate)} rate and {cents(newPay)} pay in {scenario.name}
            </button>
            {applied && (
              <p className="text-sm text-gain" role="status">
                Applied. The whole planner now uses these rates for this scenario.
              </p>
            )}
          </div>
          <p className="text-xs text-muted">Tip: save a new scenario first to keep this separate from your current plan.</p>
        </section>
      </div>
    </Sheet>
  );
}

function Field({
  label,
  hint,
  prefix,
  value,
  onChange,
}: {
  label: string;
  hint?: string;
  prefix?: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="card flex items-center justify-between gap-4 px-5 py-3">
      <div>
        <p className="text-sm font-medium">{label}</p>
        {hint && <p className="text-xs text-muted">{hint}</p>}
      </div>
      <span className="flex items-center gap-1 text-sm text-muted">
        {prefix}
        <NumField ariaLabel={label} value={value} onCommit={(v) => onChange(Math.max(0, v ?? 0))} className="w-20 font-semibold text-ink" />
      </span>
    </div>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className={strong ? "font-semibold" : "text-muted"}>{label}</dt>
      <dd className={`num whitespace-nowrap text-right ${strong ? "font-semibold text-gain" : ""}`}>{value}</dd>
    </div>
  );
}
