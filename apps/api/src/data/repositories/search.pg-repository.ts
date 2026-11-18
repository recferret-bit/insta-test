import type pg from "pg";

import type { UserSummaryView } from "../../domain/identity/views.js";
import type { SearchQueries } from "../../domain/search/ports.js";
import type { HashtagStat } from "../../domain/search/views.js";
import { notImplemented } from "../../domain/shared/errors.js";
import type { UserId } from "../../domain/shared/ids.js";

/** Search read-model queries — w00 stub; implemented by w05 (search). */
export class PgSearchQueries implements SearchQueries {
  constructor(private readonly pool: pg.Pool) {}

  async users(q: string, viewerId: UserId | null, limit: number): Promise<UserSummaryView[]> {
    return notImplemented("PgSearchQueries.users");
  }

  async hashtags(prefix: string, limit: number): Promise<HashtagStat[]> {
    return notImplemented("PgSearchQueries.hashtags");
  }
}
