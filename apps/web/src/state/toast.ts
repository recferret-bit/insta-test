/**
 * Global toast queue rendered by `ui/components/Toast` (`aria-live="polite"`, auto-dismiss 4 s — frontend/03).
 */
import { useSyncExternalStore } from "react";

export type ToastTone = "info" | "success" | "error";
export type ToastItem = { id: number; message: string; tone: ToastTone; href?: string };

export const TOAST_DURATION_MS = 4000;
const MAX_TOASTS = 4;

let toasts: readonly ToastItem[] = [];
let nextId = 1;
const listeners = new Set<() => void>();

function emit(next: readonly ToastItem[]): void {
  toasts = next;
  for (const listener of listeners) listener();
}

export function showToast(message: string, opts: { tone?: ToastTone; href?: string } = {}): number {
  const id = nextId++;
  const item: ToastItem = {
    id,
    message,
    tone: opts.tone ?? "info",
    ...(opts.href ? { href: opts.href } : {}),
  };
  emit([...toasts, item].slice(-MAX_TOASTS));
  return id;
}

export function dismissToast(id: number): void {
  if (toasts.some((t) => t.id === id)) emit(toasts.filter((t) => t.id !== id));
}

export function clearToasts(): void {
  if (toasts.length > 0) emit([]);
}

export function getToasts(): readonly ToastItem[] {
  return toasts;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useToasts(): readonly ToastItem[] {
  return useSyncExternalStore(subscribe, getToasts, getToasts);
}
