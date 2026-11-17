import { describe, expect, it } from "vitest";

import { parseEnv } from "../../../src/config/env.js";

const base = {
  PUBLIC_URL: "http://localhost:18000",
  PUBLIC_API_URL: "http://localhost:18001/",
  CORS_ORIGIN: "http://localhost:18000, http://127.0.0.1:18000",
  DATABASE_URL: "postgres://insta:secret@db:5432/insta",
};

describe("parseEnv", () => {
  it("applies catalog defaults", () => {
    const result = parseEnv(base);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.env).toMatchObject({
      API_PORT: 3000,
      MEDIA_DIR: "/data/media",
      MIGRATE_ON_START: true,
      JOBS_ENABLED: true,
      SESSION_TTL_DAYS: 30,
      LOG_LEVEL: "info",
      RESPONSE_VALIDATION: "off",
      GIT_SHA: "dev",
      PUBLIC_API_URL: "http://localhost:18001",
      CORS_ORIGIN: ["http://localhost:18000", "http://127.0.0.1:18000"],
    });
  });

  it("coerces numbers and booleans; blank values fall back to defaults", () => {
    const result = parseEnv({
      ...base,
      API_PORT: "4000",
      JOBS_ENABLED: "false",
      MIGRATE_ON_START: "0",
      LOG_LEVEL: "",
    });
    expect(result.ok && result.env).toMatchObject({
      API_PORT: 4000,
      JOBS_ENABLED: false,
      MIGRATE_ON_START: false,
      LOG_LEVEL: "info",
    });
  });

  it("lists every invalid or missing key without echoing secret values", () => {
    const result = parseEnv({
      PUBLIC_URL: "not a url",
      CORS_ORIGIN: "*",
      DATABASE_URL: "mysql://u:topsecret@h/db",
      API_PORT: "70000",
      JOBS_ENABLED: "maybe",
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    const keys = result.errors.map((e) => e.split(":")[0]);
    expect(keys).toEqual(
      expect.arrayContaining([
        "PUBLIC_URL",
        "PUBLIC_API_URL",
        "CORS_ORIGIN",
        "DATABASE_URL",
        "API_PORT",
        "JOBS_ENABLED",
      ]),
    );
    expect(result.errors.join("\n")).not.toContain("topsecret");
  });

  it("rejects an unknown RESPONSE_VALIDATION mode and a non-http public URL", () => {
    const result = parseEnv({ ...base, RESPONSE_VALIDATION: "loose", PUBLIC_URL: "ftp://x.example" });
    expect(result.ok).toBe(false);
  });
});
