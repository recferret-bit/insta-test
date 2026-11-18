/**
 * Builds public URLs for DTO mappers (backend/03-ports-and-handlers.md#handler-rules, rule 5):
 * `PUBLIC_API_URL` is injected here once instead of being read from env inside mappers.
 */
export interface UrlBuilder {
  /** `${PUBLIC_API_URL}/media/${storageKey}` */
  mediaUrl(storageKey: string): string;
}

export function createUrlBuilder(publicApiUrl: string): UrlBuilder {
  const base = publicApiUrl.replace(/\/+$/, "");
  return {
    mediaUrl: (storageKey) => `${base}/media/${storageKey}`,
  };
}
