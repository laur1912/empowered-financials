"use client";

import { useState } from "react";
import { monthsOfYear } from "@/lib/engine";
import { money } from "@/lib/format";
import { monthLabel, uid } from "@/lib/model";
import type { AppData, Assumptions, LineGroup, MonthResult, Plan, Role, Scenario } from "@/lib/types";
import { NumField } from "./Inputs";

const GROUPS: { id: LineGroup; label: string }[] = [
  { id: "practicePayroll", label: "Practice payroll" },
  { id: "practiceOverhead", label: "Practice overhead" },
  { id: "corporatePayroll", label: "Corporate payroll" },
  { id: "corporateOverhead", label: "Corporate overhead" },
  { id: "otherRevenue", label: "Other revenue" },
];

type NumKey = Exclude<keyof Assumptions, "sessions" | "newHiresJoinAs" | "departuresFrom">;
const RATES: { key: NumKey; label: string; unit: "$" | "%" | "" }[] = [
  { key: "execSessionsUnpaid", label: "Executive sessions per month not paid per session", unit: "" },
  { key: "employmentTaxRate", label: "Employment tax rate", unit: "%" },
  { key: "clientsPerNewTherapist", label: "Clients needed to fill a new therapist", unit: "" },
  { key: "turnoverClientsPerTherapist", label: "Clients lost to turnover, per therapist per month", unit: "" },
  { key: "costPerNewClient", label: "Marketing cost to get one new client", unit: "$" },
  { key: "ceuPerTherapistPerYear", label: "CEU reimbursement per therapist per year", unit: "$" },
];

