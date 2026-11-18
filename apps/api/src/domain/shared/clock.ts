/** Time source port; inject a fake in tests (stories, sessions expiry). */
export interface Clock {
  now(): Date;
}

export class SystemClock implements Clock {
  now(): Date {
    return new Date();
  }
}
