import type { Brand, MediaId, PostId, UserId } from "../shared/ids.js";

/** Trimmed, ≤ 2200 chars, ≤ 30 hashtags. */
export type Caption = Brand<string, "Caption">;
/** Lowercased, 1–64 of `[\p{L}\p{N}_]`, without `#`. */
export type Hashtag = Brand<string, "Hashtag">;

/** Hashtag extraction regex from the entity map (`#([\p{L}\p{N}_]{1,64})`). */
export const HASHTAG_PATTERN = /#([\p{L}\p{N}_]{1,64})/gu;

/** `position` 0..9, contiguous from 0 in array order. */
export type PostMediaItem = { mediaId: MediaId; position: number };

export type Post = {
  id: PostId;
  authorId: UserId;
  caption: Caption;
  /** 1..10, positions contiguous from 0; immutable after create. */
  media: PostMediaItem[];
  /** Derived: `extractHashtags(caption)`, first-appearance order, ≤ 30. */
  hashtags: Hashtag[];
  likeCount: number;
  commentCount: number;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
};
