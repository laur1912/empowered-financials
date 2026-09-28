"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { runPlan, summarizeYear, yearsOf } from "@/lib/engine";
import { addYear, clone, duplicateScenario } from "@/lib/model";
import type { AppData, Plan } from "@/lib/types";
import BottomLine from "./BottomLine";
import PlanTab from "./PlanTab";
import BreakdownTab from "./BreakdownTab";
import ActualsTab from "./ActualsTab";
import CostsTab from "./CostsTab";

type SaveState = "saved" | "unsaved" | "saving" | "error" | "conflict";
type Tab = "plan" | "breakdown" | "actuals" | "costs";

const TABS: { id: Tab; label: string }[] = [
  { id: "plan", label: "Plan" },
  { id: "breakdown", label: "Monthly breakdown" },
  { id: "actuals", label: "Enter actuals" },
  { id: "costs", label: "Costs & rates" },
];

export default function Planner() {
  const [data, setData] = useState<AppData | null>(null);
  const [storage, setStorage] = useState<"supabase" | "memory">("supabase");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<SaveState>("saved");
  const [scenarioId, setScenarioId] = useState<string>("");
  const [year, setYear] = useState<number>(new Date().getFullYear());
  const [tab, setTab] = useState<Tab>("plan");
  const [naming, setNaming] = useState<null | "new" | "rename">(null);
  const [nameText, setNameText] = useState("");

  const dataRef = useRef<AppData | null>(null);
  const revRef = useRef(0);
  const dirtyRef = useRef(false);
  const savingRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const conflictRef = useRef<{ data: AppData; rev: number } | null>(null);

  // ---------- load ----------
  useEffect(() => {
    fetch("/api/data")
      .then(async (r) => {
        if (r.status === 401) return window.location.reload();
        if (!r.ok) {
          const j = await r.json().catch(() => ({}));
          throw new Error(j.error ?? `Server responded ${r.status}`);
        }
        const j = await r.json();
        dataRef.current = j.data;
        revRef.current = j.rev;
        setData(j.data);
        setStorage(j.storage);
        setScenarioId(j.data.baselineId);
        const ys = yearsOf(j.data.months);
        setYear((y) => (ys.includes(y) ? y : ys[ys.length - 1]));
      })
      .catch((e) => setLoadError(String(e.message ?? e)));
  }, []);

  // ---------- save ----------
  const flush = useCallback(async () => {
    if (savingRef.current || !dirtyRef.current || !dataRef.current) return;
    savingRef.current = true;
    dirtyRef.current = false;
    setSaveState("saving");
    try {
      const r = await fetch("/api/data", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data: dataRef.current, rev: revRef.current }),
      });
      const j = await r.json();
      if (r.ok) {
        revRef.current = j.rev;
        setSaveState(dirtyRef.current ? "unsaved" : "saved");
      } else if (r.status === 409) {
        conflictRef.current = { data: j.data, rev: j.rev };
        dirtyRef.current = true;
        setSaveState("conflict");
      } else {
        dirtyRef.current = true;
        setSaveState("error");
      }
    } catch {
      dirtyRef.current = true;
      setSaveState("error");
    } finally {
      savingRef.current = false;
      if (dirtyRef.current && !conflictRef.current) {
        timerRef.current = setTimeout(flush, 3000);
      }
    }
  }, []);

  const update = useCallback(
    (fn: (d: AppData) => AppData | void) => {
      if (!dataRef.current) return;
      const draft = clone(dataRef.current);
      const next = fn(draft) ?? draft;
      dataRef.current = next;
      setData(next);
      dirtyRef.current = true;
      if (!conflictRef.current) {
        setSaveState("unsaved");
        if (timerRef.current) clearTimeout(timerRef.current);
        timerRef.current = setTimeout(flush, 900);
      }
    },
    [flush],
  );

  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (dirtyRef.current) e.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, []);

  function resolveConflict(keepMine: boolean) {
    const c = conflictRef.current;
    if (!c) return;
    conflictRef.current = null;
    revRef.current = c.rev;
    if (keepMine) {
      dirtyRef.current = true;
      flush();
    } else {
      dirtyRef.current = false;
      dataRef.current = c.data;
      setData(c.data);
      if (!c.data.scenarios.some((s) => s.id === scenarioId)) setScenarioId(c.data.baselineId);
      setSaveState("saved");
    }
  }

  // ---------- derived ----------
  const scenario = data?.scenarios.find((s) => s.id === scenarioId) ?? data?.scenarios[0];
  const baseline = data?.scenarios.find((s) => s.id === data.baselineId);
  const isBaseline = !!scenario && scenario.id === data?.baselineId;

  const results = useMemo(() => (data && scenario ? runPlan(data, scenario.plan) : []), [data, scenario]);
  const baseResults = useMemo(
    () => (data && baseline && !isBaseline ? runPlan(data, baseline.plan) : null),
    [data, baseline, isBaseline],
  );
  const years = useMemo(() => (data ? yearsOf(data.months) : []), [data]);

  const updatePlan = useCallback(
    (fn: (p: Plan) => void) =>
      update((d) => {
        const s = d.scenarios.find((x) => x.id === scenario?.id);
        if (!s) return;
        fn(s.plan);
        s.updatedAt = new Date().toISOString();
      }),
    [update, scenario?.id],
  );

  if (loadError)
    return (
      <main className="mx-auto max-w-xl p-10">
        <p className="text-loss">The planner couldn&apos;t load its data: {loadError}. Refresh the page to try again.</p>
      </main>
    );
  if (!data || !scenario) return <main className="p-10 text-muted">Loading the planner…</main>;

  const summary = summarizeYear(results, year);
  const baseSummary = baseResults ? summarizeYear(baseResults, year) : null;

  // ---------- scenario actions ----------
  function commitName() {
    const name = nameText.trim();
    if (!name) return setNaming(null);
    if (naming === "new") {
      const { data: d, id } = duplicateScenario(dataRef.current!, scenario!.id, name);
      update(() => d);
      setScenarioId(id);
    } else if (naming === "rename") {
      update((d) => {
        const s = d.scenarios.find((x) => x.id === scenario!.id);
        if (s) s.name = name;
      });
    }
    setNaming(null);
  }

  function deleteScenario() {
    if (isBaseline) return;
    if (!confirm(`Delete the scenario “${scenario!.name}”? This can't be undone.`)) return;
    const id = scenario!.id;
    update((d) => {
      d.scenarios = d.scenarios.filter((s) => s.id !== id);
    });
    setScenarioId(data!.baselineId);
  }

  function makeMainPlan() {
    if (
      !confirm(
        `Make “${scenario!.name}” the main plan? Other scenarios will be compared against it from now on. The old main plan stays in the list.`,
      )
    )
      return;
    update((d) => {
      d.baselineId = scenario!.id;
    });
  }

  function addNextYear() {
    const next = years[years.length - 1] + 1;
    if (!confirm(`Add ${next}? Every scenario starts ${next} with its December costs carried forward and no hires planned.`))
      return;
    update((d) => addYear(d));
    setYear(next);
  }

  const saveLabel: Record<SaveState, string> = {
    saved: "All changes saved",
    unsaved: "Saving soon…",
    saving: "Saving…",
    error: "Couldn't save. Retrying…",
    conflict: "Someone else saved changes",
  };

  return (
    <div className="min-h-screen">
      <header className="border-b border-rule bg-paper">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-6 gap-y-3 px-4 py-3 sm:px-6">
          <div className="mr-auto">
            <h1 className="text-lg font-semibold tracking-tight">Empowered Therapy</h1>
            <p className="text-sm text-muted">Financial planner</p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <label htmlFor="scenario" className="text-sm text-muted">
              Scenario
            </label>
            {naming ? (
              <form
                className="flex items-center gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  commitName();
                }}
              >
                <input
                  autoFocus
                  value={nameText}
                  onChange={(e) => setNameText(e.target.value)}
                  placeholder={naming === "new" ? "e.g. Hire 3 in spring" : "Scenario name"}
                  className="w-52 rounded-md border border-plum bg-paper px-2 py-1.5 text-sm"
                  onKeyDown={(e) => e.key === "Escape" && setNaming(null)}
                />
                <button className="rounded-md bg-plum px-3 py-1.5 text-sm font-medium text-white">
                  {naming === "new" ? "Create" : "Rename"}
                </button>
                <button type="button" onClick={() => setNaming(null)} className="text-sm text-muted hover:text-ink">
                  Cancel
                </button>
              </form>
            ) : (
              <>
                <select
                  id="scenario"
                  value={scenario.id}
                  onChange={(e) => setScenarioId(e.target.value)}
                  className="rounded-md border border-rule bg-paper px-2 py-1.5 text-sm font-medium"
                >
                  {data.scenarios.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                      {s.id === data.baselineId ? " (main plan)" : ""}
                    </option>
                  ))}
                </select>
                <button
                  onClick={() => {
                    setNameText(`${scenario.name} (copy)`);
                    setNaming("new");
                  }}
                  className="rounded-md border border-plum px-2.5 py-1.5 text-sm font-medium text-plum hover:bg-plum-wash"
                >
                  Save as new scenario
                </button>
                <details className="relative">
                  <summary className="cursor-pointer list-none rounded-md px-2 py-1.5 text-sm text-muted hover:bg-fog hover:text-ink">
                    More
                  </summary>
                  <div className="absolute right-0 z-20 mt-1 w-56 rounded-md border border-rule bg-paper p-1 shadow-lg">
                    <MenuItem
                      onClick={() => {
                        setNameText(scenario.name);
                        setNaming("rename");
                      }}
                    >
                      Rename scenario
                    </MenuItem>
                    {!isBaseline && <MenuItem onClick={makeMainPlan}>Make this the main plan</MenuItem>}
                    {!isBaseline && (
                      <MenuItem onClick={deleteScenario} danger>
                        Delete scenario
                      </MenuItem>
                    )}
                    <MenuItem
                      onClick={async () => {
                        await fetch("/api/logout", { method: "POST" });
                        window.location.reload();
                      }}
                    >
                      Sign out
                    </MenuItem>
                  </div>
                </details>
              </>
            )}
          </div>

          <p
            role="status"
            className={`text-sm ${saveState === "error" || saveState === "conflict" ? "text-loss" : "text-muted"}`}
          >
            {saveLabel[saveState]}
          </p>
        </div>
      </header>

      {storage === "memory" && (
        <div className="bg-plum-wash px-4 py-2 text-center text-sm text-plum">
          Storage isn&apos;t connected, so changes disappear when the server restarts. Add the Supabase environment variables in Vercel to
          keep them.
        </div>
      )}
      {saveState === "conflict" && (
        <div className="flex flex-wrap items-center justify-center gap-3 bg-plum-wash px-4 py-2 text-sm">
          <span>Someone else saved changes while you were editing.</span>
          <button onClick={() => resolveConflict(false)} className="font-semibold text-plum underline">
            Load their version (discard mine)
          </button>
          <button onClick={() => resolveConflict(true)} className="font-semibold text-plum underline">
            Keep mine (overwrite theirs)
          </button>
        </div>
      )}

      <main className="mx-auto max-w-7xl px-4 pb-24 sm:px-6">
        <nav aria-label="Year" className="flex flex-wrap items-center gap-1 pt-6">
          {years.map((y) => (
            <button
              key={y}
              onClick={() => setYear(y)}
              aria-current={y === year ? "true" : undefined}
              className={`rounded-md px-3 py-1 text-sm font-medium ${
                y === year ? "bg-ink text-white" : "text-muted hover:bg-paper hover:text-ink"
              }`}
            >
              {y}
            </button>
          ))}
          <button onClick={addNextYear} className="rounded-md px-3 py-1 text-sm text-sea hover:bg-paper">
            Add {years[years.length - 1] + 1}
          </button>
        </nav>

        <BottomLine
          year={year}
          scenarioName={scenario.name}
          baselineName={baseline?.name ?? ""}
          summary={summary}
          baseSummary={baseSummary}
          results={results.filter((r) => r.month.startsWith(`${year}-`))}
          baseResults={baseResults?.filter((r) => r.month.startsWith(`${year}-`)) ?? null}
        />

        <div role="tablist" className="mt-8 flex flex-wrap gap-1 border-b border-rule">
          {TABS.map((t) => (
            <button
              key={t.id}
              role="tab"
              aria-selected={tab === t.id}
              onClick={() => setTab(t.id)}
              className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium ${
                tab === t.id ? "border-sea text-ink" : "border-transparent text-muted hover:text-ink"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="pt-6">
          {tab === "plan" && (
            <PlanTab
              data={data}
              scenario={scenario}
              isBaseline={isBaseline}
              year={year}
              results={results}
              updatePlan={updatePlan}
              updateNotes={(notes) =>
                update((d) => {
                  const s = d.scenarios.find((x) => x.id === scenario.id);
                  if (s) s.notes = notes;
                })
              }
            />
          )}
          {tab === "breakdown" && (
            <BreakdownTab data={data} year={year} results={results} scenarioName={scenario.name} />
          )}
          {tab === "actuals" && (
            <ActualsTab data={data} plan={scenario.plan} year={year} results={results} update={update} />
          )}
          {tab === "costs" && (
            <CostsTab data={data} scenario={scenario} year={year} results={results} update={update} updatePlan={updatePlan} />
          )}
        </div>
      </main>
    </div>
  );
}

function MenuItem({ children, onClick, danger }: { children: React.ReactNode; onClick: () => void; danger?: boolean }) {
  return (
    <button
      onClick={(e) => {
        (e.currentTarget.closest("details") as HTMLDetailsElement | null)?.removeAttribute("open");
        onClick();
      }}
      className={`block w-full rounded px-3 py-2 text-left text-sm hover:bg-fog ${danger ? "text-loss" : ""}`}
    >
      {children}
    </button>
  );
}
