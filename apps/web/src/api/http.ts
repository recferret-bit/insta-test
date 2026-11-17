/**
 * Typed fetch wrapper (frontend/02-state-viewmodels-and-mappers.md#typed-api-client-appswebsrcapi).
 *
 * - Base URL `apiUrl + "/api/v1"`, `Authorization: Bearer <token>` when a session exists, JSON in/out.
 * - Non-2xx → `ErrorResponseDto` → `ApiError`.
 * - Dev builds validate responses with the contract schema (`schema.parse`); production builds cast.
 *
 * `api/` must not import `state/` or `ui/`, so the session token, base URL and the global 401 reaction are
 * injected once at boot via `configureHttp` (see `main.tsx`).
 */
import { ErrorResponseDto, type ErrorCode, type ValidationIssueDto } from "@insta/contracts";
import type { z } from "zod";

export type QueryParams = Record<string, string | number | undefined>;

/** `?cursor&limit` for every paginated list (cursor is opaque; limit 1–50, default 20). */
export type PageParams = { cursor?: string; limit?: number };

export type HttpConfig = {
  /** API origin without trailing slash; the client appends `/api/v1`. */
  baseUrl: string;
  getToken: () => string | null;
  /** Called when a request that carried a token is rejected with `401 UNAUTHENTICATED`. */
  onUnauthenticated?: (error: ApiError) => void;
  /** Validate response bodies against the contract schema (defaults to `import.meta.env.DEV`). */
  validateResponses?: boolean;
  fetch?: typeof fetch;
};

export class ApiError extends Error {
  override readonly name = "ApiError";

  constructor(
    readonly status: number,
    readonly body: ErrorResponseDto,
  ) {
    super(body.error.message);
  }

  get code(): ErrorCode {
    return this.body.error.code;
  }

  get details(): ValidationIssueDto[] {
    return this.body.error.details ?? [];
  }

  get requestId(): string {
    return this.body.error.request_id;
  }
}

export function isApiError(value: unknown): value is ApiError {
  return value instanceof ApiError;
}

let current: HttpConfig | null = null;

export function configureHttp(config: HttpConfig): void {
  current = config;
}

function http(): HttpConfig {
  if (!current) throw new Error("api/http: configureHttp() must be called before any request");
  return current;
}

export const API_PREFIX = "/api/v1";

/** `{baseUrl}/api/v1{path}?{query}` — `undefined` query values are skipped. */
export function buildUrl(path: string, query?: QueryParams): string {
  const url = `${http().baseUrl}${API_PREFIX}${path}`;
  if (!query) return url;
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined) params.set(key, String(value));
  }
  const qs = params.toString();
  return qs ? `${url}?${qs}` : url;
}

/** Encodes one path segment (`/users/${seg(username)}`). */
export function seg(value: string): string {
  return encodeURIComponent(value);
}

/** Authorization header for the current session, if any. */
export function authHeaders(): Record<string, string> {
  const token = http().getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

const FALLBACK_MESSAGES: Partial<Record<number, string>> = {
  429: "Too many requests. Slow down.",
  502: "The server is unreachable.",
  503: "The service is temporarily unavailable.",
  504: "The server took too long to respond.",
};

/** Turns any error response body into an `ApiError` (non-JSON bodies get a synthetic envelope). */
export function toApiError(status: number, rawBody: unknown, requestId: string | null): ApiError {
  const parsed = ErrorResponseDto.safeParse(rawBody);
  if (parsed.success) return new ApiError(status, parsed.data);
  const code: ErrorCode =
    status === 401
      ? "UNAUTHENTICATED"
      : status === 403
        ? "FORBIDDEN"
        : status === 404
          ? "NOT_FOUND"
          : status === 413
            ? "PAYLOAD_TOO_LARGE"
            : status === 429
              ? "RATE_LIMITED"
              : status === 400
                ? "VALIDATION_FAILED"
                : "INTERNAL";
  return new ApiError(status, {
    error: {
      code,
      message: FALLBACK_MESSAGES[status] ?? `Request failed with status ${status}`,
      request_id: requestId ?? "",
    },
  });
}

/** Shared 401 reaction for fetch and XHR paths. */
export function notifyIfUnauthenticated(error: ApiError, hadToken: boolean): void {
  if (hadToken && error.status === 401 && error.code === "UNAUTHENTICATED") {
    http().onUnauthenticated?.(error);
  }
}

/** Parses a body with the contract schema in dev builds; casts in production. */
export function decode<T>(data: unknown, schema: z.ZodType<T, z.ZodTypeDef, unknown> | undefined): T {
  const validate = http().validateResponses ?? import.meta.env.DEV;
  if (schema && validate) return schema.parse(data);
  return data as T;
}

async function readJson(res: Response): Promise<unknown> {
  const text = await res.text();
  if (!text) return undefined;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

export type RequestOptions<T> = {
  body?: unknown;
  query?: QueryParams;
  schema?: z.ZodType<T, z.ZodTypeDef, unknown>;
  signal?: AbortSignal;
};

/**
 * Performs one JSON request against `/api/v1`. Resolves with the (validated in dev) body, or `undefined`
 * for `204`. Rejects with `ApiError` for non-2xx; network failures and aborts propagate unchanged.
 */
export async function request<T>(method: string, path: string, opts: RequestOptions<T> = {}): Promise<T> {
  const cfg = http();
  const headers: Record<string, string> = { Accept: "application/json", ...authHeaders() };
  const hadToken = "Authorization" in headers;
  let body: string | undefined;
  if (opts.body !== undefined) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(opts.body);
  }
  const doFetch = cfg.fetch ?? globalThis.fetch.bind(globalThis);
  const res = await doFetch(buildUrl(path, opts.query), {
    method,
    headers,
    body,
    signal: opts.signal,
  });
  const data = await readJson(res);
  if (!res.ok) {
    const error = toApiError(res.status, data, res.headers.get("X-Request-Id"));
    notifyIfUnauthenticated(error, hadToken);
    throw error;
  }
  if (res.status === 204) return undefined as T;
  return decode(data, opts.schema);
}

/** Request DTO input type (before Zod defaults/transforms are applied). */
export type InputOf<S extends z.ZodTypeAny> = z.input<S>;
