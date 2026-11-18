import "./Avatar.css";

export const AVATAR_SIZES = [24, 32, 44, 56, 88, 150] as const;
export type AvatarSize = (typeof AVATAR_SIZES)[number];
/** Story ring: `unseen` = gradient ring, `seen` = muted ring, `none` = no ring. */
export type AvatarRing = "none" | "unseen" | "seen";

export type AvatarProps = {
  src: string;
  /** Alt text; pass `""` when the username is printed next to the avatar (decorative). */
  alt: string;
  size?: AvatarSize;
  ring?: AvatarRing;
  className?: string;
};

/** Round avatar; `ring` draws the story ring (gradient token `--gradient-story`). */
export function Avatar({ src, alt, size = 32, ring = "none", className }: AvatarProps) {
  return (
    <span
      className={["avatar", `avatar--ring-${ring}`, className].filter(Boolean).join(" ")}
      style={{ width: size, height: size }}
      data-ring={ring}
    >
      <img
        className="avatar__img"
        src={src}
        alt={alt}
        width={size}
        height={size}
        loading="lazy"
        decoding="async"
      />
    </span>
  );
}
