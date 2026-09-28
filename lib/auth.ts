import { cookies } from "next/headers";

export const COOKIE = "ef_session";

async function sha256(text: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export const passwordConfigured = () => !!process.env.APP_PASSWORD;

export async function tokenFor(password: string): Promise<string> {
  return sha256(`${password}:${process.env.AUTH_SECRET ?? "empowered"}`);
}

export async function isAuthed(): Promise<boolean> {
  const pw = process.env.APP_PASSWORD;
  if (!pw) return process.env.NODE_ENV !== "production"; // open locally, locked in production
  const jar = await cookies();
  const v = jar.get(COOKIE)?.value;
  return !!v && v === (await tokenFor(pw));
}
