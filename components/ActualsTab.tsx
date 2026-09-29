"use client";

import { useEffect, useState } from "react";
import { computeLine, monthsOfYear } from "@/lib/engine";
import { money } from "@/lib/format";
import { closeMonth, monthLabel, reopenMonth } from "@/lib/model";
import type { AppData, LineGroup, MonthActual, MonthResult, Plan } from "@/lib/types";
import { NumField } from "./Inputs";

const GROUPS: { id: LineGroup; label: string }[] = [
  { id: "otherRevenue", label: "Other revenue" },
  { id: "practicePayroll", label: "Practice payroll" },
  { id: "practiceOverhead", label: "Practice overhead" },
  { id: "corporatePayroll", label: "Corporate payroll" },
  { id: "corporateOverhead", label: "Corporate overhead" },
];

export default function ActualsTab({
  data,
  plan,
  year,
  results,
  update,
}: {
  data: AppData;
  plan: Plan;
  year: number;
  results: MonthResult[];
  update: (fn: (d: AppData) => AppData | void) => void;
}) {
  const months = monthsOfYear(data.months, year);
  const firstOpen = months.find((m) => !data.actuals[m]);
  const [month, setMonth] = useState<string>(firstOpen ?? months[months.length - 1]);
  useEffect(() => {
    if (!months.includes(month)) setMonth(months.find((m) => !data.actuals[m]) ?? months[months.length - 1]);
  }, [year]); // eslint-disable-line react-hooks/exhaustive-deps

  const actual = data.actuals[month];
  const r = results.find((x) => x.month === month)!;

  const edit = (fn: (a: MonthActual) => void) =>
    update((d) => {
      const a = d.actuals[month];
      if (a) fn(a);
    });

  return (
    <section aria-label="Enter actual numbers" className="grid gap-8 lg:grid-cols-[220px_minmax(0,1fr)]">
      <div>
        <p className="text-sm text-muted">
          Actual numbers are shared by every scenario. Pick a month to record or correct it.
        </p>
        <ul className="mt-4 grid grid-cols-3 gap-1 lg:grid-cols-1">
          {months.map((m) => {
            const done = !!data.actuals[m];
            return (
              <li key={m}>
                <button
                  onClick={() => setMonth(m)}
                  aria-current={m === month ? "true" : undefined}
                  className={`flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm ${
                    m === month ? "bg-teal-dk text-white" : "hover:bg-paper"
                  }`}
                >
                  <span>{monthLabel(m, "long")}</span>
                  <span
                    className={`hidden text-xs lg:inline ${m === month ? "text-white/80" : done ? "text-sea" : "text-muted"}`}
                  >
                    {done ? "Actual" : m === firstOpen ? "Up next" : "Forecast"}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      <div className="min-w-0">
        <h2 className="text-3xl">{monthLabel(month, "long")}</h2>

        {!actual ? (
          <div className="card mt-4 max-w-prose p-6">
            <p>
              This month is still a forecast. Record the actual numbers once the month is over. The form starts with the
              forecast so you only change what was different.
            </p>
            <p className="mt-2 text-sm text-muted">
              Forecast profit for this month: <span className="num font-semibold text-ink">{money(r.ebitda)}</span>
            </p>
            <button
              onClick={() => update((d) => closeMonth(d, plan, month))}
              className="btn mt-5"
            >
              Record actuals for {monthLabel(month, "long")}
            </button>
          </div>
        ) : (
          <div className="mt-4 grid gap-8">
            <p className="text-sm text-muted">
              Profit with these numbers: <span className="num font-semibold text-ink">{money(r.ebitda)}</span>. Changes save
              automatically.
            </p>

            <Fieldset title="Therapists and sessions">
              <Field label="Full-time therapists">
                <NumField value={actual.fullTime} onCommit={(v) => edit((a) => void (a.fullTime = v ?? 0))} className="w-28" />
              </Field>
              <Field label="Part-time therapists">
                <NumField value={actual.partTime} onCommit={(v) => edit((a) => void (a.partTime = v ?? 0))} className="w-28" />
              </Field>
              <Field label="Executives">
                <NumField value={actual.executives} onCommit={(v) => edit((a) => void (a.executives = v ?? 0))} className="w-28" />
              </Field>
              <Field label="New therapists who started">
                <NumField value={actual.newHires} onCommit={(v) => edit((a) => void (a.newHires = v ?? 0))} className="w-28" />
              </Field>
              <Field label="Therapists who left">
                <NumField value={actual.departures} onCommit={(v) => edit((a) => void (a.departures = v ?? 0))} className="w-28" />
              </Field>
              <Field label="Sessions">
                <NumField value={actual.sessions} onCommit={(v) => edit((a) => void (a.sessions = v ?? 0))} className="w-28 font-semibold" />
              </Field>
            </Fieldset>

            <Fieldset title="Revenue">
              <Field
                label="Actual revenue"
                hint={`Leave blank to use sessions × $${actual.rates.revenuePerSession} plus other revenue`}
              >
                <NumField
                  value={actual.revenue ?? null}
                  allowEmpty
                  placeholder={money(actual.sessions * actual.rates.revenuePerSession + r.otherRevenue)}
                  onCommit={(v) => edit((a) => void (a.revenue = v))}
                  className="w-32"
                />
              </Field>
            </Fieldset>

            {GROUPS.map((g) => {
              const lines = data.lines.filter((l) => l.group === g.id);
              if (!lines.length) return null;
              return (
                <Fieldset key={g.id} title={g.label}>
                  {lines.map((l) =>
                    l.computed ? (
                      <Field key={l.id} label={l.name} hint="Calculated. Type a number only if the real amount was different.">
                        <NumField
                          value={actual.computedOverrides[l.id] ?? null}
                          allowEmpty
                          placeholder={money(
                            computeLine(l.computed, actual.rates, {
                              sessions: actual.sessions,
                              executives: actual.executives,
                              totalTherapists: r.totalTherapists,
                              newHires: actual.newHires,
                            }),
                          )}
                          onCommit={(v) =>
                            edit((a) => {
                              if (v == null) delete a.computedOverrides[l.id];
                              else a.computedOverrides[l.id] = v;
                            })
                          }
                          className="w-32"
                        />
                      </Field>
                    ) : (
                      <Field key={l.id} label={l.name}>
                        <NumField
                          value={actual.lines[l.id] ?? 0}
                          onCommit={(v) => edit((a) => void (a.lines[l.id] = v ?? 0))}
                          className="w-32"
                        />
                      </Field>
                    ),
                  )}
                </Fieldset>
              );
            })}

            <div>
              <label htmlFor="month-note" className="text-sm font-medium">
                Note for this month
              </label>
              <textarea
                id="month-note"
                key={month}
                defaultValue={actual.note ?? ""}
                onBlur={(e) => e.target.value !== (actual.note ?? "") && edit((a) => void (a.note = e.target.value))}
                rows={2}
                className="mt-2 w-full max-w-prose rounded-md border border-rule bg-paper px-3 py-2 text-sm"
              />
            </div>

            <div>
              <button
                onClick={() => {
                  if (confirm(`Turn ${monthLabel(month, "long")} back into a forecast? The actual numbers you entered will be deleted.`))
                    update((d) => reopenMonth(d, month));
                }}
                className="text-sm text-loss underline"
              >
                Turn this month back into a forecast
              </button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

function Fieldset({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <fieldset className="card px-5 pb-2 pt-3">
      <legend className="px-1 text-sm font-semibold">{title}</legend>
      <div className="divide-y divide-rule">{children}</div>
    </fieldset>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 py-2">
      <div>
        <p className="text-sm">{label}</p>
        {hint && <p className="text-xs text-muted">{hint}</p>}
      </div>
      {children}
    </div>
  );
}
