import { cookies } from "next/headers";

export const SESSION_COOKIE_NAME = "cleannote_session";
const EXPIRES_IN = 60 * 60 * 24 * 7; // seconds

export async function setSessionCookie(token: string) {
  const c = await cookies();
  c.set({
    name: SESSION_COOKIE_NAME,
    value: token,
    maxAge: EXPIRES_IN,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    sameSite: "lax", // 'lax' usually OK for same-site requests
  });
}

export async function clearSessionCookie() {
  const c = await cookies();
  c.delete(SESSION_COOKIE_NAME);
}

export async function getSessionToken() {
  const c = (await cookies()).get("cleannote_session");
  return c?.value ?? null;
}