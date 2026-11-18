/**
 * Story playback clock (F-FE-09, frontend/01 "StoryViewerPage"): segmented progress, auto-advance, prev/next and
 * pause. The reducer is pure; `useStoryPlayback` drives it with a fixed-step interval so fake timers can test it.
 */
import { useCallback, useEffect, useReducer, useRef } from "react";

/** Progress tick; small enough for a smooth bar, large enough to keep re-renders cheap. */
export const PLAYBACK_TICK_MS = 50;

export type PlaybackState = {
  index: number;
  elapsedMs: number;
  /** Set when playback ran past the last story (`end`) or before the first (`start`); the caller leaves the user. */
  boundary: "start" | "end" | null;
};

export type PlaybackAction =
  | { type: "tick"; deltaMs: number; durations: readonly number[] }
  | { type: "next"; count: number }
  | { type: "prev" }
  | { type: "restart" };

export function initialPlayback(index = 0): PlaybackState {
  return { index: Math.max(0, index), elapsedMs: 0, boundary: null };
}

function advance(state: PlaybackState, count: number): PlaybackState {
  if (state.index + 1 >= count) return { ...state, boundary: "end" };
  return { index: state.index + 1, elapsedMs: 0, boundary: null };
}

export function playbackReducer(state: PlaybackState, action: PlaybackAction): PlaybackState {
  if (state.boundary && action.type !== "restart") return state;
  switch (action.type) {
    case "tick": {
      const duration = action.durations[state.index];
      if (duration === undefined) return state;
      const elapsedMs = state.elapsedMs + action.deltaMs;
      return elapsedMs >= duration ? advance(state, action.durations.length) : { ...state, elapsedMs };
    }
    case "next":
      return advance(state, action.count);
    case "prev":
      if (state.index === 0) return { ...state, elapsedMs: 0, boundary: "start" };
      return { index: state.index - 1, elapsedMs: 0, boundary: null };
    case "restart":
      return { ...state, elapsedMs: 0, boundary: null };
  }
}

/** Fill fraction (0–1) of segment `i` given the current playback position. */
export function segmentFill(
  i: number,
  state: Pick<PlaybackState, "index" | "elapsedMs">,
  durationMs: number,
): number {
  if (i < state.index) return 1;
  if (i > state.index) return 0;
  return durationMs > 0 ? Math.min(1, state.elapsedMs / durationMs) : 0;
}

export type UseStoryPlaybackOptions = {
  /** Display duration per story (images 5 s, videos their own length). */
  durations: readonly number[];
  initialIndex?: number;
  paused: boolean;
  /** Played past the last story → next tray user (or close). */
  onEnd: () => void;
  /** Went back before the first story → previous tray user; when it returns `false` the first story restarts. */
  onBeforeStart: () => boolean;
};

export function useStoryPlayback({
  durations,
  initialIndex = 0,
  paused,
  onEnd,
  onBeforeStart,
}: UseStoryPlaybackOptions) {
  const [state, dispatch] = useReducer(playbackReducer, initialIndex, initialPlayback);
  const durationsRef = useRef(durations);
  durationsRef.current = durations;
  const callbacks = useRef({ onEnd, onBeforeStart });
  callbacks.current = { onEnd, onBeforeStart };

  const running = !paused && durations.length > 0 && state.boundary === null;
  useEffect(() => {
    if (!running) return;
    const id = setInterval(
      () => dispatch({ type: "tick", deltaMs: PLAYBACK_TICK_MS, durations: durationsRef.current }),
      PLAYBACK_TICK_MS,
    );
    return () => clearInterval(id);
  }, [running]);

  useEffect(() => {
    if (state.boundary === "end") callbacks.current.onEnd();
    else if (state.boundary === "start" && !callbacks.current.onBeforeStart()) dispatch({ type: "restart" });
  }, [state.boundary]);

  const next = useCallback(() => dispatch({ type: "next", count: durationsRef.current.length }), []);
  const prev = useCallback(() => dispatch({ type: "prev" }), []);

  return { state, next, prev };
}
