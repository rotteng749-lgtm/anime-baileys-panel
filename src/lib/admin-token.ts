/**
 * Where the admin bearer token lives in the browser.
 *
 * It is an opaque, server-side-hashed session token with a twelve hour life.
 * It is deliberately kept out of the member auth flow — the admin area is a
 * separate door with separate credentials.
 */
export const ADMIN_TOKEN_KEY = "anime-baileys-admin-token";

export function readAdminToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(ADMIN_TOKEN_KEY);
}

export function writeAdminToken(token: string) {
  window.localStorage.setItem(ADMIN_TOKEN_KEY, token);
}

export function clearAdminToken() {
  window.localStorage.removeItem(ADMIN_TOKEN_KEY);
}
