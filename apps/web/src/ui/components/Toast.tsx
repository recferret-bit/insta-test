import { X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";

import { TOAST_DURATION_MS, dismissToast, useToasts, type ToastItem } from "../../state/toast";
import { Icon } from "./Icon";
import "./Toast.css";

function ToastCard({ toast }: { toast: ToastItem }) {
  const [paused, setPaused] = useState(false);
  const remaining = useRef(TOAST_DURATION_MS);
  const startedAt = useRef(0);

  useEffect(() => {
    if (paused) return;
    startedAt.current = Date.now();
    const timer = window.setTimeout(() => dismissToast(toast.id), remaining.current);
    return () => {
      window.clearTimeout(timer);
      remaining.current = Math.max(0, remaining.current - (Date.now() - startedAt.current));
    };
  }, [paused, toast.id]);

  return (
    <li
      className={`toast toast--${toast.tone}`}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      {toast.href ? (
        <Link to={toast.href} className="toast__message" onClick={() => dismissToast(toast.id)}>
          {toast.message}
        </Link>
      ) : (
        <span className="toast__message">{toast.message}</span>
      )}
      <button
        type="button"
        className="toast__close"
        aria-label="Dismiss notification"
        onClick={() => dismissToast(toast.id)}
      >
        <Icon icon={X} size={16} />
      </button>
    </li>
  );
}

/** Global toast region (`aria-live="polite"`); toasts auto-dismiss after 4 s, paused on hover/focus. */
export function ToastRegion() {
  const toasts = useToasts();
  return (
    <div
      className="toast-region"
      aria-live="polite"
      aria-relevant="additions text"
      role="region"
      aria-label="Notifications"
    >
      <ul className="toast-list">
        {toasts.map((toast) => (
          <ToastCard key={toast.id} toast={toast} />
        ))}
      </ul>
    </div>
  );
}
