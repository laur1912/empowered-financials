"use client";

import { useState } from "react";
import { profitPerSession } from "@/lib/engine";
import { count, money } from "@/lib/format";
import { monthLabel, nextMonthKey } from "@/lib/model";
import type { AppData, Plan, Scenario } from "@/lib/types";
import { NumField } from "./Inputs";
import Sheet from "./Sheet";

export default function RoomToGrow({
  data,
  scenario,
  updatePlan,
  onClose,
  openHiring,
}: {
  data: AppData;
  scenario: Scenario;
  updatePlan: (fn: (p: Plan) => void) => void;
  onClose: () => void;
  openHiring: () => void;
}) {
  const a = scenario.plan.assumptions;
  const [therapists, setTherapists] = useState(10);
  const [openings, setOpenings] = useState(45);
  const [fit, setFit] = useState(75);
  const [leavingOverride, setLeavingOverride] = useState<number | null>(null);
  const [newClients, setNewClients] = useState(25);
  const [perClient, setPerClient] = useState(a.sessionsPerClient);
  const [done, setDone] = useState<string | null>(null);

  const R = Math.max(1, Math.round(a.rampMonths));
  const leaving = leavingOverride ?? Math.round(therapists * a.turnoverClientsPerTherapist);
  const fillable = Math.round((openings * fit) / 100);
  const hardToFill = openings - fillable;
  const net = newClients - leaving;
  const monthsToFill = net > 0 ? fillable / net : Infinity;
  const perClientProfit = perClient * profitPerSession(a);
  const valueFilled = fillable * perClientProfit;
  const adToFill = fillable * a.costPerNewClient;
  const adPerMonth = newClients * a.costPerNewClient;
  const neededForRamp = Math.ceil(leaving + fillable / R);

  const firstOpen = data.months.find((m) => !data.actuals[m]) ?? nextMonthKey(data.months[data.months.length - 1]);
  const monthAfter = (k: number) => {
    let m = firstOpen;
    for (let i = 0; i < k; i++) m = nextMonthKey(m);
    return m;
  };
  const waitMonths = Number.isFinite(monthsToFill) ? Math.max(0, Math.floor(monthsToFill - R)) : null;
  const hireMonth = waitMonths != null ? monthAfter(waitMonths) : null;
  const hireMonthInPlan = hireMonth != null && data.months.includes(hireMonth) && !data.actuals[hireMonth];

  let verdict: { title: string; body: string; tone: "sea" | "plum" | "loss" };
  if (net <= 0) {
    verdict = {
      title: "Fill spots before hiring",
      tone: "loss",
      body: `You're bringing in ${count(newClients)} clients a month and losing about ${count(leaving)}, so open spots aren't shrinking. A new therapist would add ${a.clientsPerNewTherapist} more empty spots. To fill what you have in ${R} months you'd need about ${count(neededForRamp)} new clients a month (${money(neededForRamp * a.costPerNewClient)} in ads).`,
    };
  } else if (monthsToFill <= R) {
    verdict = {
      title: "Start hiring now",
      tone: "sea",
      body: `Your fillable spots should be full in about ${monthsToFill.toFixed(1)} months, and a new therapist takes about ${R} months to fill up. Hiring now means they're ready as you run out of room.`,
    };
  } else {
    verdict = {
      title: `Hold off; start hiring around ${monthLabel(hireMonth!, "long")}`,
      tone: "plum",
      body: `Your fillable spots last about ${monthsToFill.toFixed(1)} months at this pace. Filling them is the cheaper way to grow for now. Start hiring about ${waitMonths} month${waitMonths === 1 ? "" : "s"} from now so a new therapist is ready when you're full.`,
    };
  }

  // Open spots over the next 12 months if nobody new is hired.
  const timeline = Array.from({ length: 12 }, (_, t) => ({
    month: monthAfter(t),
    open: Math.max(0, fillable - Math.max(0, net) * (t + 1)),
  }));

  function planFilling() {
    // Spread the fillable spots over the coming months at the current net pace.
    let left = fillable;
    const pace = Math.max(1, net);
    updatePlan((p) => {
      for (const m of data.months) {
        if (left <= 0) break;
        if (data.actuals[m] || m < firstOpen) continue;
        const add = Math.min(pace, left);
        p.months[m] = { ...(p.months[m] ?? { hires: 0, departures: 0 }) };
        p.months[m].extraClients = (p.months[m].extraClients ?? 0) + add;
        left -= add;
      }
    });
    setDone(`Added ${count(fillable - left)} extra clients to ${scenario.name}, about ${count(pace)} a month.`);
  }

  function planHire() {
    if (!hireMonthInPlan) return;
    updatePlan((p) => {
      p.months[hireMonth!] = { ...(p.months[hireMonth!] ?? { hires: 0, departures: 0 }) };
      p.months[hireMonth!].hires += 1;
    });
    setDone(`Added a hire in ${monthLabel(hireMonth!, "long")} to ${scenario.name}.`);
  }

  const toneClass = { sea: "border-sea bg-sea-wash", plum: "border-plum bg-plum-wash", loss: "border-loss/50 bg-paper" }[verdict.tone];

  return (
    <Sheet
      open
      onClose={onClose}
      title="Should we hire or fill open spots?"
      subtitle="Enter what the schedules look like today. Nothing changes in the plan until you choose to add it."
    >
      <div className="grid gap-8 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <section aria-label="Your situation" className="grid content-start gap-3">
          <Field label="Therapists with open spots" value={therapists} onChange={(v) => setTherapists(v ?? 0)} />
          <Field label="Open client spots across them" value={openings} onChange={(v) => setOpenings(v ?? 0)} />
          <Slider
            label="Spots that fit when clients want to come"
            hint="Scheduling conflicts: a Tuesday 10am opening is harder to fill than an evening"
            value={fit}
            min={20}
            max={100}
            step={5}
            display={`${fit}%`}
            onChange={setFit}
          />
          <Field
            label="Clients who leave each month"
            hint={
              leavingOverride == null
                ? `Estimated: ${therapists} therapists × ${a.turnoverClientsPerTherapist}`
                : "Your number. Clear it to use the estimate."
            }
            value={leavingOverride}
            placeholder={String(leaving)}
            allowEmpty
            onChange={setLeavingOverride}
          />
          <Field
            label="New clients you can bring in each month"
            hint={`About ${money(adPerMonth)} a month in ads at $${a.costPerNewClient} per client`}
            value={newClients}
            onChange={(v) => setNewClients(v ?? 0)}
          />
          <Slider
            label="Sessions per client per month"
            hint="About 2.4 today; 3 is the goal"
            value={perClient}
            min={1.5}
            max={4}
            step={0.1}
            display={perClient.toFixed(1)}
            onChange={setPerClient}
          />
        </section>

        <section aria-label="Answer" className="grid content-start gap-5">
          <div className={`rounded-[20px] border-l-4 p-6 ${toneClass}`} role="status">
            <p className="display text-3xl">{verdict.title}</p>
            <p className="mt-2 max-w-prose">{verdict.body}</p>
          </div>

          <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Tile label="Fillable spots" value={count(fillable)} hint={hardToFill ? `${count(hardToFill)} hard to fill` : "all fit"} />
            <Tile label="Growing by" value={`${count(Math.max(0, net))}/mo`} hint="new minus leaving" />
            <Tile label="Ads to fill them" value={money(adToFill)} hint="one-time, on top of replacing leavers" />
            <Tile label="Profit once filled" value={`${money(valueFilled)}/mo`} hint={`${money(perClientProfit)} per client`} />
          </dl>

          <div className="card p-5">
            <p className="text-sm font-medium">Open spots if we don&apos;t hire</p>
            <div className="mt-3 flex h-28 items-end gap-1.5" role="img" aria-label="Open spots by month">
              {timeline.map((t, i) => {
                const isHire = waitMonths != null && i === waitMonths && net > 0;
                const isReady = waitMonths != null && i === waitMonths + R && net > 0;
                return (
                  <div key={t.month} className="flex h-full flex-1 flex-col items-center justify-end">
                    {isHire && <span className="mb-1 text-[10px] font-semibold text-plum">hire</span>}
                    {isReady && <span className="mb-1 text-[10px] font-semibold text-gain">ready</span>}
                    <div
                      className={`w-full max-w-8 rounded-t ${isHire ? "bg-plum" : "bg-sea-soft"}`}
                      style={{ height: `${fillable ? (t.open / fillable) * 100 : 0}%`, minHeight: t.open ? 2 : 0 }}
                      title={`${monthLabel(t.month, "long")}: ${count(t.open)} open`}
                    />
                    <span className="mt-1 text-[11px] text-muted">{monthLabel(t.month)}</span>
                  </div>
                );
              })}
            </div>
          </div>

          <ul className="grid gap-2 text-sm text-muted">
            {hardToFill > 0 && (
              <li>
                {count(hardToFill)} spots probably won&apos;t fill because of when they&apos;re offered. Shifting those hours can add room
                without hiring.
              </li>
            )}
            <li>
              Each filled spot is worth about {money(perClientProfit)} a month at {perClient.toFixed(1)} sessions per client, and{" "}
              {money(3 * profitPerSession(a))} at 3.
            </li>
          </ul>

          <div className="flex flex-wrap gap-3">
            {fillable > 0 && net > 0 && (
              <button onClick={planFilling} className="btn btn-sm">
                Add filling these spots to the plan
              </button>
            )}
            {hireMonthInPlan && net > 0 && (
              <button onClick={planHire} className="btn btn-sm btn-alt">
                Plan a hire for {monthLabel(hireMonth!, "long")}
              </button>
            )}
            <button onClick={openHiring} className="btn btn-sm btn-ghost">
              See what a hire costs
            </button>
          </div>
          {done && (
            <p className="text-sm text-gain" role="status">
              {done}
            </p>
          )}
          <p className="text-xs text-muted">Tip: save a new scenario first if you want to compare this against the current plan.</p>
        </section>
      </div>
    </Sheet>
  );
}

