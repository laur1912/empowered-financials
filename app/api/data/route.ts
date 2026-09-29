import { NextResponse } from "next/server";
import { isAuthed } from "@/lib/auth";
import { load, save, storageKind } from "@/lib/storage";
import type { AppData } from "@/lib/types";

export const dynamic = "force-dynamic";

const fail = (e: unknown) =>
  NextResponse.json({ error: e instanceof Error ? e.message : "Storage error" }, { status: 500 });

export async function GET() {
  if (!(await isAuthed())) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  try {
    const stored = await load();
    return NextResponse.json({ ...stored, storage: storageKind });
  } catch (e) {
    return fail(e);
  }
}

export async function PUT(req: Request) {
  if (!(await isAuthed())) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  const body = (await req.json().catch(() => null)) as { data: AppData; rev: number } | null;
  if (!body?.data || typeof body.rev !== "number" || body.data.version !== 2) {
    return NextResponse.json({ error: "Malformed save request." }, { status: 400 });
  }
  try {
    const { ok, stored } = await save(body.data, body.rev);
    return NextResponse.json({ ...stored, storage: storageKind }, { status: ok ? 200 : 409 });
  } catch (e) {
    return fail(e);
  }
}
