import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import { Button } from "./Button";
import { Icon } from "./Icon";
import "./EmptyState.css";

export type EmptyStateProps = {
  icon?: LucideIcon;
  title: string;
  message?: ReactNode;
  /** Call-to-action (button or link). */
  action?: ReactNode;
  headingLevel?: "h1" | "h2" | "h3";
};

/** Icon + title + message + action, for empty lists and placeholder content. */
export function EmptyState({ icon, title, message, action, headingLevel: Heading = "h2" }: EmptyStateProps) {
  return (
    <div className="empty-state">
      {icon ? (
        <span className="empty-state__icon">
          <Icon icon={icon} size={40} strokeWidth={1.5} />
        </span>
      ) : null}
      <Heading className="empty-state__title">{title}</Heading>
      {message ? <p className="empty-state__message">{message}</p> : null}
      {action ? <div className="empty-state__action">{action}</div> : null}
    </div>
  );
}

export type ErrorStateProps = {
  title?: string;
  message: string;
  onRetry?: () => void;
  retryLabel?: string;
  icon?: LucideIcon;
};

/** Inline error with a "Retry" action (frontend/01 "Errors": others → inline error with retry). */
export function ErrorState({
  title = "Something went wrong",
  message,
  onRetry,
  retryLabel = "Retry",
  icon,
}: ErrorStateProps) {
  return (
    <div role="alert">
      <EmptyState
        icon={icon}
        title={title}
        message={message}
        action={
          onRetry ? (
            <Button variant="secondary" onClick={onRetry}>
              {retryLabel}
            </Button>
          ) : undefined
        }
      />
    </div>
  );
}
