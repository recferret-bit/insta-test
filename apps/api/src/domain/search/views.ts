import type { Hashtag } from "../posts/post.entity.js";

/** Hashtag search result. */
export type HashtagStat = { tag: Hashtag; postCount: number };
