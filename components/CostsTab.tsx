"use client";

import { useState } from "react";
import { monthsOfYear } from "@/lib/engine";
import { count, money, moneyK } from "@/lib/format";
import { monthLabel, uid } from "@/lib/model";
import type { AppData, Assumptions, LineDef, LineGroup, MonthResult, Plan, Role, Scenario } from "@/lib/types";
import { NumField } from "./Inputs";
import Sheet from "./Sheet";
import Spark from "./Spark";

type PanelId = LineGroup | "marketing" | "rates";
export type ToolId = "hiring" | "capacity" | "raise";

const MARKETING = ["mktNewHire", "mktMaintenance", "mktOpenSpots"];

const CARDS: { id: PanelId; title: string; action: string; blurb: string }[] = [
  { id: "practiceOverhead", title: "Practice overhead", action: "Review your overhead", blurb: "Rent, supervision, software, supplies" },
  { id: "marketing", title: "Ad spend", action: "Review ad spend", blurb: "Driven by the clients you need each month" },
  { id: "practicePayroll", title: "Practice payroll", action: "Review practice payroll", blurb: "Session pay, healthcare, bonuses, tax" },
  { id: "corporatePayroll", title: "Corporate payroll", action: "Review corporate payroll", blurb: "Leadership and admin salaries, tax" },
  { id: "corporateOverhead", title: "Corporate costs", action: "Review corporate costs", blurb: "Agencies, accounting, legal" },
  { id: "rates", title: "Rates", action: "Review rates", blurb: "Per-session money, tax, reimbursements" },
];

const GROUP_TITLES: Record<LineGroup, string> = {
  practiceOverhead: "Practice overhead",
  practicePayroll: "Practice payroll",
  corporatePayroll: "Corporate payroll",
  corporateOverhead: "Corporate costs",
  otherRevenue: "Other revenue",
};

interface Props {
  data: AppData;
  scenario: Scenario;
  year: number;
  results: MonthResult[];
  update: (fn: (d: AppData) => AppData | void) => void;
  updatePlan: (fn: (p: Plan) => void) => void;
  openTool: (t: ToolId) => void;
}

export default function CostsTab(props: Props) {
  const { data, year, results } = props;
  const [panel, setPanel] = useState<PanelId | null>(null);
  const rows = results.filter((r) => r.month.startsWith(`${year}-`));

  const seriesFor = (id: PanelId): number[] => {
    switch (id) {
      case "marketing":
        return rows.map((r) => r.adSpend);
      case "practicePayroll":
        return rows.map((r) => r.practicePayroll);
      case "corporatePayroll":
        return rows.map((r) => r.corporatePayroll);
      case "practiceOverhead":
        return rows.map((r) => r.practiceOverhead - r.adSpend);
      case "corporateOverhead":
        return rows.map((r) => r.corporateOverhead);
      case "otherRevenue":
        return rows.map((r) => r.otherRevenue);
      default:
        return [];
    }
  };

  const a = props.scenario.plan.assumptions;
  const otherRevenueTotal = rows.reduce((s, r) => s + r.otherRevenue, 0);

  return (
    <div>
      <p className="max-w-prose text-sm text-muted">
        Costs for {props.scenario.name} in {year}. Open a card to review or change it.
      </p>

      <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {CARDS.map((c) => {
          const series = seriesFor(c.id);
          const total = series.reduce((s, v) => s + v, 0);
          const isMarketing = c.id === "marketing";
          return (
            <article
              key={c.id}
              className={`card flex flex-col p-6 ${isMarketing ? "ring-1 ring-plum/30" : ""}`}
            >
              <h3 className="display text-xl">{c.title}</h3>
              <p className="text-sm text-muted">{c.blurb}</p>
              {c.id === "rates" ? (
                <dl className="mt-4 grid grid-cols-2 gap-y-2 text-sm">
                  <dt className="text-muted">Revenue per session</dt>
                  <dd className="num text-right font-semibold">${a.revenuePerSession}</dd>
                  <dt className="text-muted">Pay per session</dt>
                  <dd className="num text-right font-semibold">${a.therapistPayPerSession}</dd>
                  <dt className="text-muted">Sessions per client</dt>
                  <dd className="num text-right font-semibold">{a.sessionsPerClient}</dd>
                </dl>
              ) : (
                <div className="mt-4 flex items-end justify-between gap-3">
                  <div>
                    <p className="num text-2xl font-bold tracking-tight">{moneyK(total)}</p>
                    <p className="num text-xs text-muted">about {money(total / Math.max(1, series.length))} a month</p>
                  </div>
                  <Spark
                    values={series}
                    actual={rows.map((r) => r.isActual)}
                    color={isMarketing ? "var(--color-plum)" : undefined}
                  />
                </div>
              )}
              <button
                onClick={() => setPanel(c.id)}
                className={`btn btn-sm mt-5 self-start ${isMarketing ? "btn-alt" : ""}`}
              >
                {c.action}
              </button>
            </article>
          );
        })}
      </div>

      <p className="mt-6 text-sm text-muted">
        Other revenue (like the UIC contract): <span className="num font-medium text-ink">{money(otherRevenueTotal)}</span> in{" "}
        {year}.{" "}
        <button onClick={() => setPanel("otherRevenue")} className="font-medium text-sea underline">
          Review other revenue
        </button>
      </p>

      {panel && panel !== "marketing" && panel !== "rates" && (
        <LinesPanel {...props} group={panel} onClose={() => setPanel(null)} openMarketing={() => setPanel("marketing")} />
      )}
      {panel === "marketing" && <MarketingPanel {...props} onClose={() => setPanel(null)} />}
      {panel === "rates" && <RatesPanel {...props} onClose={() => setPanel(null)} />}
    </div>
  );
}

