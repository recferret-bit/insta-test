import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  initialPlayback,
  PLAYBACK_TICK_MS,
  playbackReducer,
  segmentFill,
  useStoryPlayback,
  type PlaybackState,
} from "./stories-playback";

const durations = [5000, 3000];

describe("playbackReducer", () => {
  it("accumulates elapsed time and advances at the duration boundary", () => {
    let s = initialPlayback();
    s = playbackReducer(s, { type: "tick", deltaMs: 4950, durations });
    expect(s).toEqual({ index: 0, elapsedMs: 4950, boundary: null });
    s = playbackReducer(s, { type: "tick", deltaMs: 50, durations });
    expect(s).toEqual({ index: 1, elapsedMs: 0, boundary: null });
  });

  it("signals the end after the last story and then ignores input", () => {
    let s: PlaybackState = { index: 1, elapsedMs: 2990, boundary: null };
    s = playbackReducer(s, { type: "tick", deltaMs: 10, durations });
    expect(s.boundary).toBe("end");
    expect(playbackReducer(s, { type: "next", count: 2 })).toBe(s);
    expect(playbackReducer(s, { type: "prev" })).toBe(s);
  });

  it("next / prev move one story and reset elapsed time", () => {
    let s = playbackReducer(initialPlayback(), { type: "tick", deltaMs: 1000, durations });
    s = playbackReducer(s, { type: "next", count: 2 });
    expect(s).toEqual({ index: 1, elapsedMs: 0, boundary: null });
    s = playbackReducer(s, { type: "prev" });
    expect(s).toEqual({ index: 0, elapsedMs: 0, boundary: null });
  });

  it("prev on the first story signals start; restart clears it", () => {
    const s = playbackReducer(initialPlayback(), { type: "prev" });
    expect(s.boundary).toBe("start");
    expect(playbackReducer(s, { type: "restart" })).toEqual({ index: 0, elapsedMs: 0, boundary: null });
  });

  it("clamps a negative initial index", () => {
    expect(initialPlayback(-3).index).toBe(0);
  });
});

describe("segmentFill", () => {
  const at = { index: 1, elapsedMs: 1500 };
  it("is full before, empty after and proportional for the current segment", () => {
    expect(segmentFill(0, at, 5000)).toBe(1);
    expect(segmentFill(1, at, 3000)).toBe(0.5);
    expect(segmentFill(2, at, 3000)).toBe(0);
    expect(segmentFill(1, { index: 1, elapsedMs: 9000 }, 3000)).toBe(1);
    expect(segmentFill(1, at, 0)).toBe(0);
  });
});

describe("useStoryPlayback", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  function setup(opts: { paused?: boolean; initialIndex?: number; prevExists?: boolean } = {}) {
    const onEnd = vi.fn();
    const onBeforeStart = vi.fn(() => opts.prevExists ?? false);
    const hook = renderHook(
      ({ paused }) =>
        useStoryPlayback({ durations, initialIndex: opts.initialIndex, paused, onEnd, onBeforeStart }),
      { initialProps: { paused: opts.paused ?? false } },
    );
    return { ...hook, onEnd, onBeforeStart };
  }

  it("auto-advances after each story's duration and calls onEnd after the last", () => {
    const { result, onEnd } = setup();
    act(() => vi.advanceTimersByTime(4950));
    expect(result.current.state.index).toBe(0);
    act(() => vi.advanceTimersByTime(PLAYBACK_TICK_MS));
    expect(result.current.state.index).toBe(1);
    act(() => vi.advanceTimersByTime(3000));
    expect(onEnd).toHaveBeenCalledTimes(1);
  });

  it("does not advance while paused and resumes where it stopped", () => {
    const { result, rerender } = setup();
    act(() => vi.advanceTimersByTime(1000));
    rerender({ paused: true });
    act(() => vi.advanceTimersByTime(10_000));
    expect(result.current.state).toMatchObject({ index: 0, elapsedMs: 1000 });
    rerender({ paused: false });
    act(() => vi.advanceTimersByTime(4000));
    expect(result.current.state.index).toBe(1);
  });

  it("restarts the first story when there is no previous user", () => {
    const { result, onBeforeStart } = setup();
    act(() => vi.advanceTimersByTime(1000));
    act(() => result.current.prev());
    expect(onBeforeStart).toHaveBeenCalledTimes(1);
    expect(result.current.state).toEqual({ index: 0, elapsedMs: 0, boundary: null });
    act(() => vi.advanceTimersByTime(500));
    expect(result.current.state.elapsedMs).toBe(500);
  });

  it("hands over to the previous user when one exists", () => {
    const { result, onBeforeStart } = setup({ prevExists: true });
    act(() => result.current.prev());
    expect(onBeforeStart).toHaveBeenCalledTimes(1);
    expect(result.current.state.boundary).toBe("start");
  });

  it("starts at the given index", () => {
    const { result } = setup({ initialIndex: 1 });
    expect(result.current.state.index).toBe(1);
  });
});
