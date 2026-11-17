import type { PostView } from "../posts/views.js";
import type { Page, TimeCursor } from "../shared/pagination.js";

/** Home feed / explore page, `created_at DESC, id DESC`. */
export type FeedPage = Page<PostView, TimeCursor>;

/** Hashtag post list page plus the total live post count for the tag. */
export type HashtagFeedPage = FeedPage & { postCount: number };
