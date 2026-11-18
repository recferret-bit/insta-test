import type { Clock } from "../../src/domain/shared/clock.js";

/** Controllable clock for expiry logic (sessions, stories). */
export class FakeClock implements Clock {
  private current: Date;

  constructor(start: Date | string = "2026-11-17T10:00:00.000Z") {
    this.current = new Date(start);
  }

  now(): Date {
    return new Date(this.current.getTime());
  }

  set(at: Date | string): void {
    this.current = new Date(at);
  }

  advance(ms: number): void {
    this.current = new Date(this.current.getTime() + ms);
  }
}
