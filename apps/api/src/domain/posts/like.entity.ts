import type { PostId, UserId } from "../shared/ids.js";

export type Like = { postId: PostId; userId: UserId; createdAt: Date };

/** Result of like/unlike (read after mutation in the same tx). */
export type LikeState = { postId: PostId; liked: boolean; likeCount: number };
