/**
 * Test-only wiring for `ui/` component tests, which may not import `api/` (eslint `import/no-restricted-paths`).
 * Configures the API client against a fake `fetch` with the real session token getter.
 */
import { configureHttp } from "../api/http";
import { getSessionToken } from "./session";

export const TEST_API_URL = "http://api.test";

export function configureTestHttp(fetchImpl: typeof fetch): void {
  configureHttp({
    baseUrl: TEST_API_URL,
    getToken: getSessionToken,
    validateResponses: true,
    fetch: fetchImpl,
  });
}
