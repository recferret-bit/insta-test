import { DomainError } from "../shared/errors.js";
import type { Brand, MediaId, PostId, UserId } from "../shared/ids.js";
import { DOMAIN_LIMITS } from "../shared/limits.js";

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

export type CreatePostInput = {
  id: PostId;
  authorId: UserId;
  caption: string;
  /** Display order; becomes `position` `0..n-1`. */
  mediaIds: readonly MediaId[];
  now: Date;
};

/** `VALIDATION_FAILED` with a single `{ path, message }` issue (wire field name as `path`). */
function invalid(path: string, message: string): never {
  throw new DomainError("VALIDATION_FAILED", message, [{ path, message }]);
}

/** Length in Unicode code points — matches Postgres `char_length` used by the DB `CHECK`s. */
function codePointLength(value: string): number {
  return Array.from(value).length;
}

/**
 * Hashtags in a caption: regex `#([\p{L}\p{N}_]{1,64})`, lowercased, deduplicated, first-appearance order.
 * Tags whose lowercase form grows beyond 64 code points (rare case mappings, e.g. `İ`) are skipped so the
 * `post_hashtags_tag_check` constraint can never fail. Does not enforce the 30-tag limit (see `parseCaption`).
 */
export function extractHashtags(caption: string): Hashtag[] {
  const seen = new Set<string>();
  for (const match of caption.matchAll(HASHTAG_PATTERN)) {
    const tag = match[1]!.toLowerCase();
    if (codePointLength(tag) <= DOMAIN_LIMITS.hashtagMax) seen.add(tag);
  }
  return [...seen] as Hashtag[];
}

/** Value object `Caption` — trimmed, ≤ 2200 code points, ≤ 30 distinct hashtags. */
export const Caption = {
  parse(raw: string): { caption: Caption; hashtags: Hashtag[] } {
    const value = raw.trim();
    if (codePointLength(value) > DOMAIN_LIMITS.captionMax) {
      invalid("caption", `Caption must be at most ${DOMAIN_LIMITS.captionMax} characters`);
    }
    const hashtags = extractHashtags(value);
    if (hashtags.length > DOMAIN_LIMITS.hashtagsPerPostMax) {
      invalid("caption", `At most ${DOMAIN_LIMITS.hashtagsPerPostMax} hashtags are allowed`);
    }
    return { caption: value as Caption, hashtags };
  },
};

/** Entity factories & rules for `ENT-Post` (`INV-03`, `INV-10`). */
export const Post = {
  /**
   * New live post with zero counters and `createdAt = updatedAt = now`. `VALIDATION_FAILED` for 0 or > 10
   * media, duplicate media IDs, a caption over 2200 chars or more than 30 hashtags. Media ownership/purpose is
   * checked by the service via `MediaAsset.assertAttachable`.
   */
  create(input: CreatePostInput): Post {
    const { postMediaMin, postMediaMax } = DOMAIN_LIMITS;
    const count = input.mediaIds.length;
    if (count < postMediaMin || count > postMediaMax) {
      invalid("media_ids", `A post needs ${postMediaMin}–${postMediaMax} media items`);
    }
    if (new Set(input.mediaIds).size !== count) invalid("media_ids", "Media IDs must be unique");
    const { caption, hashtags } = Caption.parse(input.caption);
    return {
      id: input.id,
      authorId: input.authorId,
      caption,
      media: input.mediaIds.map((mediaId, position) => ({ mediaId, position })),
      hashtags,
      likeCount: 0,
      commentCount: 0,
      createdAt: input.now,
      updatedAt: input.now,
      deletedAt: null,
    };
  },

  /** New caption with recomputed hashtags and `updatedAt = now`; media and counters unchanged. */
  editCaption(post: Post, caption: string, now: Date): Post {
    const parsed = Caption.parse(caption);
    return {
      ...post,
      caption: parsed.caption,
      hashtags: parsed.hashtags,
      media: post.media.map((m) => ({ ...m })),
      updatedAt: now,
    };
  },

  /** Only the author may edit or delete a post (`INV-10`) → otherwise `FORBIDDEN`. */
  assertCanModify(post: Post, actorId: UserId): void {
    if (post.authorId !== actorId) {
      throw new DomainError("FORBIDDEN", "Only the author can modify this post");
    }
  },
};
