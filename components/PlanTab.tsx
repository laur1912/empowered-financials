"use client";

import { monthsOfYear } from "@/lib/engine";
import { count, moneyK } from "@/lib/format";
import { monthLabel } from "@/lib/model";
import type { AppData, MonthResult, Plan, PlanMonth, Scenario, SessionAverages } from "@/lib/types";
import { NumField, Stepper } from "./Inputs";
import type { ToolId } from "./CostsTab";

const LEVERS: { key: keyof SessionAverages; label: string; hint: string; min: number; max: number }[] = [
  { key: "fullTime", label: "Full-time therapist", hint: "Sessions per month, each", min: 30, max: 110 },
  { key: "partTime", label: "Part-time therapist", hint: "Sessions per month, each", min: 10, max: 80 },
  { key: "executive", label: "Executive", hint: "Sessions per month, each", min: 0, max: 200 },
];

export default function PlanTab({
  data,
  scenario,
  isBaseline,
  year,
  results,
  updatePlan,
  updateNotes,
  openTool,
}: {
  data: AppData;
  scenario: Scenario;
  isBaseline: boolean;
  year: number;
  results: MonthResult[];
  updatePlan: (fn: (p: Plan) => void) => void;
  updateNotes: (notes: string) => void;
  openTool: (t: ToolId) => void;
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
      <section aria-label="Planning tools" className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <ToolCard
          title="Should we hire or fill open spots?"
          body="Enter today's openings and see whether to grow into them or start hiring, and when."
          action="Check our room to grow"
          onClick={() => openTool("capacity")}
          tone="sea"
        />
        <ToolCard
          title="What will hiring cost?"
          body="Pick a number of hires and a month. See ad spend, pay, and profit, and when it pays for itself."
          action="Try a hire"
          onClick={() => openTool("hiring")}
          tone="plum"
        />
        <ToolCard
          title="How much of a rate increase to pass on?"
          body="Split a higher average session rate between therapist pay and profit, and compare options side by side."
          action="Split the increase"
          onClick={() => openTool("raise")}
          tone="sea"
        />
      </section>

      <section aria-labelledby="levers" className="grid gap-8 lg:grid-cols-[minmax(0,4fr)_minmax(0,3fr)]">
        <div>
          <h2 id="levers" className="text-2xl">
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
            <div>
              <div className="flex items-baseline justify-between gap-2">
                <label htmlFor="lever-ramp" className="text-sm font-medium">
                  New hire, months to fill up
                </label>
                <NumField
                  ariaLabel="Months for a new hire to fill up"
                  value={a.rampMonths}
                  onCommit={(v) => updatePlan((p) => void (p.assumptions.rampMonths = Math.max(1, Math.round(v ?? 1))))}
                  className="w-16 font-semibold"
                />
              </div>
              <input
                id="lever-ramp"
                type="range"
                min={1}
                max={8}
                value={a.rampMonths}
                onChange={(e) => updatePlan((p) => void (p.assumptions.rampMonths = Number(e.target.value)))}
                className="mt-2 w-full"
              />
              <p className="text-xs text-muted">They take on clients gradually until they&apos;re full</p>
            </div>
          </div>
        </div>

        <div>
          <h2 className="text-2xl">Money per session</h2>
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
        <h2 id="hiring" className="text-2xl">
          Hiring and headcount, {year}
        </h2>
        <p className="mt-1 max-w-prose text-sm text-muted">
          New hires fill up over {Math.round(a.rampMonths)} months and count as{" "}
          {a.newHiresJoinAs === "partTime" ? "part-time" : "full-time"}. Extra clients fill open spots on current
          schedules; both add to ad spend. Type over a headcount or session number to set it yourself, and clear the box
          to go back to the calculation.
        </p>
        {openMonths.length === 0 && (
          <p className="mt-3 text-sm text-plum">Every month in {year} has actual numbers, so there&apos;s nothing to plan here.</p>
        )}

        <div className="card mt-4 overflow-x-auto">
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
              <GridRow label="Extra clients for open spots">
                {months.map((m) => {
                  const r = byMonth.get(m)!;
                  const v = scenario.plan.months[m]?.extraClients ?? 0;
                  return (
                    <Cell key={m} actual={r.isActual}>
                      {r.isActual ? (
                        <span className="num block text-center text-muted">–</span>
                      ) : (
                        <NumField
                          ariaLabel={`Extra clients in ${monthLabel(m, "long")}`}
                          value={v || null}
                          placeholder="0"
                          allowEmpty
                          align="center"
                          onCommit={(x) => setMonth(m, { extraClients: x ?? 0 })}
                          className={`w-full ${v ? "border-sea font-semibold text-sea" : ""}`}
                        />
                      )}
                    </Cell>
                  );
                })}
              </GridRow>
              <GridRow label="Ad spend">
                {months.map((m) => {
                  const r = byMonth.get(m)!;
                  return (
                    <Cell key={m} actual={r.isActual}>
                      <span className="num block text-center text-plum">{moneyK(r.adSpend)}</span>
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

function ToolCard({
  title,
  body,
  action,
  onClick,
  tone,
}: {
  title: string;
  body: string;
  action: string;
  onClick: () => void;
  tone: "sea" | "plum";
}) {
  return (
    <button
      onClick={onClick}
      className={`group flex flex-col items-start rounded-[20px] border p-6 text-left transition-colors ${
        tone === "sea" ? "border-teal/25 bg-sea-wash hover:border-teal" : "border-plum/25 bg-plum-wash hover:border-plum"
      }`}
    >
      <span className="display text-2xl">{title}</span>
      <span className="mt-1 max-w-prose text-sm text-muted">{body}</span>
      <span
        className={`btn btn-sm mt-5 ${tone === "sea" ? "" : "btn-alt"}`}
      >
        {action}
      </span>
    </button>
  );
}