/* ---------------------------------------------------------------- lines panel */

function LinesPanel({
  data,
  scenario,
  year,
  results,
  update,
  updatePlan,
  group,
  onClose,
  openMarketing,
}: Props & { group: LineGroup; onClose: () => void; openMarketing: () => void }) {
  const months = monthsOfYear(data.months, year);
  const rows = results.filter((r) => r.month.startsWith(`${year}-`));
  const lines = data.lines.filter((l) => l.group === group && !MARKETING.includes(l.id));
  const [newName, setNewName] = useState("");

  const groupTotal = rows.reduce((s, r) => s + lines.reduce((t, l) => t + (r.lines[l.id] ?? 0), 0), 0);
  const tax =
    group === "practicePayroll"
      ? rows.reduce((s, r) => s + r.practiceTax, 0)
      : group === "corporatePayroll"
        ? rows.reduce((s, r) => s + r.corporateTax, 0)
        : 0;
  const adTotal = group === "practiceOverhead" ? rows.reduce((s, r) => s + r.adSpend, 0) : 0;

  return (
    <Sheet
      open
      onClose={onClose}
      title={`${GROUP_TITLES[group]}, ${year}`}
      subtitle={`${scenario.name}. Months already recorded are locked; change those on Enter actuals.`}
      aside={
        <div className="text-right">
          <p className="text-xs text-muted">{year} total</p>
          <p className="num text-lg font-semibold">{money(groupTotal + tax + adTotal)}</p>
        </div>
      }
    >
      <div className="grid gap-3">
        {lines.map((l) => (
          <LineCard
            key={l.id}
            line={l}
            data={data}
            scenario={scenario}
            months={months}
            rows={rows}
            update={update}
            updatePlan={updatePlan}
          />
        ))}

        {tax > 0 && (
          <SummaryRow
            label="Employment tax"
            detail={`${(scenario.plan.assumptions.employmentTaxRate * 100).toFixed(1)}% of the payroll above. Change the rate under Rates.`}
            total={tax}
          />
        )}
        {group === "practiceOverhead" && (
          <SummaryRow
            label="Ad spend"
            detail="Follows the clients you need to recruit each month."
            total={adTotal}
            action={
              <button onClick={openMarketing} className="btn btn-xs btn-alt">
                Review ad spend
              </button>
            }
          />
        )}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          const name = newName.trim();
          if (!name) return;
          update((d) => {
            d.lines.push({ id: `line-${uid()}`, name, group });
          });
          setNewName("");
        }}
        className="mt-6 flex flex-wrap items-center gap-2"
      >
        <input
          aria-label="New cost name"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder={group === "corporatePayroll" ? "e.g. New clinical director" : "e.g. New software subscription"}
          className="w-72 rounded-[7px] border border-rule bg-paper px-4 py-2.5 text-sm"
        />
        <button
          disabled={!newName.trim()}
          className="btn btn-sm"
        >
          Add {group === "otherRevenue" ? "revenue" : "cost"}
        </button>
        <span className="text-xs text-muted">Added to every scenario at $0.</span>
      </form>
    </Sheet>
  );
}

