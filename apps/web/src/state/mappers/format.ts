/**
 * Pure display-string helpers shared by every `DTO → ViewModel` mapper
 * (frontend/02-state-viewmodels-and-mappers.md#viewmodels--dto--viewmodel-mappers-statemappersts).
 * Locale is fixed to `en-US` so labels are deterministic (the UI copy is English-only).
 */
const LOCALE = "en-US";

const compactFormatter = new Intl.NumberFormat(LOCALE, { notation: "compact", maximumFractionDigits: 1 });
const integerFormatter = new Intl.NumberFormat(LOCALE);
const fullDateFormatter = new Intl.DateTimeFormat(LOCALE, { dateStyle: "long", timeStyle: "short" });

/** `999` → `"999"`, `1234` → `"1.2K"`, `1_500_000` → `"1.5M"`. */
export function formatCompactNumber(value: number): string {
  return compactFormatter.format(value);
}

/** `1234` → `"1,234"`. */
export function formatInteger(value: number): string {
  return integerFormatter.format(value);
}

/** `(1, "like")` → `"1 like"`, `(1234, "like")` → `"1,234 likes"`. */
export function formatCount(value: number, singular: string, plural = `${singular}s`): string {
  return `${formatInteger(value)} ${value === 1 ? singular : plural}`;
}

/** Same as `formatCount` with the compact number format: `(1234, "follower")` → `"1.2K followers"`. */
export function formatCompactCount(value: number, singular: string, plural = `${singular}s`): string {
  return `${formatCompactNumber(value)} ${value === 1 ? singular : plural}`;
}

const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const WEEK = 7 * DAY;
const YEAR = 365 * DAY;

/**
 * Short relative age: `"now"` (< 1 min or in the future), `"5m"`, `"3h"`, `"2d"`, `"4w"`, `"1y"`.
 * `now` is injectable for deterministic tests.
 */
export function formatRelativeTime(iso: string, now: Date = new Date()): string {
  const elapsed = now.getTime() - new Date(iso).getTime();
  if (!Number.isFinite(elapsed) || elapsed < MINUTE) return "now";
  if (elapsed < HOUR) return `${Math.floor(elapsed / MINUTE)}m`;
  if (elapsed < DAY) return `${Math.floor(elapsed / HOUR)}h`;
  if (elapsed < WEEK) return `${Math.floor(elapsed / DAY)}d`;
  if (elapsed < YEAR) return `${Math.floor(elapsed / WEEK)}w`;
  return `${Math.floor(elapsed / YEAR)}y`;
}

/** Full local date/time for `title` / tooltips, e.g. `"November 17, 2026 at 10:00 AM"`. */
export function formatFullDate(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? "" : fullDateFormatter.format(date);
}

/** Remaining time until `iso`: `"23h left"`, `"15m left"`, `"expired"`. */
export function formatRemaining(iso: string, now: Date = new Date()): string {
  const remaining = new Date(iso).getTime() - now.getTime();
  if (!Number.isFinite(remaining) || remaining <= 0) return "expired";
  if (remaining >= HOUR) return `${Math.floor(remaining / HOUR)}h left`;
  if (remaining >= MINUTE) return `${Math.floor(remaining / MINUTE)}m left`;
  return "<1m left";
}

/** Truncates to `max` characters (code points), appending `…` when cut. */
export function truncate(text: string, max: number): string {
  const chars = Array.from(text);
  return chars.length <= max ? text : `${chars.slice(0, max).join("").trimEnd()}…`;
}

const AVATAR_COLORS = [
  "#7c3aed",
  "#be185d",
  "#c2410c",
  "#0f766e",
  "#1d4ed8",
  "#4338ca",
  "#be123c",
  "#15803d",
];

function hashString(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i++) hash = (hash * 31 + value.charCodeAt(i)) | 0;
  return Math.abs(hash);
}

/** Up to two uppercase initials from the full name, else the first username character. */
export function initialsFor(username: string, fullName = ""): string {
  const words = fullName.trim().split(/\s+/).filter(Boolean);
  const letters =
    words.length > 0
      ? words.slice(0, 2).map((w) => Array.from(w)[0] ?? "")
      : [Array.from(username)[0] ?? "?"];
  return letters.join("").toUpperCase() || "?";
}

function escapeXml(value: string): string {
  return value.replace(/[<>&"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

/**
 * Generated initials avatar as an SVG `data:` URL (allowed by the CSP `img-src data:`), with a
 * background color picked deterministically from the username. All colors give ≥ 4.5:1 with white text.
 */
export function initialsAvatarUrl(username: string, fullName = ""): string {
  const color = AVATAR_COLORS[hashString(username) % AVATAR_COLORS.length] ?? "#7c3aed";
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">` +
    `<rect width="64" height="64" fill="${color}"/>` +
    `<text x="50%" y="50%" dy=".35em" text-anchor="middle" fill="#fff" ` +
    `font-family="system-ui,sans-serif" font-size="26" font-weight="600">${escapeXml(initialsFor(username, fullName))}</text>` +
    `</svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

/** UI-ready page: `{ items, nextCursor }` (the wire `next_cursor` stays opaque). */
export type PageViewModel<T> = { items: T[]; nextCursor: string | null };

export function toPageVM<D, V>(
  page: { items: D[]; next_cursor: string | null },
  map: (dto: D) => V,
): PageViewModel<V> {
  return { items: page.items.map(map), nextCursor: page.next_cursor };
}
