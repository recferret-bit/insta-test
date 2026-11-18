import { notImplemented } from "../shared/errors.js";
import type { UserId } from "../shared/ids.js";
import type { PageRequest, TimeCursor } from "../shared/pagination.js";
import type { FeedQueries } from "./ports.js";
import type { FeedPage } from "./views.js";

export type FeedServiceDeps = {
  feed: FeedQueries;
};

/** `F-BE-07` — home feed & explore (backend/02-services-and-use-cases.md#feedservice--searchservice). */
export class FeedService {
  constructor(private readonly deps: FeedServiceDeps) {}

  /** Followees ∪ self, keyset on `(created_at, id)` (`DEC-09`). */
  async homeFeed(viewerId: UserId, page: PageRequest<TimeCursor>): Promise<FeedPage> {
    return notImplemented("FeedService.homeFeed");
  }

  /** Everyone except the viewer. */
  async explore(viewerId: UserId | null, page: PageRequest<TimeCursor>): Promise<FeedPage> {
    return notImplemented("FeedService.explore");
  }
}
