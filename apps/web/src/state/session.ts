/**
 * Session store (frontend/02-state-viewmodels-and-mappers.md#session-store-statesessionts, `DEC-08`).
 * `{ token, expiresAt, me }` persisted in `localStorage["insta.session"]`, exposed with `useSyncExternalStore`;
 * the `storage` event keeps tabs in sync (logout in one tab logs out all tabs).
 */
import { useSyncExternalStore } from "react";

import { isApiError } from "../api/http";
import { getMe } from "../api/users";
import { toMeVM, type MeViewModel } from "./mappers/user";

export const SESSION_STORAGE_KEY = "insta.session";

export type SessionState = {
  token: string | null;
  expiresAt: string | null;
  me: MeViewModel | null;
};

const EMPTY: SessionState = Object.freeze({ token: null, expiresAt: null, me: null });

function storage(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

function isExpired(expiresAt: string | null, now = Date.now()): boolean {
  if (!expiresAt) return false;
  const t = new Date(expiresAt).getTime();
  return Number.isFinite(t) && t <= now;
}

/** Parses the persisted value; anything malformed or expired is treated as signed out. */
export function parseStoredSession(raw: string | null, now = Date.now()): SessionState {
  if (!raw) return EMPTY;
  try {
    const value = JSON.parse(raw) as Partial<SessionState> | null;
    if (!value || typeof value.token !== "string" || value.token === "") return EMPTY;
    const expiresAt = typeof value.expiresAt === "string" ? value.expiresAt : null;
    if (isExpired(expiresAt, now)) return EMPTY;
    const me = value.me && typeof value.me === "object" && typeof value.me.id === "string" ? value.me : null;
    return { token: value.token, expiresAt, me };
  } catch {
    return EMPTY;
  }
}

let state: SessionState = parseStoredSession(storage()?.getItem(SESSION_STORAGE_KEY) ?? null);
const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of listeners) listener();
}

function persist(next: SessionState): void {
  const store = storage();
  if (!store) return;
  try {
    if (next.token) store.setItem(SESSION_STORAGE_KEY, JSON.stringify(next));
    else store.removeItem(SESSION_STORAGE_KEY);
  } catch {
    /* quota / private mode: keep the in-memory session */
  }
}

function setState(next: SessionState): void {
  state = next;
  persist(next);
  emit();
}

export function getSession(): SessionState {
  return state;
}

/** Current bearer token (read by the API client on every request). */
export function getSessionToken(): string | null {
  if (state.token && isExpired(state.expiresAt)) {
    clearSession();
    return null;
  }
  return state.token;
}

export function subscribeSession(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Stores a fresh session after signup/login (`AuthTokenResponseDto` mapped by the caller). */
export function setSession(next: { token: string; expiresAt: string; me: MeViewModel }): void {
  setState({ token: next.token, expiresAt: next.expiresAt, me: next.me });
}

/** Replaces the cached `me` (after `GET /me` or `PATCH /me`). No-op when signed out. */
export function setSessionMe(me: MeViewModel): void {
  if (!state.token) return;
  setState({ ...state, me });
}

export function clearSession(): void {
  if (state === EMPTY) return;
  setState(EMPTY);
}

/** Cross-tab sync: another tab logged in/out or refreshed `me`. */
function onStorage(event: StorageEvent): void {
  if (event.key !== null && event.key !== SESSION_STORAGE_KEY) return;
  state = parseStoredSession(storage()?.getItem(SESSION_STORAGE_KEY) ?? null);
  emit();
}

if (typeof window !== "undefined") window.addEventListener("storage", onStorage);

/** Boot step: with a stored token, refresh `me` via `GET /me`; a `401` clears the session. */
export async function bootstrapSession(): Promise<void> {
  if (!getSessionToken()) return;
  try {
    setSessionMe(toMeVM(await getMe()));
  } catch (error) {
    if (isApiError(error) && error.status === 401) clearSession();
    // Other failures (offline, 5xx) keep the cached session; pages retry on their own.
  }
}

export function useSession(): SessionState {
  return useSyncExternalStore(subscribeSession, getSession, getSession);
}

export function useIsAuthenticated(): boolean {
  return useSession().token !== null;
}

export function useMe(): MeViewModel | null {
  return useSession().me;
}