function SummaryRow({
  label,
  detail,
  total,
  action,
}: {
  label: string;
  detail: string;
  total: number;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-dashed border-rule px-5 py-3">
      <div>
        <p className="font-medium">{label}</p>
        <p className="text-sm text-muted">{detail}</p>
      </div>
      <div className="flex items-center gap-4">
        {action}
        <p className="num w-28 text-right font-semibold">{money(total)}</p>
      </div>
    </div>
  );
}

function LineCard({
  line,
  data,
  scenario,
  months,
  rows,
  update,
  updatePlan,
}: {
  line: LineDef;
  data: AppData;
  scenario: Scenario;
  months: string[];
  rows: MonthResult[];
  update: Props["update"];
  updatePlan: Props["updatePlan"];
}) {
  const open = months.filter((m) => !data.actuals[m]);
  const planned = (m: string) => scenario.plan.lineValues[line.id]?.[m] ?? 0;
  const uniform = open.every((m) => planned(m) === planned(open[0] ?? ""));
  const [showMonths, setShowMonths] = useState(!uniform);
  const [renaming, setRenaming] = useState(false);
  const total = rows.reduce((s, r) => s + (r.lines[line.id] ?? 0), 0);
  const varies = showMonths || !uniform;

  const setMonths = (ms: string[], v: number) =>
    updatePlan((p) => {
      p.lineValues[line.id] ??= {};
      for (const m of ms) p.lineValues[line.id][m] = v;
    });

  function remove() {
    const used = Object.values(data.actuals).some((a) => (a.lines[line.id] ?? 0) !== 0);
    if (used) {
      alert(`“${line.name}” has recorded amounts, so it can't be deleted. Set its future months to $0 instead.`);
      return;
    }
    if (!confirm(`Delete “${line.name}” from every scenario?`)) return;
    update((d) => {
      d.lines = d.lines.filter((l) => l.id !== line.id);
      for (const s of d.scenarios) delete s.plan.lineValues[line.id];
      for (const a of Object.values(d.actuals)) delete a.lines[line.id];
    });
  }

  return (
    <div className="card px-5 py-4">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
        <div className="min-w-48 flex-1">
          {renaming ? (
            <input
              autoFocus
              defaultValue={line.name}
              aria-label="Name"
              onBlur={(e) => {
                const v = e.target.value.trim();
                if (v && v !== line.name)
                  update((d) => {
                    const x = d.lines.find((y) => y.id === line.id);
                    if (x) x.name = v;
                  });
                setRenaming(false);
              }}
              onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
              className="w-full rounded-md border border-plum px-2 py-1"
            />
          ) : (
            <p className="font-medium">
              {line.name}
              {line.computed && <span className="ml-2 rounded-full bg-fog px-2 py-0.5 text-xs text-muted">calculated</span>}
            </p>
          )}
          {line.note && <p className="text-sm text-muted">{line.note}</p>}
        </div>

        {!line.computed && open.length > 0 && !varies && (
          <label className="flex items-center gap-2 text-sm text-muted">
            $
            <NumField
              ariaLabel={`${line.name} per month`}
              value={planned(open[0])}
              onCommit={(v) => setMonths(open, v ?? 0)}
              className="w-28 text-base font-semibold text-ink"
            />
            / month
            {open.length < months.length && (
              <span className="text-xs">
                ({monthLabel(open[0])}–{monthLabel(open[open.length - 1])})
              </span>
            )}
          </label>
        )}

        {!line.computed && open.length > 1 && (
          <button
            role="switch"
            aria-checked={varies}
            onClick={() => {
              if (varies) {
                setMonths(open, planned(open[0]));
                setShowMonths(false);
              } else setShowMonths(true);
            }}
            className="flex items-center gap-2 text-sm text-muted"
          >
            <span className="switch" aria-checked={varies} />
            Varies by month
          </button>
        )}

        <div className="ml-auto text-right">
          <p className="num font-semibold">{money(total)}</p>
          <p className="text-xs text-muted">for the year</p>
        </div>

        {!line.computed && (
          <details className="relative">
            <summary aria-label={`Options for ${line.name}`} className="cursor-pointer list-none rounded-full px-2 py-1 text-muted hover:bg-fog">
              •••
            </summary>
            <div className="absolute right-0 z-10 mt-1 w-40 rounded-lg border border-rule bg-paper p-1 shadow-lg">
              <button
                onClick={(e) => {
                  e.currentTarget.closest("details")?.removeAttribute("open");
                  setRenaming(true);
                }}
                className="block w-full rounded px-3 py-2 text-left text-sm hover:bg-fog"
              >
                Rename
              </button>
              <button
                onClick={(e) => {
                  e.currentTarget.closest("details")?.removeAttribute("open");
                  remove();
                }}
                className="block w-full rounded px-3 py-2 text-left text-sm text-loss hover:bg-fog"
              >
                Delete
              </button>
            </div>
          </details>
        )}
      </div>

      {(varies || line.computed || open.length === 0) && (
        <div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-6 lg:grid-cols-12">
          {rows.map((r) => {
            const editable = !r.isActual && !line.computed;
            return (
              <div key={r.month} className={`rounded-lg px-2 py-1.5 ${r.isActual ? "bg-sea-wash" : "bg-fog"}`}>
                <p className="flex items-center justify-between text-[11px] text-muted">
                  {monthLabel(r.month)}
                  {r.isActual && <span className="h-1.5 w-1.5 rounded-full bg-sea" title="Actual" />}
                </p>
                {editable ? (
                  <NumField
                    ariaLabel={`${line.name}, ${monthLabel(r.month, "long")}`}
                    value={planned(r.month)}
                    onCommit={(v) => setMonths([r.month], v ?? 0)}
                    className="mt-0.5 w-full border-transparent bg-paper text-sm"
                  />
                ) : (
                  <p className="num mt-0.5 px-2 py-1 text-right text-sm">{moneyK(r.lines[line.id] ?? 0)}</p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------- marketing */

function MarketingPanel({ data, scenario, year, results, updatePlan, onClose, openTool }: Props & { onClose: () => void }) {
  const a = scenario.plan.assumptions;
  const rows = results.filter((r) => r.month.startsWith(`${year}-`));
  const cpaOf = (r: MonthResult) => (r.isActual ? data.actuals[r.month].rates.costPerNewClient : a.costPerNewClient);
  const split = rows.map((r) => {
    const cpa = cpaOf(r) || 1;
    return {
      r,
      hire: (r.lines.mktNewHire ?? 0) / cpa,
      turnover: (r.lines.mktMaintenance ?? 0) / cpa,
      open: (r.lines.mktOpenSpots ?? 0) / cpa,
    };
  });
  const total = rows.reduce((s, r) => s + r.adSpend, 0);
  const max = Math.max(1, ...rows.map((r) => r.adSpend));
  const setA = (k: keyof Assumptions, v: number) => updatePlan((p) => void ((p.assumptions[k] as number) = v));

  return (
    <Sheet
      open
      onClose={onClose}
      title={`Ad spend, ${year}`}
      subtitle={`Each month's budget is the clients you need to bring in × $${a.costPerNewClient} per client.`}
      aside={
        <div className="text-right">
          <p className="text-xs text-muted">{year} total</p>
          <p className="num text-lg font-semibold">{money(total)}</p>
        </div>
      }
    >
      <div className="grid gap-8 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <section aria-label="Monthly ad spend">
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
            <Key className="bg-plum" label="Filling new hires" />
            <Key className="bg-sea" label="Replacing clients who leave" />
            <Key className="bg-sea-soft" label="Filling open spots" />
          </div>
          <div className="mt-3 flex h-56 items-end gap-2" role="img" aria-label="Ad spend by month">
            {split.map(({ r, hire, turnover, open }) => {
              const cpa = cpaOf(r);
              const h = (v: number) => `${r.adSpend ? ((v * cpa) / r.adSpend) * 100 : 0}%`;
              return (
                <div key={r.month} className="flex h-full flex-1 flex-col items-center justify-end gap-1">
                  <span className="num text-[10px] text-muted">{moneyK(r.adSpend)}</span>
                  <div className={`flex w-full flex-col-reverse overflow-hidden rounded-md ${r.isActual ? "opacity-70" : ""}`} style={{ height: `${(r.adSpend / max) * 85}%` }}>
                    <div className="bg-sea" style={{ height: h(turnover) }} />
                    <div className="bg-plum" style={{ height: h(hire) }} />
                    <div className="bg-sea-soft" style={{ height: h(open) }} />
                  </div>
                  <span className="text-[11px] text-muted">{monthLabel(r.month)}</span>
                </div>
              );
            })}
          </div>

        </section>

        <section aria-label="What drives ad spend" className="grid content-start gap-3">
          <Knob
            label="Cost to bring in one new client"
            prefix="$"
            value={a.costPerNewClient}
            onCommit={(v) => setA("costPerNewClient", v)}
          />
          <Knob
            label="Clients to fill a new therapist"
            value={a.clientsPerNewTherapist}
            onCommit={(v) => setA("clientsPerNewTherapist", v)}
          />
          <Knob
            label="Months for a new hire to fill up"
            hint="Their clients are recruited evenly over these months"
            value={a.rampMonths}
            onCommit={(v) => setA("rampMonths", Math.max(1, Math.round(v)))}
          />
          <Knob
            label="Clients who leave, per therapist per month"
            value={a.turnoverClientsPerTherapist}
            onCommit={(v) => setA("turnoverClientsPerTherapist", v)}
          />
          <button
            onClick={() => openTool("hiring")}
            className="mt-2 rounded-[20px] border border-plum/30 bg-plum-wash px-5 py-4 text-left hover:border-plum"
          >
            <span className="block font-semibold text-plum">How much will my budget go up if I hire?</span>
            <span className="text-sm text-muted">Try a hire and see ad spend, pay, and profit month by month.</span>
          </button>
        </section>
      </div>

      <div className="mt-8">
          <div className="overflow-x-auto rounded-xl border border-rule bg-paper">
            <table className="w-full min-w-[760px] text-sm">
              <thead>
                <tr className="border-b border-rule text-muted">
                  <th className="whitespace-nowrap px-3 py-2 text-left font-medium">Clients to bring in</th>
                  {rows.map((r) => (
                    <th key={r.month} className={`px-2 py-2 text-right font-medium ${r.isActual ? "bg-sea-wash" : ""}`}>
                      {monthLabel(r.month)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(
                  [
                    ["For new hires", "hire"],
                    ["To replace clients who leave", "turnover"],
                    ["For open spots", "open"],
                  ] as const
                ).map(([label, k]) => (
                  <tr key={k} className="border-b border-rule">
                    <th scope="row" className="whitespace-nowrap px-3 py-1.5 text-left font-normal">
                      {label}
                    </th>
                    {split.map((s) => (
                      <td key={s.r.month} className={`num px-2 py-1.5 text-right ${s.r.isActual ? "bg-sea-wash" : ""}`}>
                        {count(s[k])}
                      </td>
                    ))}
                  </tr>
                ))}
                <tr className="font-semibold">
                  <th scope="row" className="px-3 py-1.5 text-left">
                    Ad spend
                  </th>
                  {rows.map((r) => (
                    <td key={r.month} className={`num px-2 py-1.5 text-right ${r.isActual ? "bg-sea-wash" : ""}`}>
                      {moneyK(r.adSpend)}
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-xs text-muted">
            Plan extra clients for open spots on the Plan tab. Shaded months are what was actually spent.
          </p>
      </div>
    </Sheet>
  );
}

function Key({ className, label }: { className: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`h-2.5 w-2.5 rounded-sm ${className}`} />
      {label}
    </span>
  );
}

function Knob({
  label,
  hint,
  prefix,
  suffix,
  value,
  onCommit,
}: {
  label: string;
  hint?: string;
  prefix?: string;
  suffix?: string;
  value: number;
  onCommit: (v: number) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-xl bg-paper px-4 py-3">
      <div>
        <p className="text-sm font-medium">{label}</p>
        {hint && <p className="text-xs text-muted">{hint}</p>}
      </div>
      <span className="flex items-center gap-1 text-sm text-muted">
        {prefix}
        <NumField ariaLabel={label} value={value} onCommit={(v) => onCommit(v ?? 0)} className="w-20 font-semibold text-ink" />
        {suffix}
      </span>
    </div>
  );
}

/* ---------------------------------------------------------------- rates */

function RatesPanel({ scenario, updatePlan, onClose }: Props & { onClose: () => void }) {
  const a = scenario.plan.assumptions;
  const setA = (k: keyof Assumptions, v: number) => updatePlan((p) => void ((p.assumptions[k] as number) = v));
  const setRole = (k: "newHiresJoinAs" | "departuresFrom", v: Role) => updatePlan((p) => void (p.assumptions[k] = v));

  return (
    <Sheet open onClose={onClose} title="Rates" subtitle={`For forecast months in ${scenario.name}. Recorded months keep the rates they had.`}>
      <div className="grid gap-8 md:grid-cols-2">
        <section className="grid content-start gap-3">
          <h3 className="font-semibold">Sessions</h3>
          <Knob label="Average revenue per session" prefix="$" value={a.revenuePerSession} onCommit={(v) => setA("revenuePerSession", v)} />
          <Knob label="Therapist pay per session" prefix="$" value={a.therapistPayPerSession} onCommit={(v) => setA("therapistPayPerSession", v)} />
          <Knob
            label="Sessions per client per month"
            hint="Around 2.4 today; 3 is the goal"
            value={a.sessionsPerClient}
            onCommit={(v) => setA("sessionsPerClient", v)}
          />
          <Knob
            label="Executive sessions not paid per session"
            hint="Per executive, per month (covered by salary)"
            value={a.execSessionsUnpaid}
            onCommit={(v) => setA("execSessionsUnpaid", v)}
          />
        </section>
        <section className="grid content-start gap-3">
          <h3 className="font-semibold">Payroll and people</h3>
          <Knob
            label="Employment tax"
            suffix="%"
            value={Math.round(a.employmentTaxRate * 1000) / 10}
            onCommit={(v) => setA("employmentTaxRate", v / 100)}
          />
          <Knob
            label="CEU reimbursement per therapist"
            hint="Per year"
            prefix="$"
            value={a.ceuPerTherapistPerYear}
            onCommit={(v) => setA("ceuPerTherapistPerYear", v)}
          />
          <RoleChoice label="New hires join as" value={a.newHiresJoinAs} onChange={(v) => setRole("newHiresJoinAs", v)} />
          <RoleChoice label="People who leave come off" value={a.departuresFrom} onChange={(v) => setRole("departuresFrom", v)} />
          <p className="text-sm text-muted">Marketing rates live in the Ad spend panel.</p>
        </section>
      </div>
    </Sheet>
  );
}

function RoleChoice({ label, value, onChange }: { label: string; value: Role; onChange: (v: Role) => void }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-xl bg-paper px-4 py-3">
      <p className="text-sm font-medium">{label}</p>
      <div className="flex rounded-full bg-fog p-0.5 text-sm" role="radiogroup" aria-label={label}>
        {(
          [
            ["partTime", "Part-time"],
            ["fullTime", "Full-time"],
          ] as const
        ).map(([v, l]) => (
          <button
            key={v}
            role="radio"
            aria-checked={value === v}
            onClick={() => onChange(v)}
            className={`rounded-full px-3 py-1 ${value === v ? "bg-paper font-medium shadow-sm" : "text-muted"}`}
          >
            {l}
          </button>
        ))}
      </div>
    </div>
  );
}
