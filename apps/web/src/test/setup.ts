import { cleanup } from "@testing-library/react";
import { afterEach, beforeAll } from "vitest";

beforeAll(() => {
  // jsdom does not implement scrolling; React Router's <ScrollRestoration> calls it.
  window.scrollTo = () => undefined;
});

afterEach(() => {
  cleanup();
  window.localStorage.clear();
});
