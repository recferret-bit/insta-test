/**
 * Optimistic cache patching (frontend/02 — "patch every cached PostViewModel/ProfileViewModel with matching id via a
 * `patchPostInCaches(postId, fn)` helper, roll back on error, and reconcile with the server response").
 *
 * Supported cache shapes under the patched key roots:
 * - a single ViewModel (`["post", id]`, `["profile", username]`, `["me"]`),
 * - a `PageViewModel` (`{ items, nextCursor }`),
 * - TanStack `InfiniteData<PageViewModel>` (`{ pages: [{ items }], pageParams }`).
 */
import type { QueryClient, QueryKey } from "@tanstack/react-query";

import type { PostViewModel } from "./mappers/post";
import type { ProfileViewModel } from "./mappers/user";
import { POST_CACHE_ROOTS, PROFILE_CACHE_ROOTS } from "./query-keys";

type WithId = { id: string };

export type CachePatchResult = {
  /** Number of cached ViewModels that were changed. */
  patched: number;
  /** Restores every touched query to its value before the patch. */
  rollback: () => void;
};

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function patchItems<T extends WithId>(
  items: unknown,
  id: string,
  fn: (vm: T) => T,
  counter: { n: number },
): unknown {
  if (!Array.isArray(items)) return items;
  let changed = false;
  const next = items.map((item: unknown) => {
    if (isObject(item) && item.id === id) {
      changed = true;
      counter.n++;
      return fn(item as T);
    }
    return item;
  });
  return changed ? next : items;
}

/** Pure: returns patched data (same reference when nothing matched). Exported for tests. */
export function patchCachedData<T extends WithId>(
  data: unknown,
  id: string,
  fn: (vm: T) => T,
  counter = { n: 0 },
): unknown {
  if (!isObject(data)) return data;
  if (data.id === id) {
    counter.n++;
    return fn(data as T);
  }
  if (Array.isArray(data.pages)) {
    let changed = false;
    const pages = data.pages.map((page: unknown) => {
      if (!isObject(page)) return page;
      const items = patchItems(page.items, id, fn, counter);
      if (items === page.items) return page;
      changed = true;
      return { ...page, items };
    });
    return changed ? { ...data, pages } : data;
  }
  if (Array.isArray(data.items)) {
    const items = patchItems(data.items, id, fn, counter);
    return items === data.items ? data : { ...data, items };
  }
  return data;
}

function patchRoots<T extends WithId>(
  client: QueryClient,
  roots: readonly string[],
  id: string,
  fn: (vm: T) => T,
): CachePatchResult {
  const previous: Array<[QueryKey, unknown]> = [];
  const counter = { n: 0 };
  for (const root of roots) {
    for (const [key, data] of client.getQueriesData({ queryKey: [root] })) {
      const next = patchCachedData(data, id, fn, counter);
      if (next !== data) {
        previous.push([key, data]);
        client.setQueryData(key, next);
      }
    }
  }
  return {
    patched: counter.n,
    rollback: () => {
      for (const [key, data] of previous) client.setQueryData(key, data);
    },
  };
}

/** Applies `fn` to every cached `PostViewModel` with `postId` (feed, explore, profile grid, hashtag, post page). */
export function patchPostInCaches(
  client: QueryClient,
  postId: string,
  fn: (post: PostViewModel) => PostViewModel,
): CachePatchResult {
  return patchRoots(client, POST_CACHE_ROOTS, postId, fn);
}

/** Applies `fn` to every cached `ProfileViewModel` (and `MeViewModel`) with `userId` (`usr_…`). */
export function patchProfileInCaches(
  client: QueryClient,
  userId: string,
  fn: (profile: ProfileViewModel) => ProfileViewModel,
): CachePatchResult {
  return patchRoots(client, PROFILE_CACHE_ROOTS, userId, fn);
}
