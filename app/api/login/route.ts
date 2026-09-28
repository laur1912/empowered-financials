import { NextResponse } from "next/server";
import { COOKIE, tokenFor } from "@/lib/auth";

export async function POST(req: Request) {
  const { password } = (await req.json().catch(() => ({}))) as { password?: string };
  const pw = process.env.APP_PASSWORD;
  if (!pw) return NextResponse.json({ error: "APP_PASSWORD is not set on the server." }, { status: 500 });
  if (password !== pw) return NextResponse.json({ error: "That password isn't right." }, { status: 401 });
  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIE, await tokenFor(pw), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  return res;
}
