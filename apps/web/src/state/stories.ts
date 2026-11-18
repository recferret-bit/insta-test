/**
 * Story hooks (F-FE-09; frontend/01 "StoryViewerPage", frontend/02 query keys `["storyTray"]`, `["userStories", u]`).
 * Cached values are ViewModels only: `StoryTrayItemViewModel[]`, `UserStoriesViewModel`, `PageViewModel<StoryViewerViewModel>`.
 */
import { LIMITS, type UserStoriesResponseDto } from "@insta/contracts";
import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from "@tanstack/react-query";

import { createStory, getStoryTray, getStoryViewers, getUserStories, markStorySeen } from "../api/stories";
import { toPageVM, type PageViewModel } from "./mappers/format";
import {
  toCreateStoryDto,
  toStoryTrayItemVM,
  toStoryViewerVM,
  toStoryVM,
  type StoryTrayItemViewModel,
  type StoryViewerViewModel,
  type StoryViewModel,
} from "./mappers/story";
import { toUserSummaryVM, type MeViewModel, type UserSummaryViewModel } from "./mappers/user";
import { queryKeys, STALE_TIMES } from "./query-keys";
import { checkUploadFile } from "./upload";

export type { StoryTrayItemViewModel, StoryViewerViewModel, StoryViewModel };

export type UserStoriesViewModel = {
  user: UserSummaryViewModel;
  /** Active stories, oldest first (server order). */
  stories: StoryViewModel[];
};

export function toUserStoriesVM(dto: UserStoriesResponseDto, now: Date = new Date()): UserStoriesViewModel {
  return {
    user: toUserSummaryVM(dto.user),
    stories: dto.stories.map((s) => toStoryVM(s, now)),
  };
}

// ---- tray ordering ----

/** Self first, then users with unseen stories, then most recent story first (mirrors the server order). */
export function orderTray(
  items: readonly StoryTrayItemViewModel[],
  meId: string | null,
): StoryTrayItemViewModel[] {
  const rank = (item: StoryTrayItemViewModel) =>
    item.user.id === meId ? 0 : item.ringState === "unseen" ? 1 : 2;
  return items
    .map((item, i) => ({ item, i }))
    .sort((a, b) => {
      const byRank = rank(a.item) - rank(b.item);
      if (byRank !== 0) return byRank;
      const byTime = Date.parse(b.item.latestStoryAt) - Date.parse(a.item.latestStoryAt);
      return Number.isNaN(byTime) || byTime === 0 ? a.i - b.i : byTime;
    })
    .map(({ item }) => item);
}

export type StoryTrayEntries = {
  /** The signed-in user's own tray item, or `null` when they have no active story. */
  own: StoryTrayItemViewModel | null;
  others: StoryTrayItemViewModel[];
};

export function splitTray(items: readonly StoryTrayItemViewModel[], meId: string | null): StoryTrayEntries {
  const ordered = orderTray(items, meId);
  const own = ordered.find((item) => item.user.id === meId) ?? null;
  return { own, others: ordered.filter((item) => item !== own) };
}

/** Username whose stories play after (`+1`) or before (`-1`) `username` in tray order; `null` at either end. */
export function adjacentTrayUsername(
  ordered: readonly StoryTrayItemViewModel[],
  username: string,
  direction: 1 | -1,
): string | null {
  const index = ordered.findIndex((item) => item.user.username === username);
  if (index < 0) return null;
  return ordered[index + direction]?.user.username ?? null;
}

/** Where playback starts for a user: their first unseen story, else the first one. */
export function initialStoryIndex(stories: readonly StoryViewModel[]): number {
  const firstUnseen = stories.findIndex((s) => !s.viewerHasSeen);
  return firstUnseen < 0 ? 0 : firstUnseen;
}

// ---- queries ----

export async function fetchStoryTray(signal?: AbortSignal): Promise<StoryTrayItemViewModel[]> {
  const dto = await getStoryTray(signal);
  return dto.items.map(toStoryTrayItemVM);
}

/** `GET /stories/tray` (auth required — pass `enabled: false` when signed out). */
export function useStoryTrayQuery({ enabled = true }: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: queryKeys.storyTray(),
    queryFn: ({ signal }) => fetchStoryTray(signal),
    staleTime: STALE_TIMES.storyTray,
    enabled,
  });
}

export function useUserStoriesQuery(username: string) {
  return useQuery({
    queryKey: queryKeys.userStories(username),
    queryFn: async ({ signal }) => toUserStoriesVM(await getUserStories(username, signal)),
    staleTime: STALE_TIMES.userStories,
    enabled: username !== "",
  });
}

/**
 * Key for the author-only viewer list. Not in the frontend/02 key table (recorded as a w04 gap), so it lives here
 * rather than in `query-keys.ts`; it is never cached across sheet openings (`staleTime: 0`).
 */
export const storyViewersKey = (storyId: string) => ["storyViewers", storyId] as const;

