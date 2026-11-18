import type pg from "pg";

import type { FeedQueries } from "../../domain/feed/ports.js";
import type { FeedPage, HashtagFeedPage } from "../../domain/feed/views.js";
import type { Hashtag } from "../../domain/posts/post.entity.js";
import { notImplemented } from "../../domain/shared/errors.js";
import type { UserId } from "../../domain/shared/ids.js";
import type { PageRequest, TimeCursor } from "../../domain/shared/pagination.js";

/** Feed read-model queries — w00 stub; implemented by w05 (feed). */
export class PgFeedQueries implements FeedQueries {
  constructor(private readonly pool: pg.Pool) {}

  async homeFeed(viewerId: UserId, page: PageRequest<TimeCursor>): Promise<FeedPage> {
    return notImplemented("PgFeedQueries.homeFeed");
  }

  async explore(viewerId: UserId | null, page: PageRequest<TimeCursor>): Promise<FeedPage> {
    return notImplemented("PgFeedQueries.explore");
  }

  async byHashtag(
    tag: Hashtag,
    viewerId: UserId | null,
    page: PageRequest<TimeCursor>,
  ): Promise<HashtagFeedPage> {
    return notImplemented("PgFeedQueries.byHashtag");
  }
}
