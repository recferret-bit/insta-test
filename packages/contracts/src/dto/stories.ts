import { z } from "zod";

import { publicId } from "../ids.js";
import { LIMITS } from "../limits.js";
import { page } from "../pagination.js";
import { IsoDateTime, MediaResponseDto, UserSummaryDto } from "./common.js";

/** Path params for `/stories/{story_id}/…`. */
export const StoryIdParamsDto = z.object({ story_id: publicId("sty") }).strict();
export type StoryIdParamsDto = z.infer<typeof StoryIdParamsDto>;

export const CreateStoryRequestDto = z
  .object({
    /** `med_…`, purpose story, status uploaded, owned by caller. */
    media_id: publicId("med"),
  })
  .strict();
export type CreateStoryRequestDto = z.infer<typeof CreateStoryRequestDto>;

export const StoryResponseDto = z.object({
  id: publicId("sty"),
  author: UserSummaryDto,
  media: MediaResponseDto,
  created_at: IsoDateTime,
  /** `created_at + 24h`. */
  expires_at: IsoDateTime,
  /** `false` when anonymous. */
  viewer_has_seen: z.boolean(),
  /** Only for the author, else `null`. */
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

/** Self first (if any active), then `has_unseen DESC`, `latest_story_at DESC`; max 100. */
export const StoryTrayResponseDto = z.object({
  items: z.array(StoryTrayItemDto).max(LIMITS.storyTrayMax),
});
export type StoryTrayResponseDto = z.infer<typeof StoryTrayResponseDto>;

export const UserStoriesResponseDto = z.object({
  user: UserSummaryDto,
  /** Active only, `created_at ASC`. */
  stories: z.array(StoryResponseDto),
});
export type UserStoriesResponseDto = z.infer<typeof UserStoriesResponseDto>;

export const StoryViewerResponseDto = z.object({
  user: UserSummaryDto,
  viewed_at: IsoDateTime,
});
export type StoryViewerResponseDto = z.infer<typeof StoryViewerResponseDto>;

/** Ordered `viewed_at DESC`. */
export const StoryViewerPageResponseDto = page(StoryViewerResponseDto);
export type StoryViewerPageResponseDto = z.infer<typeof StoryViewerPageResponseDto>;
