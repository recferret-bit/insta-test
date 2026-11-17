import type { Hashtag } from "../posts/post.entity.js";
import type { UserId } from "../shared/ids.js";
import type { PageRequest, TimeCursor } from "../shared/pagination.js";
import type { FeedPage, HashtagFeedPage } from "./views.js";

/** Read-only query port implemented in `data/repositories/feed.pg-repository.ts`. */
export interface FeedQueries {
  homeFeed(viewerId: UserId, page: PageRequest<TimeCursor>): Promise<FeedPage>;
  explore(viewerId: UserId | null, page: PageRequest<TimeCursor>): Promise<FeedPage>;
  byHashtag(tag: Hashtag, viewerId: UserId | null, page: PageRequest<TimeCursor>): Promise<HashtagFeedPage>;
}
