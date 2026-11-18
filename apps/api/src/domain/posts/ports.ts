import type { UserRelationView } from "../identity/views.js";
import type { CommentId, PostId, UserId } from "../shared/ids.js";
import type { Page, PageRequest, TimeCursor } from "../shared/pagination.js";
import type { Tx } from "../shared/unit-of-work.js";
import type { Comment } from "./comment.entity.js";
import type { Like } from "./like.entity.js";
import type { Post } from "./post.entity.js";
import type { CommentView, PostView } from "./views.js";

export type PostCounterDelta = Partial<{ likes: number; comments: number }>;

export interface PostRepository {
  /** Inserts `posts` + `post_media` + `post_hashtags`. */
  insert(post: Post, tx: Tx): Promise<void>;
  findLive(id: PostId, tx?: Tx): Promise<Post | null>;
  /** Updates caption/`updated_at` and replaces hashtags. */
  updateCaption(post: Post, tx: Tx): Promise<void>;
  softDelete(id: PostId, now: Date, tx: Tx): Promise<void>;
  adjustCounters(
    id: PostId,
    delta: PostCounterDelta,
    tx: Tx,
  ): Promise<{ likeCount: number; commentCount: number }>;
  getView(id: PostId, viewerId: UserId | null): Promise<PostView | null>;
  listByAuthor(
    authorId: UserId,
    viewerId: UserId | null,
    page: PageRequest<TimeCursor>,
  ): Promise<Page<PostView, TimeCursor>>;
}

export interface LikeRepository {
  insertIfAbsent(like: Like, tx: Tx): Promise<boolean>;
  deleteIfPresent(postId: PostId, userId: UserId, tx: Tx): Promise<boolean>;
  listLikers(
    postId: PostId,
    viewerId: UserId | null,
    page: PageRequest<TimeCursor>,
  ): Promise<Page<UserRelationView, TimeCursor>>;
}

export interface CommentRepository {
  insert(c: Comment, tx: Tx): Promise<void>;
  findLive(id: CommentId, tx?: Tx): Promise<Comment | null>;
  softDelete(id: CommentId, now: Date, tx: Tx): Promise<void>;
  getView(id: CommentId): Promise<CommentView | null>;
  listByPost(postId: PostId, page: PageRequest<TimeCursor>): Promise<Page<CommentView, TimeCursor>>;
}
