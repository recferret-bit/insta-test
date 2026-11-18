import { describe, expect, it } from "vitest";

import { AppConfigError, parseAppConfig } from "./config";

describe("parseAppConfig (F-FE-12)", () => {
  it("normalizes apiUrl and publicUrl (trailing slashes removed)", () => {
    expect(
      parseAppConfig({ apiUrl: "http://localhost:18001/", publicUrl: "http://localhost:18000/" }),
    ).toEqual({
      apiUrl: "http://localhost:18001",
      publicUrl: "http://localhost:18000",
    });
  });

  it("defaults publicUrl to an empty string", () => {
    expect(parseAppConfig({ apiUrl: "https://api.example.com" })).toEqual({
      apiUrl: "https://api.example.com",
      publicUrl: "",
    });
  });

  it.each([undefined, null, "x", {}, { apiUrl: "" }, { apiUrl: "   " }, { apiUrl: 42 }])(
    "rejects a missing apiUrl: %j",
    (raw) => {
      expect(() => parseAppConfig(raw)).toThrow(AppConfigError);
    },
  );

  it.each(["localhost:18001", "/api", "ftp://example.com"])(
    "rejects a non-http(s) absolute URL: %s",
    (apiUrl) => {
      expect(() => parseAppConfig({ apiUrl })).toThrow(AppConfigError);
    },
  );
});
