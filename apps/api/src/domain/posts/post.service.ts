import type { UserRepository } from "../identity/ports.js";
import type { Username } from "../identity/user.entity.js";
import { MediaAsset } from "../media/media-asset.entity.js";
import type { MediaRepository } from "../media/ports.js";
import type { Clock } from "../shared/clock.js";
import { DomainError } from "../shared/errors.js";
import type { IdGenerator } from "../shared/id-generator.js";
import type { PostId, UserId } from "../shared/ids.js";
import type { Page, PageRequest, TimeCursor } from "../shared/pagination.js";
import type { Tx, UnitOfWork } from "../shared/unit-of-work.js";
import type { CreatePostCommand, UpdatePostCaptionCommand } from "./commands.js";
import { Post } from "./post.entity.js";
import type { PostRepository } from "./ports.js";
import type { PostView } from "./views.js";

export type PostServiceDeps = {
  posts: PostRepository;
  media: MediaRepository;
  users: UserRepository;
  uow: UnitOfWork;
  clock: Clock;
  ids: IdGenerator;
};

function postNotFound(): DomainError {
  return new DomainError("NOT_FOUND", "Post not found");
}

/** `F-BE-03` — posts (backend/02-services-and-use-cases.md#postservice). */
export class PostService {
  constructor(private readonly deps: PostServiceDeps) {}

  /**
   * `MEDIA_INVALID`, `VALIDATION_FAILED`. In one tx: lock the media `FOR UPDATE`, `assertAttachable` each
   * (owner = author, purpose `post`, status `uploaded`), insert post rows, mark media attached,
   * `users.posts_count += 1`. Emits `PostCreated`.
   */
  async createPost(cmd: CreatePostCommand): Promise<PostView> {
    const now = this.deps.clock.now();
    // Shape/caption validation first so invalid input never opens a transaction.
    const post = Post.create({
      id: this.deps.ids.uuidv7() as PostId,
      authorId: cmd.authorId,
      caption: cmd.caption,
      mediaIds: cmd.mediaIds,
      now,
    });
    const mediaIds = post.media.map((m) => m.mediaId);
    await this.deps.uow.run(async (tx, events) => {
      const assets = await this.deps.media.findManyForUpdate(mediaIds, tx);
      if (assets.length !== mediaIds.length) throw new DomainError("MEDIA_INVALID", "Media not found");
      for (const asset of assets)
        MediaAsset.assertAttachable(asset, { ownerId: cmd.authorId, purpose: "post" });
      await this.deps.posts.insert(post, tx);
      await this.deps.media.markAttached(mediaIds, tx);
      await this.deps.users.adjustCounters(cmd.authorId, { posts: 1 }, tx);
      events.add({ type: "PostCreated", postId: post.id, authorId: post.authorId, at: now });
    });
    return this.viewOrInternal(post.id, cmd.authorId);
  }

  /** `NOT_FOUND`, `FORBIDDEN` (`INV-10`), `VALIDATION_FAILED`. Recomputes hashtags and bumps `updated_at`. */
  async editCaption(cmd: UpdatePostCaptionCommand): Promise<PostView> {
    await this.deps.uow.run(async (tx) => {
      const post = await this.loadModifiable(cmd.postId, cmd.actorId, tx);
      await this.deps.posts.updateCaption(Post.editCaption(post, cmd.caption, this.deps.clock.now()), tx);
    });
    // A delete committed right after the edit surfaces as `NOT_FOUND`, like any later read.
    return this.getPost(cmd.postId, cmd.actorId);
  }

  /** `NOT_FOUND`, `FORBIDDEN`. Soft delete + `users.posts_count -= 1` in one tx. Emits `PostDeleted`. */
  async deletePost(postId: PostId, actorId: UserId): Promise<void> {
    await this.deps.uow.run(async (tx, events) => {
      const post = await this.loadModifiable(postId, actorId, tx);
      const now = this.deps.clock.now();
      await this.deps.posts.softDelete(post.id, now, tx);
      await this.deps.users.adjustCounters(post.authorId, { posts: -1 }, tx);
      events.add({ type: "PostDeleted", postId: post.id, authorId: post.authorId, at: now });
    });
  }

  /** `NOT_FOUND` for a missing or soft-deleted post. */
  async getPost(postId: PostId, viewerId: UserId | null = null): Promise<PostView> {
    const view = await this.deps.posts.getView(postId, viewerId);
    if (!view) throw postNotFound();
    return view;
  }

  /** Profile grid (`created_at DESC, id DESC`); `NOT_FOUND` for an unknown username (case-insensitive). */
  async listUserPosts(
    username: string,
    viewerId: UserId | null,
    page: PageRequest<TimeCursor>,
  ): Promise<Page<PostView, TimeCursor>> {
    const user = await this.deps.users.findByUsername(username.trim().toLowerCase() as Username);
    if (!user) throw new DomainError("NOT_FOUND", "User not found");
    return this.deps.posts.listByAuthor(user.id, viewerId, page);
  }

  /** Live post (row-locked by the repository inside `tx`) that `actorId` may modify. */
  private async loadModifiable(postId: PostId, actorId: UserId, tx: Tx): Promise<Post> {
    const post = await this.deps.posts.findLive(postId, tx);
    if (!post) throw postNotFound();
    Post.assertCanModify(post, actorId);
    return post;
  }

  /** Read-after-write view; the row was just committed, so a miss is an internal error. */
  private async viewOrInternal(postId: PostId, viewerId: UserId): Promise<PostView> {
    const view = await this.deps.posts.getView(postId, viewerId);
    if (!view) throw new DomainError("INTERNAL", "Post view not found after write");
    return view;
  }
}