function Field({
  label,
  hint,
  value,
  placeholder,
  allowEmpty,
  onChange,
}: {
  label: string;
  hint?: string;
  value: number | null;
  placeholder?: string;
  allowEmpty?: boolean;
  onChange: (v: number | null) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-xl bg-paper px-4 py-3">
      <div>
        <p className="text-sm font-medium">{label}</p>
        {hint && <p className="text-xs text-muted">{hint}</p>}
      </div>
      <NumField
        ariaLabel={label}
        value={value}
        placeholder={placeholder}
        allowEmpty={allowEmpty}
        onCommit={(v) => onChange(v == null ? null : Math.max(0, v))}
        className="w-20 font-semibold"
      />
    </div>
  );
}

function Slider({
  label,
  hint,
  value,
  min,
  max,
  step,
  display,
  onChange,
}: {
  label: string;
  hint?: string;
  value: number;
  min: number;
  max: number;
  step: number;
  display: string;
  onChange: (v: number) => void;
}) {
  return (
    <div className="rounded-xl bg-paper px-4 py-3">
      <div className="flex items-baseline justify-between gap-4">
        <p className="text-sm font-medium">{label}</p>
        <p className="num font-semibold">{display}</p>
      </div>
      <input
        type="range"
        aria-label={label}
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-2 w-full"
      />
      {hint && <p className="text-xs text-muted">{hint}</p>}
    </div>
  );
}

function Tile({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-xl bg-paper px-4 py-3">
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="num text-lg font-semibold">{value}</dd>
      {hint && <dd className="text-xs text-muted">{hint}</dd>}
    </div>
  );
}
