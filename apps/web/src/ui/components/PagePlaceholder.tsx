import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import { EmptyState } from "./EmptyState";

export type PagePlaceholderProps = {
  title: string;
  icon?: LucideIcon;
  message?: ReactNode;
  action?: ReactNode;
  width?: "narrow" | "wide";
};

/** Route-level placeholder used by w00 page stubs until the owning feature wave replaces the page body. */
export function PagePlaceholder({ title, icon, message, action, width = "narrow" }: PagePlaceholderProps) {
  return (
    <section className={`page page--${width}`}>
      <EmptyState
        icon={icon}
        title={title}
        headingLevel="h1"
        message={message ?? "This page is coming soon."}
        action={action}
      />
    </section>
  );
}
