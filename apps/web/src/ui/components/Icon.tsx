import type { LucideIcon, LucideProps } from "lucide-react";

export type IconProps = Omit<LucideProps, "ref"> & {
  icon: LucideIcon;
  /** Accessible name. Omit for decorative icons (rendered `aria-hidden`). */
  label?: string;
  size?: number;
};

/** Thin wrapper over `lucide-react`: consistent size/stroke; decorative unless `label` is given. */
export function Icon({ icon: Glyph, label, size = 24, strokeWidth = 2, ...rest }: IconProps) {
  return label ? (
    <Glyph size={size} strokeWidth={strokeWidth} role="img" aria-label={label} focusable="false" {...rest} />
  ) : (
    <Glyph size={size} strokeWidth={strokeWidth} aria-hidden="true" focusable="false" {...rest} />
  );
}
