import type pg from "pg";

import type { Comment } from "../../domain/posts/comment.entity.js";
import type { CommentRepository } from "../../domain/posts/ports.js";
import type { CommentView } from "../../domain/posts/views.js";
import { notImplemented } from "../../domain/shared/errors.js";
import type { CommentId, PostId } from "../../domain/shared/ids.js";
import type { Page, PageRequest, TimeCursor } from "../../domain/shared/pagination.js";
import type { Tx } from "../../domain/shared/unit-of-work.js";

/** `comments` adapter — w00 stub; implemented by w02 (comments). */
export class PgCommentRepository implements CommentRepository {
  constructor(private readonly pool: pg.Pool) {}

  async insert(c: Comment, tx: Tx): Promise<void> {
    return notImplemented("PgCommentRepository.insert");
  }

  async findLive(id: CommentId, tx?: Tx): Promise<Comment | null> {
    return notImplemented("PgCommentRepository.findLive");
  }

  async softDelete(id: CommentId, now: Date, tx: Tx): Promise<void> {
    return notImplemented("PgCommentRepository.softDelete");
  }

  async getView(id: CommentId): Promise<CommentView | null> {
    return notImplemented("PgCommentRepository.getView");
  }

  async listByPost(postId: PostId, page: PageRequest<TimeCursor>): Promise<Page<CommentView, TimeCursor>> {
    return notImplemented("PgCommentRepository.listByPost");
  }
}
