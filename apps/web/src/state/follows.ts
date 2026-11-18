/**
 * Follow state & hooks (F-FE-06, frontend/02 "Query Keys" `["followers" | "following", username]`, "Mutations …
 * are optimistic"; plan W03-03).
 *
 * - `useFollowMutation`: `PUT|DELETE /users/{username}/follow`, optimistic patch of every cached
 *   `ProfileViewModel` (`["profile"]`, `["me"]`) and `UserSummaryViewModel` (follow lists, user search), rollback +
 *   toast on error, reconcile with `FollowStateResponseDto` on success.
 * - `useFollowList`: infinite `GET /users/{username}/followers|following`.
 */
import type { FollowStateResponseDto } from "@insta/contracts";
import {
  useInfiniteQuery,
  useMutation,
  useQueryClient,
  type InfiniteData,
  type QueryClient,
  type QueryKey,
} from "@tanstack/react-query";

import { isApiError } from "../api/http";
import { followUser, getFollowers, getFollowing, unfollowUser } from "../api/users";
import { toPageVM, type PageViewModel } from "./mappers/format";
import {
  toUserSummaryVM,
  withProfileCounts,
  type ProfileViewModel,
  type UserSummaryViewModel,
} from "./mappers/user";
import { patchProfileInCaches } from "./cache-patch";
import { queryKeys, STALE_TIMES, type FollowListKind } from "./query-keys";
import { useMe } from "./session";
import { showToast } from "./toast";

export type { FollowListKind };

/** Key roots whose cached data contain `UserSummaryViewModel`s (directly or as `{ user }` search results). */
export const USER_SUMMARY_CACHE_ROOTS = ["followers", "following", "search"] as const;

export const FOLLOW_ERROR_MESSAGE = "Couldn't update follow. Please try again.";

/** The target of a follow toggle: id for cache matching, username for the URL. */
export type FollowTarget = { id: string; username: string };

export type FollowVariables = { user: FollowTarget; follow: boolean };

export type FollowListPage = PageViewModel<UserSummaryViewModel>;

type Rollback = () => void;

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function patchSummary(item: unknown, userId: string, isFollowing: boolean, counter: { n: number }): unknown {
  if (!isObject(item)) return item;
  if (item.id === userId && "isFollowing" in item) {
    if (item.isFollowing === isFollowing) return item;
    counter.n++;
    return { ...item, isFollowing };
  }
  // `UserResultViewModel` (search) nests the summary under `user`.
  if (isObject(item.user) && item.user.id === userId) {
    const user = patchSummary(item.user, userId, isFollowing, counter);
    return user === item.user ? item : { ...item, user };
  }
  return item;
}

function patchList(items: unknown, userId: string, isFollowing: boolean, counter: { n: number }): unknown {
  if (!Array.isArray(items)) return items;
  let changed = false;
  const next = items.map((item: unknown) => {
    const patched = patchSummary(item, userId, isFollowing, counter);
    if (patched !== item) changed = true;
    return patched;
  });
  return changed ? next : items;
}

/**
 * Pure: sets `isFollowing` on every `UserSummaryViewModel` with `userId` inside an array, a `PageViewModel`, or
 * `InfiniteData<PageViewModel>`. Returns the same reference when nothing changed. Exported for tests.
 */
export function patchUserSummaryData(
  data: unknown,
  userId: string,
  isFollowing: boolean,
  counter = { n: 0 },
): unknown {
  if (Array.isArray(data)) return patchList(data, userId, isFollowing, counter);
  if (!isObject(data)) return data;
  if (Array.isArray(data.pages)) {
    let changed = false;
    const pages = data.pages.map((page: unknown) => {
      if (!isObject(page)) return page;
      const items = patchList(page.items, userId, isFollowing, counter);
      if (items === page.items) return page;
      changed = true;
      return { ...page, items };
    });
    return changed ? { ...data, pages } : data;
  }
  if (Array.isArray(data.items)) {
    const items = patchList(data.items, userId, isFollowing, counter);
    return items === data.items ? data : { ...data, items };
  }
  return data;
}

