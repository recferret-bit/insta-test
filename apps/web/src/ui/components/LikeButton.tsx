import { Heart } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Icon } from "./Icon";
import "./LikeButton.css";

export type LikeButtonProps = {
  liked: boolean;
  onToggle: () => void;
  size?: number;
  disabled?: boolean;
  className?: string;
};

/** Heart toggle (design-system "LikeButton": `aria-pressed`, label "Like"/"Unlike", pop animation on like). */
export function LikeButton({ liked, onToggle, size = 24, disabled, className }: LikeButtonProps) {
  const [popping, setPopping] = useState(false);
  const previous = useRef(liked);

  // Pop whenever the state flips to liked (button press, double-tap on media, or an SSE/refetch update).
  useEffect(() => {
    if (liked && !previous.current) setPopping(true);
    previous.current = liked;
  }, [liked]);

  return (
    <button
      type="button"
      className={["like-button", liked && "like-button--liked", popping && "like-button--pop", className]
        .filter(Boolean)
        .join(" ")}
      aria-pressed={liked}
      aria-label={liked ? "Unlike" : "Like"}
      disabled={disabled}
      onClick={onToggle}
      onAnimationEnd={() => setPopping(false)}
    >
      <Icon icon={Heart} size={size} fill={liked ? "currentColor" : "none"} />
    </button>
  );
}
