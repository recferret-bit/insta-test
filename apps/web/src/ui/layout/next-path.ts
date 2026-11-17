/** Same-origin path to return to after login (`/login?next=…`); rejects absolute and protocol-relative URLs. */
export function safeNextPath(next: string | null | undefined, fallback = "/"): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return fallback;
  return next;
}

/** `/login?next=<encoded current path+search>` */
export function loginPathFor(currentPath: string): string {
  const next = safeNextPath(currentPath, "");
  return next && next !== "/" ? `/login?next=${encodeURIComponent(next)}` : "/login";
}
