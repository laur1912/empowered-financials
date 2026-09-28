"use client";

import { monthsOfYear } from "@/lib/engine";
import { count, moneyK } from "@/lib/format";
import { monthLabel } from "@/lib/model";
import type { AppData, MonthResult, Plan, PlanMonth, Scenario, SessionAverages } from "@/lib/types";
import { NumField, Stepper } from "./Inputs";

const LEVERS: { key: keyof SessionAverages; label: string; hint: string; min: number; max: number }[] = [
  { key: "fullTime", label: "Full-time therapist", hint: "Sessions per month, each", min: 30, max: 110 },
  { key: "partTime", label: "Part-time therapist", hint: "Sessions per month, each", min: 10, max: 80 },
  { key: "executive", label: "Executive", hint: "Sessions per month, each", min: 0, max: 200 },
  { key: "newHire", label: "New hire, first month", hint: "Sessions in the month they start", min: 0, max: 40 },
];

export default function PlanTab({
  data,
  scenario,
  isBaseline,
  year,
  results,
  updatePlan,
  updateNotes,
}: {
  data: AppData;
  scenario: Scenario;
  isBaseline: boolean;
  year: number;
  results: MonthResult[];
  updatePlan: (fn: (p: Plan) => void) => void;
  updateNotes: (notes: string) => void;
}) {
  const a = scenario.plan.assumptions;
  const months = monthsOfYear(data.months, year);
  const byMonth = new Map(results.map((r) => [r.month, r]));
  const openMonths = months.filter((m) => !data.actuals[m]);

  const setMonth = (m: string, patch: Partial<PlanMonth>) =>
    updatePlan((p) => {
      p.months[m] = { ...(p.months[m] ?? { hires: 0, departures: 0 }), ...patch };
    });

  return (
    <div className="grid gap-10">
      <section aria-labelledby="levers" className="grid gap-8 lg:grid-cols-[minmax(0,4fr)_minmax(0,3fr)]">
        <div>
          <h2 id="levers" className="text-lg font-semibold">
            Average sessions
          </h2>
          <p className="mt-1 max-w-prose text-sm text-muted">
            These drive every forecast month. Months with actual numbers keep what really happened.
          </p>
          <div className="mt-5 grid gap-5 sm:grid-cols-2">
            {LEVERS.map((l) => (
              <div key={l.key}>
                <div className="flex items-baseline justify-between gap-2">
                  <label htmlFor={`lever-${l.key}`} className="text-sm font-medium">
                    {l.label}
                  </label>
                  <NumField
                    ariaLabel={`${l.label} sessions`}
                    value={a.sessions[l.key]}
                    onCommit={(v) => updatePlan((p) => void (p.assumptions.sessions[l.key] = v ?? 0))}
                    className="w-16 font-semibold"
                  />
                </div>
                <input
                  id={`lever-${l.key}`}
                  type="range"
                  min={l.min}
                  max={Math.max(l.max, a.sessions[l.key])}
                  value={a.sessions[l.key]}
                  onChange={(e) => updatePlan((p) => void (p.assumptions.sessions[l.key] = Number(e.target.value)))}
                  className="mt-2 w-full"
                />
                <p className="text-xs text-muted">{l.hint}</p>
              </div>
            ))}
          </div>
        </div>

        <div>
          <h2 className="text-lg font-semibold">Money per session</h2>
          <div className="mt-5 grid gap-4">
            <Row label="Average revenue per session">
              <NumField
                value={a.revenuePerSession}
                onCommit={(v) => updatePlan((p) => void (p.assumptions.revenuePerSession = v ?? 0))}
                className="w-24"
                ariaLabel="Average revenue per session"
              />
            </Row>
            <Row label="Therapist pay per session">
              <NumField
                value={a.therapistPayPerSession}
                onCommit={(v) => updatePlan((p) => void (p.assumptions.therapistPayPerSession = v ?? 0))}
                className="w-24"
                ariaLabel="Therapist pay per session"
              />
            </Row>
            <p className="text-sm text-muted">
              Each extra session adds about{" "}
              <strong className="num text-ink">
                ${Math.round(a.revenuePerSession - a.therapistPayPerSession * (1 + a.employmentTaxRate))}
              </strong>{" "}
              to profit after therapist pay and employment tax.
            </p>
          </div>
          {!isBaseline && (
            <div className="mt-6">
              <label htmlFor="notes" className="text-sm font-medium">
                Notes on this scenario
              </label>
              <textarea
                id="notes"
                defaultValue={scenario.notes ?? ""}
                key={scenario.id}
                onBlur={(e) => e.target.value !== (scenario.notes ?? "") && updateNotes(e.target.value)}
                rows={3}
                placeholder="What's different here, and why"
                className="mt-2 w-full rounded-md border border-rule bg-paper px-3 py-2 text-sm"
              />
            </div>
          )}
        </div>
      </section>

      <section aria-labelledby="hiring">
        <h2 id="hiring" className="text-lg font-semibold">
          Hiring and headcount, {year}
        </h2>
        <p className="mt-1 max-w-prose text-sm text-muted">
          New hires join as {a.newHiresJoinAs === "partTime" ? "part-time" : "full-time"} the month after they start;
          people leaving come off {a.departuresFrom === "partTime" ? "part-time" : "full-time"} the month after. Type
          in a headcount or session number to override the calculation. Clear the box to go back to the calculated
          number.
        </p>
        {openMonths.length === 0 && (
          <p className="mt-3 text-sm text-plum">Every month in {year} has actual numbers, so there&apos;s nothing to plan here.</p>
        )}

        <div className="mt-4 overflow-x-auto rounded-lg border border-rule bg-paper">
          <table className="w-full min-w-[900px] table-fixed border-collapse text-sm">
            <colgroup>
              <col className="w-44" />
              {months.map((m) => (
                <col key={m} />
              ))}
            </colgroup>
            <thead>
              <tr className="border-b border-rule">
                <th className="sticky left-0 z-10 bg-paper px-3 py-2 text-left font-medium text-muted" />
                {months.map((m) => (
                  <th key={m} className={`px-1 py-2 text-center font-medium ${data.actuals[m] ? "bg-sea-wash" : ""}`}>
                    <span className="block">{monthLabel(m)}</span>
                    <span className="block text-[11px] font-normal text-muted">
                      {data.actuals[m] ? "Actual" : "Forecast"}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <GridRow label="New therapists starting">
                {months.map((m) => {
                  const r = byMonth.get(m)!;
                  return (
                    <Cell key={m} actual={r.isActual}>
                      <Stepper
                        label="new therapists"
                        value={r.newHires}
                        disabled={r.isActual}
                        onChange={(v) => setMonth(m, { hires: v })}
                      />
                    </Cell>
                  );
                })}
              </GridRow>
              <GridRow label="Therapists leaving">
                {months.map((m) => {
                  const r = byMonth.get(m)!;
                  return (
                    <Cell key={m} actual={r.isActual}>
                      <Stepper
                        label="therapists leaving"
                        value={r.departures}
                        disabled={r.isActual}
                        onChange={(v) => setMonth(m, { departures: v })}
                      />
                    </Cell>
                  );
                })}
              </GridRow>
              {(
                [
                  ["fullTime", "Full-time"],
                  ["partTime", "Part-time"],
                  ["executives", "Executives"],
                ] as const
              ).map(([k, label]) => (
                <GridRow key={k} label={label}>
                  {months.map((m) => {
                    const r = byMonth.get(m)!;
                    const ov = scenario.plan.months[m]?.[k];
                    return (
                      <Cell key={m} actual={r.isActual}>
                        {r.isActual ? (
                          <span className="num block text-center">{count(r[k])}</span>
                        ) : (
                          <NumField
                            ariaLabel={`${label} in ${monthLabel(m, "long")}`}
                            value={ov ?? null}
                            placeholder={count(r[k])}
                            allowEmpty
                            onCommit={(v) => setMonth(m, { [k]: v })}
                            align="center"
                            className={`w-full ${ov != null ? "border-plum font-semibold text-plum" : "placeholder:text-ink"}`}
                          />
                        )}
                      </Cell>
                    );
                  })}
                </GridRow>
              ))}
              <GridRow label="Total therapists" strong>
                {months.map((m) => (
                  <Cell key={m} actual={byMonth.get(m)!.isActual}>
                    <span className="num block text-center font-semibold">{count(byMonth.get(m)!.totalTherapists)}</span>
                  </Cell>
                ))}
              </GridRow>
              <GridRow label="Sessions">
                {months.map((m) => {
                  const r = byMonth.get(m)!;
                  const ov = scenario.plan.months[m]?.sessionsOverride;
                  return (
                    <Cell key={m} actual={r.isActual}>
                      {r.isActual ? (
                        <span className="num block text-center">{count(r.sessions)}</span>
                      ) : (
                        <NumField
                          ariaLabel={`Sessions in ${monthLabel(m, "long")}`}
                          value={ov ?? null}
                          placeholder={count(r.sessions)}
                          allowEmpty
                          onCommit={(v) => setMonth(m, { sessionsOverride: v })}
                          align="center"
                            className={`w-full ${ov != null ? "border-plum font-semibold text-plum" : "placeholder:text-ink"}`}
                        />
                      )}
                    </Cell>
                  );
                })}
              </GridRow>
              <GridRow label="Profit" strong>
                {months.map((m) => {
                  const r = byMonth.get(m)!;
                  return (
                    <Cell key={m} actual={r.isActual}>
                      <span className={`num block text-center font-semibold ${r.ebitda < 0 ? "text-loss" : ""}`}>
                        {moneyK(r.ebitda)}
                      </span>
                    </Cell>
                  );
                })}
              </GridRow>
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-rule pb-3">
      <span className="text-sm">{label}</span>
      <span className="flex items-center gap-1 text-sm text-muted">${children}</span>
    </div>
  );
}

function GridRow({ label, children, strong }: { label: string; children: React.ReactNode; strong?: boolean }) {
  return (
    <tr className={`border-b border-rule last:border-0 ${strong ? "bg-fog/60" : ""}`}>
      <th scope="row" className={`sticky left-0 z-10 bg-paper px-3 py-2 text-left ${strong ? "font-semibold" : "font-normal"}`}>
        {label}
      </th>
      {children}
    </tr>
  );
}

function Cell({ children, actual }: { children: React.ReactNode; actual: boolean }) {
  return <td className={`px-1 py-1.5 ${actual ? "bg-sea-wash" : ""}`}>{children}</td>;
}
