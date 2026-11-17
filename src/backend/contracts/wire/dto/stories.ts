import { z } from "zod";
import { IsoDateTime, publicId } from "../ids.ts";
import { LIMITS } from "../limits.ts";
import { MediaResponseDto, UserSummaryDto } from "./common.ts";

export const StoryIdParams = z.object({ story_id: publicId("sty") }).strict();
export type StoryIdParams = z.infer<typeof StoryIdParams>;

export const CreateStoryRequestDto = z
  .object({
    media_id: publicId("med"),
  })
  .strict();
export type CreateStoryRequestDto = z.infer<typeof CreateStoryRequestDto>;

export const StoryResponseDto = z.object({
  id: publicId("sty"),
  author: UserSummaryDto,
  media: MediaResponseDto,
  created_at: IsoDateTime,
  expires_at: IsoDateTime,
  /** `false` when anonymous. */
  viewer_has_seen: z.boolean(),
  /** Only for the author; `null` for everyone else. */
  view_count: z.number().int().nonnegative().nullable(),
});
export type StoryResponseDto = z.infer<typeof StoryResponseDto>;

export const StoryTrayItemDto = z.object({
  user: UserSummaryDto,
  has_unseen: z.boolean(),
  latest_story_at: IsoDateTime,
  story_count: z.number().int().positive(),
});
export type StoryTrayItemDto = z.infer<typeof StoryTrayItemDto>;

/** Self first (if active), then `has_unseen DESC`, `latest_story_at DESC`; max 100. */
export const StoryTrayResponseDto = z.object({
  items: z.array(StoryTrayItemDto).max(LIMITS.storyTrayMax),
});
export type StoryTrayResponseDto = z.infer<typeof StoryTrayResponseDto>;

/** Active stories only, `created_at ASC`. */
export const UserStoriesResponseDto = z.object({
  user: UserSummaryDto,
  stories: z.array(StoryResponseDto),
});
export type UserStoriesResponseDto = z.infer<typeof UserStoriesResponseDto>;

export const StoryViewerResponseDto = z.object({
  user: UserSummaryDto,
  viewed_at: IsoDateTime,
});
export type StoryViewerResponseDto = z.infer<typeof StoryViewerResponseDto>;

/** Ordered `viewed_at DESC`. */
export const StoryViewerPageResponseDto = z.object({
  items: z.array(StoryViewerResponseDto),
  next_cursor: z.string().nullable(),
});
export type StoryViewerPageResponseDto = z.infer<typeof StoryViewerPageResponseDto>;
