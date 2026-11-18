import type { UserSummaryView } from "../identity/views.js";
import type { UserId } from "../shared/ids.js";
import type { HashtagStat } from "./views.js";

/** Read-only query port implemented in `data/repositories/search.pg-repository.ts`. */
export interface SearchQueries {
  /** Ranked: username prefix, full-name word prefix, trigram ≥ 0.3; then `followers_count DESC`. */
  users(q: string, viewerId: UserId | null, limit: number): Promise<UserSummaryView[]>;
  /** Prefix match over live posts, `post_count DESC`. */
  hashtags(prefix: string, limit: number): Promise<HashtagStat[]>;
}
