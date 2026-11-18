import type { FeedQueries } from "../feed/ports.js";
import type { HashtagFeedPage } from "../feed/views.js";
import type { UserSummaryView } from "../identity/views.js";
import { notImplemented } from "../shared/errors.js";
import type { UserId } from "../shared/ids.js";
import type { PageRequest, TimeCursor } from "../shared/pagination.js";
import type { SearchQueries } from "./ports.js";
import type { HashtagStat } from "./views.js";

export type SearchServiceDeps = {
  search: SearchQueries;
  /** `hashtagPosts` reads through `FeedQueries.byHashtag`. */
  feed: FeedQueries;
};

/** `F-BE-07` — search (backend/02-services-and-use-cases.md#feedservice--searchservice). */
export class SearchService {
  constructor(private readonly deps: SearchServiceDeps) {}

  /** `q` lowercased, leading `@` stripped. */
  async searchUsers(q: string, viewerId: UserId | null, limit: number): Promise<UserSummaryView[]> {
    return notImplemented("SearchService.searchUsers");
  }

  /** `q` lowercased, leading `#` stripped. */
  async searchHashtags(q: string, limit: number): Promise<HashtagStat[]> {
    return notImplemented("SearchService.searchHashtags");
  }

  /** Unknown tag → empty page with `postCount: 0`. */
  async hashtagPosts(
    tag: string,
    viewerId: UserId | null,
    page: PageRequest<TimeCursor>,
  ): Promise<HashtagFeedPage> {
    return notImplemented("SearchService.hashtagPosts");
  }
}
