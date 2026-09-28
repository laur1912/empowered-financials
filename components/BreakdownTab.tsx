"use client";

import { useState } from "react";
import { money, pct, count } from "@/lib/format";
import { monthLabel } from "@/lib/model";
import type { AppData, LineGroup, MonthResult } from "@/lib/types";

type RowDef = {
  id: string;
  label: string;
  get: (r: MonthResult) => number;
  kind?: "money" | "count" | "pct";
  level?: 0 | 1;
  emphasis?: "subtotal" | "bottom";
  expandable?: string; // group key
  parent?: string;
};

export default function BreakdownTab({
  data,
  year,
  results,
  scenarioName,
}: {
  data: AppData;
  year: number;
  results: MonthResult[];
  scenarioName: string;
}) {
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const rows = results.filter((r) => r.month.startsWith(`${year}-`));

  const linesOf = (g: LineGroup, parent: string): RowDef[] =>
    data.lines
      .filter((l) => l.group === g)
      .filter((l) => rows.some((r) => (r.lines[l.id] ?? 0) !== 0))
      .map((l) => ({ id: l.id, label: l.name, get: (r) => r.lines[l.id] ?? 0, level: 1, parent }));

  const defs: RowDef[] = [
    { id: "therapists", label: "Therapists", get: (r) => r.totalTherapists, kind: "count" },
    { id: "sessions", label: "Sessions", get: (r) => r.sessions, kind: "count" },
    { id: "revenue", label: "Revenue", get: (r) => r.revenue, expandable: "revenue", emphasis: "subtotal" },
    { id: "rev-sessions", label: "From sessions", get: (r) => r.sessionRevenue, level: 1, parent: "revenue" },
    ...linesOf("otherRevenue", "revenue"),
    { id: "pp", label: "Practice payroll", get: (r) => r.practicePayroll, expandable: "pp" },
    ...linesOf("practicePayroll", "pp"),
    { id: "pp-tax", label: "Employment tax", get: (r) => r.practiceTax, level: 1, parent: "pp" },
    { id: "po", label: "Practice overhead", get: (r) => r.practiceOverhead, expandable: "po" },
    ...linesOf("practiceOverhead", "po"),
    { id: "pn", label: "Practice net", get: (r) => r.practiceNet, emphasis: "subtotal" },
    { id: "cp", label: "Corporate payroll", get: (r) => r.corporatePayroll, expandable: "cp" },
    ...linesOf("corporatePayroll", "cp"),
    { id: "cp-tax", label: "Employment tax", get: (r) => r.corporateTax, level: 1, parent: "cp" },
    { id: "co", label: "Corporate overhead", get: (r) => r.corporateOverhead, expandable: "co" },
    ...linesOf("corporateOverhead", "co"),
    { id: "ebitda", label: "Company profit (EBITDA)", get: (r) => r.ebitda, emphasis: "bottom" },
    { id: "margin", label: "Profit margin", get: (r) => r.margin, kind: "pct" },
    { id: "tp", label: "Total payroll (practice + corporate)", get: (r) => r.totalPayroll },
    { id: "to", label: "Total overhead (practice + corporate)", get: (r) => r.totalOverhead },
  ];

  const visible = defs.filter((d) => !d.parent || open[d.parent]);

  const total = (d: RowDef) => {
    if (d.kind === "pct") {
      const rev = rows.reduce((s, r) => s + r.revenue, 0);
      return rev ? rows.reduce((s, r) => s + r.ebitda, 0) / rev : 0;
    }
    if (d.id === "therapists") return rows.length ? rows[rows.length - 1].totalTherapists : 0;
    return rows.reduce((s, r) => s + d.get(r), 0);
  };
  const fmt = (d: RowDef, v: number) => (d.kind === "count" ? count(v) : d.kind === "pct" ? pct(v) : money(v));

  function downloadCsv() {
    const header = ["", ...rows.map((r) => `${monthLabel(r.month)} ${year}${r.isActual ? " (actual)" : ""}`), `${year} total`];
    const esc = (s: string) => `"${s.replace(/"/g, '""')}"`;
    const lines = [header.map(esc).join(",")];
    for (const d of defs) {
      const vals = rows.map((r) => d.get(r));
      const f = (v: number) => (d.kind === "pct" ? (v * 100).toFixed(1) + "%" : String(Math.round(v * 100) / 100));
      lines.push([esc((d.level ? "   " : "") + d.label), ...vals.map(f), f(total(d))].join(","));
    }
    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `empowered-${year}-${scenarioName.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  return (
    <section aria-label={`${year} monthly breakdown`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-prose text-sm text-muted">
          Shaded columns are actual numbers. Open a row to see the costs inside it.
        </p>
        <div className="flex gap-2">
          <button
            onClick={() => {
              const all = Object.fromEntries(defs.filter((d) => d.expandable).map((d) => [d.expandable!, true]));
              setOpen(Object.keys(open).some((k) => open[k]) ? {} : all);
            }}
            className="rounded-md border border-rule bg-paper px-3 py-1.5 text-sm hover:border-sea"
          >
            {Object.values(open).some(Boolean) ? "Collapse all" : "Expand all"}
          </button>
          <button onClick={downloadCsv} className="rounded-md border border-rule bg-paper px-3 py-1.5 text-sm hover:border-sea">
            Download CSV
          </button>
        </div>
      </div>

      <div className="mt-4 overflow-x-auto rounded-lg border border-rule bg-paper">
        <table className="w-full min-w-[1300px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-rule">
              <th className="sticky left-0 z-10 bg-paper px-3 py-2 text-left font-medium text-muted" />
              {rows.map((r) => (
                <th key={r.month} className={`px-2 py-2 text-right font-medium ${r.isActual ? "bg-sea-wash" : ""}`}>
                  {monthLabel(r.month)}
                </th>
              ))}
              <th className="px-3 py-2 text-right font-semibold">{year}</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((d) => {
              const bottom = d.emphasis === "bottom";
              const sub = d.emphasis === "subtotal";
              return (
                <tr
                  key={d.id}
                  className={`border-b border-rule last:border-0 ${d.level ? "text-muted" : ""} ${bottom ? "bg-fog" : ""}`}
                >
                  <th
                    scope="row"
                    className={`sticky left-0 z-10 min-w-[17rem] whitespace-nowrap px-3 py-1.5 text-left ${bottom ? "bg-fog" : "bg-paper"} ${
                      d.level ? "pl-8 font-normal" : sub || bottom ? "font-semibold" : "font-medium"
                    }`}
                  >
                    {d.expandable ? (
                      <button
                        onClick={() => setOpen((o) => ({ ...o, [d.expandable!]: !o[d.expandable!] }))}
                        aria-expanded={!!open[d.expandable]}
                        className="flex items-center gap-1.5 text-left hover:text-sea"
                      >
                        <span aria-hidden className={`inline-block w-3 transition-transform ${open[d.expandable] ? "rotate-90" : ""}`}>
                          ▸
                        </span>
                        {d.label}
                      </button>
                    ) : (
                      <span className={d.level ? "" : "pl-[18px]"}>{d.label}</span>
                    )}
                  </th>
                  {rows.map((r) => {
                    const v = d.get(r);
                    return (
                      <td
                        key={r.month}
                        className={`num px-2 py-1.5 text-right ${r.isActual && !bottom ? "bg-sea-wash/60" : ""} ${
                          v < 0 && (bottom || sub) ? "text-loss" : ""
                        } ${bottom || sub ? "font-semibold" : ""}`}
                      >
                        {fmt(d, v)}
                      </td>
                    );
                  })}
                  <td className={`num px-3 py-1.5 text-right font-semibold ${bottom ? "" : ""}`}>
                    <span className={bottom ? "bottom-line" : ""}>{fmt(d, total(d))}</span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
