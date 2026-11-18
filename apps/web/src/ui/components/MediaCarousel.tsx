import { ChevronLeft, ChevronRight, Heart } from "lucide-react";
import { useRef, useState, type KeyboardEvent, type MouseEvent, type PointerEvent } from "react";

import type { MediaViewModel } from "../../state/mappers/media";
import { Icon } from "./Icon";
import { MediaCarouselVideo } from "./MediaCarouselVideo";
import "./MediaCarousel.css";

/** Horizontal distance (px) that counts as a swipe. */
export const SWIPE_THRESHOLD_PX = 40;
/** Two taps within this window are a double-tap. */
export const DOUBLE_TAP_MS = 300;

/** Arrow / mute buttons must not count as taps or swipes on the media. */
function isControl(target: EventTarget | null): boolean {
  return target instanceof Element && target.closest("button") !== null;
}

export type MediaCarouselProps = {
  media: readonly MediaViewModel[];
  /** Alt text for images (caption's first 100 chars or "Photo by @username"). */
  altText: string;
  /** Double-tap / double-click on the media (PostCard: like, never unlike). */
  onDoubleActivate?: () => void;
  /** Accessible name of the carousel region. */
  label?: string;
  className?: string;
};

/**
 * Post media carousel (design-system "MediaCarousel": `role="region"` + `aria-roledescription="carousel"`, slide
 * labels "2 of 5"): arrow buttons, dots, swipe, `←/→` keys while focused, double-tap with a heart burst.
 */
export function MediaCarousel({
  media,
  altText,
  onDoubleActivate,
  label = "Post media",
  className,
}: MediaCarouselProps) {
  const [index, setIndex] = useState(0);
  const [burst, setBurst] = useState(0);
  const count = media.length;
  const current = Math.min(index, Math.max(0, count - 1));
  const pointerStart = useRef<{ x: number; y: number } | null>(null);
  const lastTap = useRef(0);
  const lastTouchDouble = useRef(0);

  if (count === 0) return null;
  const first = media[0];
  const aspectRatio = first ? first.aspectRatio : 1;

  const go = (next: number) => setIndex(Math.min(count - 1, Math.max(0, next)));

  const fireDouble = () => {
    if (!onDoubleActivate) return;
    setBurst((n) => n + 1);
    onDoubleActivate();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      go(current - 1);
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      go(current + 1);
    }
  };

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (isControl(event.target)) return;
    pointerStart.current = { x: event.clientX, y: event.clientY };
  };

  const onPointerUp = (event: PointerEvent<HTMLDivElement>) => {
    const start = pointerStart.current;
    pointerStart.current = null;
    if (!start) return;
    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    if (Math.abs(dx) >= SWIPE_THRESHOLD_PX && Math.abs(dx) > Math.abs(dy)) {
      go(current + (dx < 0 ? 1 : -1));
      lastTap.current = 0;
      return;
    }
    // Touch double-tap (mouse uses the native dblclick below).
    if (event.pointerType === "touch") {
      const now = Date.now();
      if (now - lastTap.current <= DOUBLE_TAP_MS) {
        lastTap.current = 0;
        lastTouchDouble.current = now;
        fireDouble();
      } else {
        lastTap.current = now;
      }
    }
  };

  const onDoubleClick = (event: MouseEvent<HTMLDivElement>) => {
    if (isControl(event.target)) return;
    // Some mobile browsers also emit dblclick after a touch double-tap: ignore that echo.
    if (Date.now() - lastTouchDouble.current < 600) return;
    fireDouble();
  };

  return (
    <div
      className={["carousel", className].filter(Boolean).join(" ")}
      role="region"
      aria-roledescription="carousel"
      aria-label={label}
      tabIndex={count > 1 ? 0 : -1}
      onKeyDown={count > 1 ? onKeyDown : undefined}
    >
      <div
        className="carousel__viewport"
        style={{ aspectRatio: String(aspectRatio) }}
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        onPointerCancel={() => (pointerStart.current = null)}
        onDoubleClick={onDoubleClick}
        data-testid="carousel-viewport"
      >
        <div className="carousel__track" style={{ transform: `translateX(-${current * 100}%)` }}>
          {media.map((item, i) => {
            const slideLabel = `${i + 1} of ${count}`;
            return (
              <div
                key={item.id}
                className="carousel__slide"
                role="group"
                aria-roledescription="slide"
                aria-label={slideLabel}
                aria-hidden={i !== current}
              >
                {item.isVideo ? (
                  <MediaCarouselVideo media={item} active={i === current} label={`Video: ${altText}`} />
                ) : (
                  <img
                    className="carousel__media"
                    src={item.url}
                    alt={altText}
                    loading={i === 0 ? "eager" : "lazy"}
                    decoding="async"
                    draggable={false}
                  />
                )}
              </div>
            );
          })}
        </div>
        {burst > 0 ? (
          <span key={burst} className="carousel__burst" aria-hidden="true">
            <Icon icon={Heart} size={88} fill="currentColor" />
          </span>
        ) : null}
        {count > 1 && current > 0 ? (
          <button
            type="button"
            className="carousel__arrow carousel__arrow--prev"
            aria-label="Previous"
            onClick={() => go(current - 1)}
          >
            <Icon icon={ChevronLeft} size={18} />
          </button>
        ) : null}
        {count > 1 && current < count - 1 ? (
          <button
            type="button"
            className="carousel__arrow carousel__arrow--next"
            aria-label="Next"
            onClick={() => go(current + 1)}
          >
            <Icon icon={ChevronRight} size={18} />
          </button>
        ) : null}
      </div>
      {count > 1 ? (
        <>
          <div className="carousel__dots" aria-hidden="true">
            {media.map((item, i) => (
              <span
                key={item.id}
                className={["carousel__dot", i === current && "carousel__dot--active"]
                  .filter(Boolean)
                  .join(" ")}
              />
            ))}
          </div>
          <p className="visually-hidden" aria-live="polite">
            {`Slide ${current + 1} of ${count}`}
          </p>
        </>
      ) : null}
    </div>
  );
}
