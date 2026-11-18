import { describe, expect, it } from "vitest";

import {
  mapFollowEntityToRow,
  mapFollowRowToEntity,
} from "../../../src/data/mappers/follows.row-mapper.js";
import type { FollowRow } from "../../../src/data/rows/follows.row.js";
import type { UserId } from "../../../src/domain/shared/ids.js";
import { Follow } from "../../../src/domain/social/follow.entity.js";

const follower = "0193a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5b" as UserId;
const followee = "0193a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5c" as UserId;
const createdAt = new Date("2026-11-18T10:00:00.000Z");

describe("follows row mapper", () => {
  it("round-trips entity → row → entity", () => {
    const follow = Follow.create(follower, followee, createdAt);
    expect(mapFollowRowToEntity(mapFollowEntityToRow(follow))).toEqual(follow);
  });

  it("round-trips row → entity → row", () => {
    const row: FollowRow = { follower_id: follower, followee_id: followee, created_at: createdAt };
    expect(mapFollowEntityToRow(mapFollowRowToEntity(row))).toEqual(row);
  });

  it("maps snake_case columns to camelCase fields without swapping direction", () => {
    const row = mapFollowEntityToRow(Follow.create(follower, followee, createdAt));
    expect(row).toEqual({ follower_id: follower, followee_id: followee, created_at: createdAt });
    expect(Object.keys(row).sort()).toEqual(["created_at", "followee_id", "follower_id"]);

    const entity = mapFollowRowToEntity(row);
    expect(entity.followerId).toBe(follower);
    expect(entity.followeeId).toBe(followee);
    expect(entity.createdAt).toBe(createdAt);
    expect(Object.keys(entity).sort()).toEqual(["createdAt", "followeeId", "followerId"]);
  });
});
