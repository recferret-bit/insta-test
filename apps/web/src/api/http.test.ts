import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { post } from "../test/fixtures";
import { ApiError, buildUrl, configureHttp, isApiError, request, toApiError } from "./http";
import { PostResponseDto } from "@insta/contracts";

type FetchMock = ReturnType<
  typeof vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>
>;

function jsonResponse(status: number, body: unknown, headers: Record<string, string> = {}): Response {
  return new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...headers },
  });
}

function errorBody(code: string, message = "boom", details?: Array<{ path: string; message: string }>) {
  return { error: { code, message, request_id: "req-12345678", ...(details ? { details } : {}) } };
}

describe("api/http", () => {
  let fetchMock: FetchMock;
  let token: string | null;
  const onUnauthenticated = vi.fn();

  beforeEach(() => {
    token = null;
    fetchMock = vi.fn();
    onUnauthenticated.mockReset();
    configureHttp({
      baseUrl: "http://api.test",
      getToken: () => token,
      onUnauthenticated,
      validateResponses: true,
      fetch: fetchMock,
    });
  });

  afterEach(() => vi.restoreAllMocks());

  it("builds /api/v1 URLs and skips undefined query values", () => {
    expect(buildUrl("/feed")).toBe("http://api.test/api/v1/feed");
    expect(buildUrl("/feed", { cursor: undefined, limit: 20 })).toBe("http://api.test/api/v1/feed?limit=20");
    expect(buildUrl("/search/users", { q: "a b&c" })).toBe("http://api.test/api/v1/search/users?q=a+b%26c");
  });

  it("sends JSON with the bearer token and parses the response with the schema", async () => {
    token = "tok_abc";
    const dto = post();
    fetchMock.mockResolvedValue(jsonResponse(201, dto));
    const result = await request("POST", "/posts", { body: { caption: "hi" }, schema: PostResponseDto });
    expect(result).toEqual(dto);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("http://api.test/api/v1/posts");
    expect(init?.method).toBe("POST");
    expect(init?.body).toBe(JSON.stringify({ caption: "hi" }));
    expect(init?.headers).toMatchObject({
      Authorization: "Bearer tok_abc",
      "Content-Type": "application/json",
      Accept: "application/json",
    });
  });

  it("omits Authorization and Content-Type when there is no token or body", async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { ok: true }));
    await request("GET", "/explore");
    const headers = fetchMock.mock.calls[0]![1]!.headers as Record<string, string>;
    expect(headers.Authorization).toBeUndefined();
    expect(headers["Content-Type"]).toBeUndefined();
  });

  it("resolves undefined for 204", async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));
    await expect(request("DELETE", "/posts/x")).resolves.toBeUndefined();
  });

  it("rejects a contract-invalid response body when validation is on", async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { id: "nope" }));
    await expect(request("GET", "/posts/x", { schema: PostResponseDto })).rejects.toThrow();
  });

  it("casts without validation when validation is off", async () => {
    configureHttp({
      baseUrl: "http://api.test",
      getToken: () => null,
      validateResponses: false,
      fetch: fetchMock,
    });
    fetchMock.mockResolvedValue(jsonResponse(200, { id: "nope" }));
    await expect(request("GET", "/posts/x", { schema: PostResponseDto })).resolves.toEqual({ id: "nope" });
  });

  it("throws ApiError with the parsed ErrorResponseDto", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(
        400,
        errorBody("VALIDATION_FAILED", "Request validation failed", [
          { path: "caption", message: "too long" },
        ]),
      ),
    );
    const error = await request("POST", "/posts", { body: {} }).catch((e: unknown) => e);
    expect(isApiError(error)).toBe(true);
    const apiError = error as ApiError;
    expect(apiError.status).toBe(400);
    expect(apiError.code).toBe("VALIDATION_FAILED");
    expect(apiError.details).toEqual([{ path: "caption", message: "too long" }]);
    expect(apiError.requestId).toBe("req-12345678");
    expect(apiError.message).toBe("Request validation failed");
  });

  it("synthesizes an envelope for non-JSON error bodies (e.g. a proxy 502)", async () => {
    fetchMock.mockResolvedValue(
      new Response("<html>Bad gateway</html>", { status: 502, headers: { "X-Request-Id": "rid" } }),
    );
    const error = (await request("GET", "/feed").catch((e: unknown) => e)) as ApiError;
    expect(error).toBeInstanceOf(ApiError);
    expect(error.code).toBe("INTERNAL");
    expect(error.requestId).toBe("rid");
  });

  it.each([
    [401, "UNAUTHENTICATED"],
    [404, "NOT_FOUND"],
    [429, "RATE_LIMITED"],
    [413, "PAYLOAD_TOO_LARGE"],
  ] as const)("maps bare status %i to %s", (status, code) => {
    expect(toApiError(status, undefined, null).code).toBe(code);
  });

  it("calls onUnauthenticated for 401 UNAUTHENTICATED when a token was sent", async () => {
    token = "expired";
    fetchMock.mockResolvedValue(jsonResponse(401, errorBody("UNAUTHENTICATED")));
    await expect(request("GET", "/me")).rejects.toBeInstanceOf(ApiError);
    expect(onUnauthenticated).toHaveBeenCalledTimes(1);
  });

  it("does not call onUnauthenticated for INVALID_CREDENTIALS or anonymous 401s", async () => {
    fetchMock.mockResolvedValue(jsonResponse(401, errorBody("INVALID_CREDENTIALS")));
    token = "t";
    await expect(request("POST", "/auth/login", { body: {} })).rejects.toBeInstanceOf(ApiError);
    token = null;
    fetchMock.mockResolvedValue(jsonResponse(401, errorBody("UNAUTHENTICATED")));
    await expect(request("GET", "/feed")).rejects.toBeInstanceOf(ApiError);
    expect(onUnauthenticated).not.toHaveBeenCalled();
  });

  it("propagates network errors unchanged", async () => {
    fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));
    await expect(request("GET", "/feed")).rejects.toBeInstanceOf(TypeError);
  });
});