export default function CostsTab({
  data,
  scenario,
  year,
  results,
  update,
  updatePlan,
}: {
  data: AppData;
  scenario: Scenario;
  year: number;
  results: MonthResult[];
  update: (fn: (d: AppData) => AppData | void) => void;
  updatePlan: (fn: (p: Plan) => void) => void;
}) {
  const a = scenario.plan.assumptions;
  const months = monthsOfYear(data.months, year);
  const openMonths = months.filter((m) => !data.actuals[m]);
  const byMonth = new Map(results.map((r) => [r.month, r]));
  const [newName, setNewName] = useState("");
  const [newGroup, setNewGroup] = useState<LineGroup>("practiceOverhead");
  const [renaming, setRenaming] = useState<string | null>(null);

  function addLine() {
    const name = newName.trim();
    if (!name) return;
    update((d) => {
      d.lines.push({ id: `line-${uid()}`, name, group: newGroup });
    });
    setNewName("");
  }

  function deleteLine(id: string, name: string) {
    const used = Object.values(data.actuals).some((act) => (act.lines[id] ?? 0) !== 0);
    if (used) {
      alert(`“${name}” has actual amounts recorded, so it can't be deleted. Set its future months to 0 instead.`);
      return;
    }
    if (!confirm(`Delete “${name}” from every scenario?`)) return;
    update((d) => {
      d.lines = d.lines.filter((l) => l.id !== id);
      for (const s of d.scenarios) delete s.plan.lineValues[id];
      for (const act of Object.values(d.actuals)) delete act.lines[id];
    });
  }

  function fillForward(id: string) {
    const from = openMonths[0];
    if (!from) return;
    updatePlan((p) => {
      const v = p.lineValues[id]?.[from] ?? 0;
      p.lineValues[id] ??= {};
      for (const m of openMonths) p.lineValues[id][m] = v;
    });
  }

  return (
    <div className="grid gap-12">
      <section aria-labelledby="rates" className="max-w-3xl">
        <h2 id="rates" className="text-lg font-semibold">
          Rates for {scenario.name}
        </h2>
        <p className="mt-1 max-w-prose text-sm text-muted">
          These apply to forecast months in this scenario. Revenue and pay per session are on the Plan tab.
        </p>
        <div className="mt-4 divide-y divide-rule rounded-lg border border-rule bg-paper px-5">
          {RATES.map((r) => (
            <div key={r.key} className="flex items-center justify-between gap-4 py-2.5">
              <span className="text-sm">{r.label}</span>
              <span className="flex items-center gap-1 text-sm text-muted">
                {r.unit === "$" && "$"}
                <NumField
                  ariaLabel={r.label}
                  value={r.unit === "%" ? a[r.key] * 100 : a[r.key]}
                  onCommit={(v) =>
                    updatePlan((p) => void (p.assumptions[r.key] = r.unit === "%" ? (v ?? 0) / 100 : (v ?? 0)))
                  }
                  className="w-24"
                />
                {r.unit === "%" && "%"}
              </span>
            </div>
          ))}
          <RoleRow
            label="New hires move to"
            value={a.newHiresJoinAs}
            onChange={(v) => updatePlan((p) => void (p.assumptions.newHiresJoinAs = v))}
          />
          <RoleRow
            label="Therapists who leave come off"
            value={a.departuresFrom}
            onChange={(v) => updatePlan((p) => void (p.assumptions.departuresFrom = v))}
          />
        </div>
      </section>

      <section aria-labelledby="costs">
        <h2 id="costs" className="text-lg font-semibold">
          Monthly costs, {year}
        </h2>
        <p className="mt-1 max-w-prose text-sm text-muted">
          Edit forecast months here for {scenario.name}. Shaded months are actual numbers; change those on the Enter
          actuals tab. “Copy across” copies the first forecast month to the rest of the year.
        </p>

        <div className="mt-4 overflow-x-auto rounded-lg border border-rule bg-paper">
          <table className="w-full min-w-[1150px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-rule">
                <th className="sticky left-0 z-10 bg-paper px-3 py-2 text-left font-medium text-muted" />
                {months.map((m) => (
                  <th key={m} className={`px-1 py-2 text-right font-medium ${data.actuals[m] ? "bg-sea-wash" : ""}`}>
                    {monthLabel(m)}
                  </th>
                ))}
                <th className="px-3 py-2" />
              </tr>
            </thead>
            {GROUPS.map((g) => {
              const lines = data.lines.filter((l) => l.group === g.id);
              if (!lines.length) return null;
              return (
                <tbody key={g.id}>
                  <tr className="border-b border-rule bg-fog">
                    <th colSpan={months.length + 2} scope="colgroup" className="sticky left-0 px-3 py-1.5 text-left font-semibold">
                      {g.label}
                    </th>
                  </tr>
                  {lines.map((l) => (
                    <tr key={l.id} className="border-b border-rule">
                      <th scope="row" className="sticky left-0 z-10 min-w-[16rem] whitespace-nowrap bg-paper px-3 py-1 text-left font-normal">
                        {renaming === l.id ? (
                          <input
                            autoFocus
                            defaultValue={l.name}
                            onBlur={(e) => {
                              const v = e.target.value.trim();
                              if (v && v !== l.name)
                                update((d) => {
                                  const x = d.lines.find((y) => y.id === l.id);
                                  if (x) x.name = v;
                                });
                              setRenaming(null);
                            }}
                            onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
                            className="w-full rounded border border-plum px-2 py-1"
                          />
                        ) : (
                          <button
                            onClick={() => setRenaming(l.id)}
                            title={l.note ?? "Rename"}
                            className="text-left hover:text-sea"
                          >
                            {l.name}
                            {l.computed && <span className="ml-1 text-xs text-muted">(calculated)</span>}
                          </button>
                        )}
                      </th>
                      {months.map((m) => {
                        const r = byMonth.get(m)!;
                        const actual = !!data.actuals[m];
                        if (actual || l.computed)
                          return (
                            <td key={m} className={`num px-2 py-1 text-right ${actual ? "bg-sea-wash" : "text-muted"}`}>
                              {money(r.lines[l.id] ?? 0)}
                            </td>
                          );
                        return (
                          <td key={m} className="px-0.5 py-1">
                            <NumField
                              ariaLabel={`${l.name}, ${monthLabel(m, "long")}`}
                              value={scenario.plan.lineValues[l.id]?.[m] ?? 0}
                              onCommit={(v) =>
                                updatePlan((p) => {
                                  p.lineValues[l.id] ??= {};
                                  p.lineValues[l.id][m] = v ?? 0;
                                })
                              }
                              className="w-full"
                            />
                          </td>
                        );
                      })}
                      <td className="whitespace-nowrap px-3 py-1 text-right">
                        {!l.computed && openMonths.length > 1 && (
                          <button onClick={() => fillForward(l.id)} className="text-xs text-sea hover:underline">
                            Copy across
                          </button>
                        )}
                        {!l.computed && (
                          <button
                            onClick={() => deleteLine(l.id, l.name)}
                            className="ml-3 text-xs text-muted hover:text-loss"
                            aria-label={`Delete ${l.name}`}
                          >
                            Delete
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              );
            })}
          </table>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            addLine();
          }}
          className="mt-4 flex flex-wrap items-end gap-3"
        >
          <div>
            <label htmlFor="new-line" className="block text-sm font-medium">
              Add a cost line
            </label>
            <input
              id="new-line"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="e.g. New hire: clinical director"
              className="mt-1 w-72 rounded-md border border-rule bg-paper px-3 py-1.5 text-sm"
            />
          </div>
          <select
            aria-label="Where the cost belongs"
            value={newGroup}
            onChange={(e) => setNewGroup(e.target.value as LineGroup)}
            className="rounded-md border border-rule bg-paper px-2 py-1.5 text-sm"
          >
            {GROUPS.map((g) => (
              <option key={g.id} value={g.id}>
                {g.label}
              </option>
            ))}
          </select>
          <button disabled={!newName.trim()} className="rounded-md bg-sea px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50">
            Add line
          </button>
          <p className="w-full text-xs text-muted">New lines appear in every scenario at $0. Fill in the months that apply.</p>
        </form>
      </section>
    </div>
  );
}

function RoleRow({ label, value, onChange }: { label: string; value: Role; onChange: (v: Role) => void }) {
  return (
    <div className="flex items-center justify-between gap-4 py-2.5">
      <span className="text-sm">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as Role)}
        className="rounded-md border border-rule bg-paper px-2 py-1 text-sm"
      >
        <option value="partTime">Part-time</option>
        <option value="fullTime">Full-time</option>
      </select>
    </div>
  );
}
