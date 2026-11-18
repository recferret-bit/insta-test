import type { PostId, UserId } from "../shared/ids.js";

export type Like = { postId: PostId; userId: UserId; createdAt: Date };

/** Result of like/unlike (read after mutation in the same tx). */
export type LikeState = { postId: PostId; liked: boolean; likeCount: number };

/** Entity factory for `ENT-Like` (one per user per post, `INV-02` — enforced by the PK). */
export const Like = {
  create(input: { postId: PostId; userId: UserId; now: Date }): Like {
    return { postId: input.postId, userId: input.userId, createdAt: input.now };
  },
};
