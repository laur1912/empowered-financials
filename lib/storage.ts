import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import seed from "./seed-data.json";
import type { AppData } from "./types";

// One row holds the whole planner. See supabase/schema.sql.
const TABLE = "planner_state";
const ROW_ID = "empowered";

export interface Stored {
  data: AppData;
  rev: number;
}

export type StorageKind = "supabase" | "memory";

// Server-only. The secret key must never be given a NEXT_PUBLIC_ name.
const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

const db: SupabaseClient | null =
  url && key ? createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } }) : null;

// Fallback for local development only: resets whenever the server restarts.
const g = globalThis as unknown as { __efMemory?: Stored };

export const storageKind: StorageKind = db ? "supabase" : "memory";

function fresh(): Stored {
  return { data: JSON.parse(JSON.stringify(seed)) as AppData, rev: 0 };
}

async function readRow(client: SupabaseClient): Promise<Stored | null> {
  const { data, error } = await client.from(TABLE).select("data, rev").eq("id", ROW_ID).maybeSingle();
  if (error) throw new Error(`Supabase read failed: ${error.message}`);
  return data ? { data: data.data as AppData, rev: data.rev as number } : null;
}

export async function load(): Promise<Stored> {
  if (!db) {
    g.__efMemory ??= fresh();
    return g.__efMemory;
  }
  const existing = await readRow(db);
  if (existing) return existing;
  // First run: store the imported spreadsheet data. ignoreDuplicates keeps two first visits from clashing.
  const f = fresh();
  const { error } = await db
    .from(TABLE)
    .upsert({ id: ROW_ID, data: f.data, rev: 0 }, { onConflict: "id", ignoreDuplicates: true });
  if (error) throw new Error(`Supabase first save failed: ${error.message}`);
  return (await readRow(db)) ?? f;
}

/** Saves only if nobody else saved since `rev`. Returns the stored copy either way. */
export async function save(data: AppData, rev: number): Promise<{ ok: boolean; stored: Stored }> {
  if (!db) {
    const current = await load();
    if (current.rev !== rev) return { ok: false, stored: current };
    g.__efMemory = { data, rev: rev + 1 };
    return { ok: true, stored: g.__efMemory };
  }
  // The rev check happens inside the same UPDATE, so two simultaneous saves can't both win.
  const { data: rows, error } = await db
    .from(TABLE)
    .update({ data, rev: rev + 1, updated_at: new Date().toISOString() })
    .eq("id", ROW_ID)
    .eq("rev", rev)
    .select("rev");
  if (error) throw new Error(`Supabase save failed: ${error.message}`);
  if (!rows || rows.length === 0) return { ok: false, stored: await load() };
  return { ok: true, stored: { data, rev: rev + 1 } };
}