export function useStoryViewersQuery(storyId: string, enabled: boolean) {
  return useInfiniteQuery({
    queryKey: storyViewersKey(storyId),
    queryFn: async ({ pageParam, signal }): Promise<PageViewModel<StoryViewerViewModel>> => {
      const now = new Date();
      const page = await getStoryViewers(storyId, { cursor: pageParam ?? undefined }, signal);
      return toPageVM(page, (dto) => toStoryViewerVM(dto, now));
    },
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.nextCursor,
    staleTime: 0,
    enabled,
  });
}

// ---- seen ----

type Snapshot = { key: readonly unknown[]; data: unknown };

/**
 * Marks `storyId` seen in `["userStories", username]` and, once every cached story of that user is seen, flips
 * their tray ring to `seen`. Returns a rollback.
 */
export function applyStorySeen(client: QueryClient, username: string, storyId: string): () => void {
  const snapshots: Snapshot[] = [];
  const userKey = queryKeys.userStories(username);
  const current = client.getQueryData<UserStoriesViewModel>(userKey);
  if (!current) return () => undefined;
  snapshots.push({ key: userKey, data: current });
  const stories = current.stories.map((s) => (s.id === storyId ? { ...s, viewerHasSeen: true } : s));
  client.setQueryData<UserStoriesViewModel>(userKey, { ...current, stories });

  if (stories.every((s) => s.viewerHasSeen)) {
    const trayKey = queryKeys.storyTray();
    const tray = client.getQueryData<StoryTrayItemViewModel[]>(trayKey);
    if (tray) {
      snapshots.push({ key: trayKey, data: tray });
      client.setQueryData<StoryTrayItemViewModel[]>(
        trayKey,
        tray.map((item) => (item.user.username === username ? { ...item, ringState: "seen" } : item)),
      );
    }
  }
  return () => {
    for (const { key, data } of snapshots) client.setQueryData(key, data);
  };
}

export type MarkSeenVariables = { storyId: string; username: string };

/** `POST /stories/{id}/seen` (idempotent) with an optimistic cache update, rolled back on error. */
export function useMarkStorySeenMutation() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ storyId }: MarkSeenVariables) => markStorySeen(storyId),
    onMutate: ({ storyId, username }) => ({ rollback: applyStorySeen(client, username, storyId) }),
    onError: (_error, _vars, context) => context?.rollback(),
  });
}

// ---- create ----

/** `POST /stories` with an uploaded `story`-purpose media id; refreshes the tray and the author's stories. */
export function useCreateStoryMutation() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (mediaId: string) => toStoryVM(await createStory(toCreateStoryDto(mediaId))),
    onSuccess: (story) => {
      const username = story.author.username;
      void client.invalidateQueries({ queryKey: queryKeys.storyTray() });
      void client.invalidateQueries({ queryKey: queryKeys.userStories(username) });
      void client.invalidateQueries({ queryKey: queryKeys.profile(username) });
    },
  });
}

/** The tray needs a summary of the signed-in user even before they have a story. */
export function meAsTrayUser(me: MeViewModel): UserSummaryViewModel {
  return {
    id: me.id,
    username: me.username,
    fullName: me.fullName,
    displayName: me.displayName,
    avatarUrl: me.avatarUrl,
    hasCustomAvatar: me.hasCustomAvatar,
    isFollowing: null,
    profilePath: me.profilePath,
  };
}

// ---- story file checks ----

export type VideoDurationProbe = (file: File) => Promise<number | null>;

const PROBE_TIMEOUT_MS = 5000;

/** Reads a video's duration from `<video>` metadata; `null` when the browser cannot tell (server re-checks). */
export const probeVideoDurationMs: VideoDurationProbe = (file) =>
  new Promise((resolve) => {
    if (typeof URL.createObjectURL !== "function") return resolve(null);
    const url = URL.createObjectURL(file);
    const video = document.createElement("video");
    const done = (value: number | null) => {
      clearTimeout(timer);
      URL.revokeObjectURL(url);
      video.removeAttribute("src");
      resolve(value);
    };
    const timer = setTimeout(() => done(null), PROBE_TIMEOUT_MS);
    video.preload = "metadata";
    video.onloadedmetadata = () =>
      done(Number.isFinite(video.duration) ? Math.round(video.duration * 1000) : null);
    video.onerror = () => done(null);
    video.src = url;
  });

/** Client-side check for a story file: type/size like any upload, plus video duration ≤ 60 s when known. */
export async function checkStoryFile(
  file: File,
  probe: VideoDurationProbe = probeVideoDurationMs,
): Promise<string | null> {
  const problem = checkUploadFile(file, "story");
  if (problem) return problem;
  if (!file.type.startsWith("video/")) return null;
  const durationMs = await probe(file);
  if (durationMs !== null && durationMs > LIMITS.videoDurationMsMax)
    return `Videos must be ${LIMITS.videoDurationMsMax / 1000} seconds or shorter.`;
  return null;
}
