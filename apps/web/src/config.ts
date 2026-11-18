/**
 * Runtime configuration (F-FE-12). `/config.js` (generated from `PUBLIC_API_URL` / `PUBLIC_URL` at container
 * start by `nginx/30-runtime-config.sh`) sets `window.__APP_CONFIG__` before the bundle loads, so one image
 * serves every environment without a rebuild.
 */
export type AppConfig = {
  /** API origin without trailing slash, e.g. `http://localhost:18001`. The client appends `/api/v1`. */
  apiUrl: string;
  /** Public origin of the SPA (informational; may be empty). */
  publicUrl: string;
};

declare global {
  interface Window {
    __APP_CONFIG__?: Partial<AppConfig>;
  }
}

export class AppConfigError extends Error {
  override readonly name = "AppConfigError";
}

function normalizeOrigin(value: string, field: string): string {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new AppConfigError(
      `window.__APP_CONFIG__.${field} is not an absolute URL: ${JSON.stringify(value)}`,
    );
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new AppConfigError(`window.__APP_CONFIG__.${field} must use http(s): ${JSON.stringify(value)}`);
  }
  return value.trim().replace(/\/+$/, "");
}

/** Validates and normalizes a raw config object (pure; exported for tests). */
export function parseAppConfig(raw: unknown): AppConfig {
  if (typeof raw !== "object" || raw === null) {
    throw new AppConfigError("window.__APP_CONFIG__ is missing — is /config.js loaded?");
  }
  const { apiUrl, publicUrl } = raw as Partial<Record<keyof AppConfig, unknown>>;
  if (typeof apiUrl !== "string" || apiUrl.trim() === "") {
    throw new AppConfigError(
      "window.__APP_CONFIG__.apiUrl is missing — set PUBLIC_API_URL for the web container",
    );
  }
  return {
    apiUrl: normalizeOrigin(apiUrl.trim(), "apiUrl"),
    publicUrl:
      typeof publicUrl === "string" && publicUrl.trim() !== "" ? publicUrl.trim().replace(/\/+$/, "") : "",
  };
}

let cached: AppConfig | null = null;

/** Reads `window.__APP_CONFIG__` once; throws `AppConfigError` when it is missing or invalid. */
export function getAppConfig(): AppConfig {
  cached ??= parseAppConfig(window.__APP_CONFIG__);
  return cached;
}
