import { Volume2, VolumeX } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import type { MediaViewModel } from "../../state/mappers/media";
import { Icon } from "./Icon";

/** Share of the video that must be visible before muted autoplay starts (frontend/01 "PostCard"). */
export const AUTOPLAY_VISIBLE_RATIO = 0.6;

export function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && typeof window.matchMedia === "function"
    ? window.matchMedia("(prefers-reduced-motion: reduce)").matches
    : false;
}

export type MediaCarouselVideoProps = {
  media: MediaViewModel;
  /** Only the visible slide may play. */
  active: boolean;
  label: string;
};

/**
 * Carousel video: muted autoplay while ≥ 60 % visible, `playsInline`, loop, tap the speaker to unmute.
 * Under `prefers-reduced-motion` it never autoplays and shows native controls instead.
 */
export function MediaCarouselVideo({ media, active, label }: MediaCarouselVideoProps) {
  const ref = useRef<HTMLVideoElement>(null);
  const [visible, setVisible] = useState(false);
  const [muted, setMuted] = useState(true);
  const [reducedMotion] = useState(prefersReducedMotion);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      ([entry]) => setVisible(Boolean(entry && entry.intersectionRatio >= AUTOPLAY_VISIBLE_RATIO)),
      { threshold: [0, AUTOPLAY_VISIBLE_RATIO, 1] },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el || reducedMotion) return;
    if (active && visible) {
      // Autoplay can be refused by the browser; the user can still unmute/play manually.
      void el.play()?.catch(() => undefined);
    } else {
      if (!el.paused) el.pause();
    }
  }, [active, visible, reducedMotion]);

  useEffect(() => {
    if (ref.current) ref.current.muted = muted;
  }, [muted]);

  return (
    <div className="carousel__video">
      <video
        ref={ref}
        className="carousel__media"
        src={media.url}
        muted={muted}
        playsInline
        loop
        preload="metadata"
        controls={reducedMotion}
        aria-label={label}
        tabIndex={active ? 0 : -1}
      />
      {reducedMotion ? null : (
        <button
          type="button"
          className="carousel__mute"
          aria-label={muted ? "Unmute video" : "Mute video"}
          aria-pressed={!muted}
          tabIndex={active ? 0 : -1}
          onClick={(event) => {
            event.stopPropagation();
            setMuted((m) => !m);
          }}
        >
          <Icon icon={muted ? VolumeX : Volume2} size={16} />
        </button>
      )}
    </div>
  );
}
