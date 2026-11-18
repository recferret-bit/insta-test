import type { CSSProperties } from "react";

import "./Skeleton.css";

export type SkeletonProps = {
  width?: CSSProperties["width"];
  height?: CSSProperties["height"];
  /** Circle (avatars) instead of a rounded rectangle. */
  circle?: boolean;
  radius?: CSSProperties["borderRadius"];
  className?: string;
};

/** Loading placeholder (decorative; the loading region should announce `aria-busy`). Shimmer stops under reduced motion. */
export function Skeleton({ width = "100%", height = 16, circle = false, radius, className }: SkeletonProps) {
  return (
    <span
      aria-hidden="true"
      className={["skeleton", className].filter(Boolean).join(" ")}
      style={{ width, height, borderRadius: circle ? "var(--radius-full)" : (radius ?? "var(--radius-sm)") }}
    />
  );
}
