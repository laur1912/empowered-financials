"use client";

import type { YearSummary } from "@/lib/engine";
import { count, money, moneyK, pct, signed } from "@/lib/format";
import { monthLabel } from "@/lib/model";
import type { MonthResult } from "@/lib/types";

export default function BottomLine({
  year,
  scenarioName,
  baselineName,
  summary,
  baseSummary,
  results,
  baseResults,
}: {
  year: number;
  scenarioName: string;
  baselineName: string;
  summary: YearSummary;
  baseSummary: YearSummary | null;
  results: MonthResult[];
  baseResults: MonthResult[] | null;
}) {
  const d = baseSummary
    ? {
        ebitda: summary.ebitda - baseSummary.ebitda,
        margin: summary.margin - baseSummary.margin,
        revenue: summary.revenue - baseSummary.revenue,
        sessions: summary.sessions - baseSummary.sessions,
        payroll: summary.totalPayroll - baseSummary.totalPayroll,
        overhead: summary.totalOverhead - baseSummary.totalOverhead,
        therapists: summary.endTherapists - baseSummary.endTherapists,
      }
    : null;

  const status =
    summary.actualMonths === 12
      ? `All of ${year} is actual numbers.`
      : summary.actualMonths === 0
        ? `All of ${year} is forecast.`
        : `${summary.actualMonths} months actual, ${12 - summary.actualMonths} forecast.`;

  return (
    <section aria-label={`${year} bottom line`} className="mt-6 grid gap-8 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
      <div>
        <p className="text-sm text-muted">
          {year} profit (EBITDA) · {scenarioName}
        </p>
        <p className="mt-1 inline-block">
          <span className="bottom-line num text-5xl font-bold tracking-tight sm:text-6xl">{money(summary.ebitda)}</span>
        </p>
        {d && (
          <p className={`mt-3 text-sm font-medium ${d.ebitda >= 0 ? "text-gain" : "text-loss"}`}>
            {signed(d.ebitda, money)} compared with {baselineName}
          </p>
        )}
        <p className="mt-2 text-sm text-muted">{status}</p>

        <dl className="mt-6 grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3">
          <Stat label="Margin" value={pct(summary.margin)} delta={d && Math.abs(d.margin) >= 0.0005 ? signed(d.margin * 100, (x) => `${x.toFixed(1)} pts`) : null} good={d ? d.margin >= 0 : true} />
          <Stat label="Revenue" value={moneyK(summary.revenue)} delta={d && Math.abs(d.revenue) >= 0.5 ? signed(d.revenue, moneyK) : null} good={d ? d.revenue >= 0 : true} />
          <Stat label="Sessions" value={count(summary.sessions)} delta={d && Math.abs(d.sessions) >= 0.5 ? signed(d.sessions, count) : null} good={d ? d.sessions >= 0 : true} />
          <Stat
            label="Total payroll"
            value={moneyK(summary.totalPayroll)}
            delta={d && Math.abs(d.payroll) >= 0.5 ? signed(d.payroll, moneyK) : null}
            good={d ? d.payroll <= 0 : true}
          />
          <Stat
            label="Total overhead"
            value={moneyK(summary.totalOverhead)}
            delta={d && Math.abs(d.overhead) >= 0.5 ? signed(d.overhead, moneyK) : null}
            good={d ? d.overhead <= 0 : true}
          />
          <Stat
            label="Therapists in Dec"
            value={count(summary.endTherapists)}
            delta={d && Math.abs(d.therapists) >= 0.5 ? signed(d.therapists, count) : null}
            good={d ? d.therapists >= 0 : true}
          />
        </dl>
      </div>

      <ProfitBars results={results} baseResults={baseResults} baselineName={baselineName} />
    </section>
  );
}

function Stat({ label, value, delta, good }: { label: string; value: string; delta: string | null; good: boolean }) {
  return (
    <div>
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="num text-lg font-semibold">{value}</dd>
      {delta && (
        <dd className={`num text-xs font-medium ${good ? "text-gain" : "text-loss"}`}>{delta}</dd>
      )}
    </div>
  );
}

function ProfitBars({
  results,
  baseResults,
  baselineName,
}: {
  results: MonthResult[];
  baseResults: MonthResult[] | null;
  baselineName: string;
}) {
  const W = 720;
  const H = 260;
  const top = 20;
  const bottom = 34;
  const values = results.map((r) => r.ebitda).concat(baseResults?.map((r) => r.ebitda) ?? []);
  const max = Math.max(1, ...values);
  const min = Math.min(0, ...values);
  const span = max - min || 1;
  const plotH = H - top - bottom;
  const y = (v: number) => top + ((max - v) / span) * plotH;
  const slot = W / Math.max(results.length, 1);
  const bw = slot * 0.56;
  const zero = y(0);

  return (
    <figure className="min-w-0">
      <figcaption className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
        <span>Monthly profit</span>
        <Legend swatch="bg-sea" label="Actual" />
        <Legend swatch="bg-sea-soft" label="Forecast" />
        {baseResults && <Legend swatch="border-2 border-plum" label={baselineName} />}
      </figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} className="mt-2 w-full" role="img" aria-label="Monthly profit chart">
        <defs>
          <pattern id="hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <rect width="6" height="6" fill="var(--color-sea-soft)" />
            <line x1="0" y1="0" x2="0" y2="6" stroke="var(--color-sea-wash)" strokeWidth="2" />
          </pattern>
        </defs>
        <line x1="0" x2={W} y1={zero} y2={zero} stroke="var(--color-ink)" strokeWidth="1" />
        {results.map((r, i) => {
          const cx = i * slot + slot / 2;
          const v = r.ebitda;
          const b = baseResults?.[i];
          return (
            <g key={r.month}>
              <rect
                x={cx - bw / 2}
                y={Math.min(y(v), zero)}
                width={bw}
                height={Math.max(1, Math.abs(y(v) - zero))}
                fill={r.isActual ? "var(--color-sea)" : "url(#hatch)"}
                rx="2"
              >
                <title>
                  {monthLabel(r.month, "long")}: {money(v)} {r.isActual ? "(actual)" : "(forecast)"}
                  {b ? `\n${baselineName}: ${money(b.ebitda)}` : ""}
                </title>
              </rect>
              {b && Math.abs(b.ebitda - v) > 0.5 && (
                <line
                  x1={cx - bw / 2 - 4}
                  x2={cx + bw / 2 + 4}
                  y1={y(b.ebitda)}
                  y2={y(b.ebitda)}
                  stroke="var(--color-plum)"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                />
              )}
              <text x={cx} y={H - bottom + 16} textAnchor="middle" fontSize="12" fill="var(--color-muted)">
                {monthLabel(r.month)}
              </text>
              <text
                x={cx}
                y={v >= 0 ? y(v) - 5 : y(v) + 13}
                textAnchor="middle"
                fontSize="10.5"
                fill="var(--color-ink)"
                className="num"
              >
                {moneyK(v)}
              </text>
            </g>
          );
        })}
      </svg>
    </figure>
  );
}

function Legend({ swatch, label }: { swatch: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`inline-block h-2.5 w-2.5 rounded-sm ${swatch}`} />
      {label}
    </span>
  );
}
