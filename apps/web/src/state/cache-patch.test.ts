import type { InfiniteData } from "@tanstack/react-query";
import { describe, expect, it } from "vitest";

import { hexId, post, profile } from "../test/fixtures";
import { patchCachedData, patchPostInCaches, patchProfileInCaches } from "./cache-patch";
import type { PageViewModel } from "./mappers/format";
import { toPostVM, withPostCounters, type PostViewModel } from "./mappers/post";
import { toProfileVM, withProfileCounts } from "./mappers/user";
import { createQueryClient } from "./queryClient";
import { queryKeys } from "./query-keys";

const P1 = hexId("pst", 1);
const P2 = hexId("pst", 2);
const vm1 = toPostVM(post({ id: P1 }), { viewerId: null });
const vm2 = toPostVM(post({ id: P2 }), { viewerId: null });
const like = (p: PostViewModel) => withPostCounters(p, { likeCount: p.likeCount + 1, viewerHasLiked: true });

function infinite(...pages: PostViewModel[][]): InfiniteData<PageViewModel<PostViewModel>> {
  return { pages: pages.map((items) => ({ items, nextCursor: null })), pageParams: pages.map(() => null) };
}

describe("patchCachedData", () => {
  it("patches single VMs, pages and infinite data; keeps references when nothing matches", () => {
    expect(patchCachedData(vm1, P1, like)).toMatchObject({ likeCount: 2 });
    const page = { items: [vm1, vm2], nextCursor: "c" };
    const patchedPage = patchCachedData(page, P2, like) as typeof page;
    expect(patchedPage.items[0]).toBe(vm1);
    expect(patchedPage.items[1]!.likeCount).toBe(2);
    expect(patchedPage.nextCursor).toBe("c");
    const inf = infinite([vm2], [vm1]);
    const patchedInf = patchCachedData(inf, P1, like) as typeof inf;
    expect(patchedInf.pages[0]).toBe(inf.pages[0]);
    expect(patchedInf.pages[1]!.items[0]!.viewerHasLiked).toBe(true);
    expect(patchCachedData(inf, hexId("pst", 9), like)).toBe(inf);
    expect(patchCachedData(undefined, P1, like)).toBeUndefined();
  });
});

describe("patchPostInCaches", () => {
  it("patches every post cache root and rolls back", () => {
    const client = createQueryClient();
    client.setQueryData(queryKeys.post(P1), vm1);
    client.setQueryData(queryKeys.feed(), infinite([vm1, vm2]));
    client.setQueryData(queryKeys.explore(), infinite([vm2], [vm1]));
    client.setQueryData(queryKeys.userPosts("alice"), infinite([vm1]));
    client.setQueryData(queryKeys.hashtag("beach"), infinite([vm1]));
    client.setQueryData(queryKeys.comments(P1), { pages: [{ items: [{ id: P1 }] }], pageParams: [null] });

    const result = patchPostInCaches(client, P1, like);
    expect(result.patched).toBe(5);
    expect(client.getQueryData<PostViewModel>(queryKeys.post(P1))!.likeCount).toBe(2);
    const feed = client.getQueryData<InfiniteData<PageViewModel<PostViewModel>>>(queryKeys.feed())!;
    expect(feed.pages[0]!.items.map((p) => p.likeCount)).toEqual([2, 1]);
    // comments are not a post cache root
    expect(
      client.getQueryData<{ pages: Array<{ items: unknown[] }> }>(queryKeys.comments(P1))!.pages[0]!.items[0],
    ).toEqual({ id: P1 });

    result.rollback();
    expect(client.getQueryData(queryKeys.post(P1))).toEqual(vm1);
    expect(
      client.getQueryData<InfiniteData<PageViewModel<PostViewModel>>>(queryKeys.feed())!.pages[0]!.items[0],
    ).toEqual(vm1);
  });

  it("is a no-op with an empty cache", () => {
    const result = patchPostInCaches(createQueryClient(), P1, like);
    expect(result.patched).toBe(0);
    expect(() => result.rollback()).not.toThrow();
  });
});

describe("patchProfileInCaches", () => {
  it("patches profile caches by user id", () => {
    const client = createQueryClient();
    const vm = toProfileVM(profile(), null);
    client.setQueryData(queryKeys.profile("alice"), vm);
    const result = patchProfileInCaches(client, vm.id, (p) =>
      withProfileCounts({ ...p, isFollowing: true }, { followersCount: p.followersCount + 1 }),
    );
    expect(result.patched).toBe(1);
    expect(client.getQueryData(queryKeys.profile("alice"))).toMatchObject({
      isFollowing: true,
      followersCount: 1235,
    });
    result.rollback();
    expect(client.getQueryData(queryKeys.profile("alice"))).toEqual(vm);
  });
});
