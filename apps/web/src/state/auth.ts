/**
 * Auth mutations & form helpers (F-FE-02, frontend/02-state-viewmodels-and-mappers.md).
 *
 * - `useLoginMutation` / `useSignupMutation`: `LoginForm`/`SignupForm` → Request DTO (form mappers) → API →
 *   `AuthTokenResponseDto` → `MeViewModel` → session store + `["me"]` cache.
 * - `useLogoutMutation`: best-effort `POST /auth/logout`, then always clears the session, the query cache and toasts
 *   ("logout clears caches"). The SSE stream closes because `AppShell` stops `useLiveConnection` once signed out.
 * - Client-side checks mirror the contract limits so obvious mistakes never hit the API; the server stays the source
 *   of truth and its `VALIDATION_FAILED.details` are mapped onto the same fields.
 */
import { LIMITS, type AuthTokenResponseDto } from "@insta/contracts";
import { useMutation, useQueryClient, type QueryClient } from "@tanstack/react-query";

import { login, logout, signup } from "../api/auth";
import { toLoginDto, toMeVM, toSignupDto, type LoginForm, type SignupForm } from "./mappers/user";
import { queryKeys } from "./query-keys";
import { clearSession, getSessionToken, setSession } from "./session";
import { clearToasts } from "./toast";

export type { LoginForm, SignupForm };

/** Contract field limits re-exported for `ui/` (which imports only `state/`): counters & `maxLength`. */
export const FORM_LIMITS = LIMITS;

export type SignupField = keyof SignupForm;
export type LoginField = keyof LoginForm;

/** `VALIDATION_FAILED.details[].path` → form field (used with `mapApiErrorToFormErrors`). */
export const SIGNUP_FIELD_MAP: Partial<Record<string, SignupField>> = {
  username: "username",
  email: "email",
  password: "password",
  full_name: "fullName",
};

export const LOGIN_FIELD_MAP: Partial<Record<string, LoginField>> = {
  login: "login",
  password: "password",
};

export const EMPTY_SIGNUP_FORM: SignupForm = { username: "", email: "", password: "", fullName: "" };
export const EMPTY_LOGIN_FORM: LoginForm = { login: "", password: "" };

/** Same character rule as the contract `UsernameField` (checked after lowercasing). */
const USERNAME_PATTERN = /^[a-z0-9._]+$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function codePoints(value: string): number {
  return Array.from(value).length;
}

/** Username rule shared by signup and edit profile; `null` when valid. */
export function usernameError(raw: string): string | null {
  const value = raw.trim().toLowerCase();
  if (!value) return "Enter a username.";
  if (value.length < LIMITS.usernameMin || value.length > LIMITS.usernameMax)
    return `Usernames are ${LIMITS.usernameMin}–${LIMITS.usernameMax} characters.`;
  if (!USERNAME_PATTERN.test(value)) return "Only letters, digits, '.' and '_' are allowed.";
  if (value.startsWith(".") || value.endsWith(".")) return "Usernames can't start or end with '.'.";
  return null;
}

/** Full name rule shared by signup and edit profile. */
export function fullNameError(raw: string): string | null {
  return codePoints(raw.trim()) > LIMITS.fullNameMax
    ? `Names are at most ${LIMITS.fullNameMax} characters.`
    : null;
}

type Errors<F extends string> = Partial<Record<F, string>>;

export function validateSignupForm(form: SignupForm): Errors<SignupField> {
  const errors: Errors<SignupField> = {};
  const username = usernameError(form.username);
  if (username) errors.username = username;
  const email = form.email.trim();
  if (!email) errors.email = "Enter your email.";
  else if (email.length > LIMITS.emailMax || !EMAIL_PATTERN.test(email))
    errors.email = "Enter a valid email.";
  if (form.password.length < LIMITS.passwordMin)
    errors.password = `Use at least ${LIMITS.passwordMin} characters.`;
  else if (form.password.length > LIMITS.passwordMax)
    errors.password = `Use at most ${LIMITS.passwordMax} characters.`;
  const fullName = fullNameError(form.fullName);
  if (fullName) errors.fullName = fullName;
  return errors;
}

export function validateLoginForm(form: LoginForm): Errors<LoginField> {
  const errors: Errors<LoginField> = {};
  const handle = form.login.trim();
  if (!handle) errors.login = "Enter your username or email.";
  else if (handle.length > LIMITS.loginMax) errors.login = "That username or email is too long.";
  if (!form.password) errors.password = "Enter your password.";
  else if (form.password.length > LIMITS.loginPasswordMax) errors.password = "That password is too long.";
  return errors;
}

export function hasErrors(errors: Record<string, string | undefined>): boolean {
  return Object.values(errors).some(Boolean);
}

/** Stores the issued session and seeds the `["me"]` cache. */
export function applyAuthResponse(client: QueryClient, dto: AuthTokenResponseDto): void {
  const me = toMeVM(dto.user);
  // A previous user's cached data must never leak into the new session.
  client.removeQueries();
  setSession({ token: dto.access_token, expiresAt: dto.expires_at, me });
  client.setQueryData(queryKeys.me(), me);
}

export function useLoginMutation() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (form: LoginForm) => login(toLoginDto(form)),
    onSuccess: (dto) => applyAuthResponse(client, dto),
  });
}

export function useSignupMutation() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (form: SignupForm) => signup(toSignupDto(form)),
    onSuccess: (dto) => applyAuthResponse(client, dto),
  });
}

/**
 * Revokes the session server-side (best effort — offline or an already revoked token must not keep the user signed
 * in) and then clears every client-side trace of it.
 */
export async function performLogout(client: QueryClient): Promise<void> {
  try {
    if (getSessionToken()) await logout();
  } catch {
    /* ignore: the local session is cleared regardless */
  } finally {
    clearSession();
    void client.cancelQueries();
    client.removeQueries();
    clearToasts();
  }
}

export type LogoutOptions = {
  /** Runs after the session is cleared, even if the calling component already unmounted. */
  onLoggedOut?: () => void;
};

export function useLogoutMutation({ onLoggedOut }: LogoutOptions = {}) {
  const client = useQueryClient();
  return useMutation({ mutationFn: () => performLogout(client), onSettled: () => onLoggedOut?.() });
}