/** Sets `isFollowing` on every cached user summary with `userId`; returns how many changed and a rollback. */
export function patchUserSummariesInCaches(
  client: QueryClient,
  userId: string,
  isFollowing: boolean,
): { patched: number; rollback: Rollback } {
  const previous: Array<[QueryKey, unknown]> = [];
  const counter = { n: 0 };
  for (const root of USER_SUMMARY_CACHE_ROOTS) {
    for (const [key, data] of client.getQueriesData({ queryKey: [root] })) {
      const next = patchUserSummaryData(data, userId, isFollowing, counter);
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

/** Followee profile: flip `isFollowing` and move `followersCount` by ±1 (only when the state actually changes). */
export function applyOptimisticFollow(profile: ProfileViewModel, follow: boolean): ProfileViewModel {
  if (profile.isFollowing === follow) return profile;
  const followersCount = Math.max(0, profile.followersCount + (follow ? 1 : -1));
  return withProfileCounts({ ...profile, isFollowing: follow }, { followersCount });
}

/** Followee profile after the server answered: authoritative `following` + `followers_count`. */
export function applyFollowState(profile: ProfileViewModel, state: FollowStateResponseDto): ProfileViewModel {
  if (profile.isFollowing === state.following && profile.followersCount === state.followers_count)
    return profile;
  return withProfileCounts(
    { ...profile, isFollowing: state.following },
    { followersCount: state.followers_count },
  );
}

function adjustFollowing(profile: ProfileViewModel, delta: number): ProfileViewModel {
  return withProfileCounts(profile, { followingCount: Math.max(0, profile.followingCount + delta) });
}

export type FollowContext = { rollback: Rollback; changed: boolean };

/**
 * Optimistic step shared by the hook and tests: patches the followee's profile, the viewer's own `followingCount`
 * (`["me"]`, own `["profile"]`) and every cached user summary. `changed` is `false` when no cache showed a different
 * state (then the viewer's counter does not move).
 */
export function applyFollowOptimistically(
  client: QueryClient,
  { user, follow }: FollowVariables,
  viewerId: string | null,
): FollowContext {
  let changed = false;
  const followee = patchProfileInCaches(client, user.id, (p) => {
    const next = applyOptimisticFollow(p, follow);
    if (next !== p) changed = true;
    return next;
  });
  const summaries = patchUserSummariesInCaches(client, user.id, follow);
  if (summaries.patched > 0) changed = true;
  const viewer =
    changed && viewerId && viewerId !== user.id
      ? patchProfileInCaches(client, viewerId, (p) => adjustFollowing(p, follow ? 1 : -1))
      : null;
  return {
    changed,
    rollback: () => {
      viewer?.rollback();
      summaries.rollback();
      followee.rollback();
    },
  };
}

function followErrorMessage(error: unknown): string | null {
  // 429 is toasted by the global mutation cache handler, 401 by the API client hook.
  if (isApiError(error) && (error.status === 429 || error.status === 401)) return null;
  return FOLLOW_ERROR_MESSAGE;
}

/** Optimistic follow/unfollow toggle. Variables: `{ user: { id, username }, follow }`. */
export function useFollowMutation() {
  const client = useQueryClient();
  const viewer = useMe();
  const viewerId = viewer?.id ?? null;
  const viewerUsername = viewer?.username ?? null;
  return useMutation<FollowStateResponseDto, unknown, FollowVariables, FollowContext>({
    mutationKey: ["follow"],
    mutationFn: ({ user, follow }) => (follow ? followUser(user.username) : unfollowUser(user.username)),
    onMutate: async (variables) => {
      await Promise.all([
        client.cancelQueries({ queryKey: queryKeys.profile(variables.user.username) }),
        client.cancelQueries({ queryKey: queryKeys.followList("followers", variables.user.username) }),
      ]);
      return applyFollowOptimistically(client, variables, viewerId);
    },
    onError: (error, _variables, context) => {
      context?.rollback();
      const message = followErrorMessage(error);
      if (message) showToast(message, { tone: "error" });
    },
    onSuccess: (state, { user }) => {
      patchProfileInCaches(client, state.user_id, (p) => applyFollowState(p, state));
      patchUserSummariesInCaches(client, user.id, state.following);
    },
    onSettled: (_data, _error, { user }) => {
      // List membership changed on the server: refetch the affected lists next time they are shown.
      void client.invalidateQueries({ queryKey: queryKeys.followList("followers", user.username) });
      if (viewerUsername)
        void client.invalidateQueries({ queryKey: queryKeys.followList("following", viewerUsername) });
    },
  });
}

/** Fetches one page of a follow list as ViewModels. Exported for tests. */
export async function fetchFollowListPage(
  kind: FollowListKind,
  username: string,
  cursor: string | undefined,
  signal?: AbortSignal,
): Promise<FollowListPage> {
  const page = cursor ? { cursor } : {};
  const dto =
    kind === "followers"
      ? await getFollowers(username, page, signal)
      : await getFollowing(username, page, signal);
  return toPageVM(dto, toUserSummaryVM);
}

/** Infinite followers / following list (`["followers" | "following", username]`, stale 60 s). */
export function useFollowList(kind: FollowListKind, username: string) {
  return useInfiniteQuery<
    FollowListPage,
    unknown,
    InfiniteData<FollowListPage, string | undefined>,
    readonly [FollowListKind, string],
    string | undefined
  >({
    queryKey: queryKeys.followList(kind, username),
    queryFn: ({ pageParam, signal }) => fetchFollowListPage(kind, username, pageParam, signal),
    initialPageParam: undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    staleTime: STALE_TIMES[kind],
    enabled: username !== "",
  });
}

/** Flattens loaded pages, dropping duplicates that keyset pagination can return after list changes. */
export function flattenFollowList(
  data: InfiniteData<FollowListPage, unknown> | undefined,
): UserSummaryViewModel[] {
  if (!data) return [];
  const seen = new Set<string>();
  const out: UserSummaryViewModel[] = [];
  for (const page of data.pages) {
    for (const user of page.items) {
      if (seen.has(user.id)) continue;
      seen.add(user.id);
      out.push(user);
    }
  }
  return out;
}
