import type { UserRepository } from "../identity/ports.js";
import type { MediaRepository } from "../media/ports.js";
import type { Clock } from "../shared/clock.js";
import { notImplemented } from "../shared/errors.js";
import type { IdGenerator } from "../shared/id-generator.js";
import type { PostId, UserId } from "../shared/ids.js";
import type { Page, PageRequest, TimeCursor } from "../shared/pagination.js";
import type { UnitOfWork } from "../shared/unit-of-work.js";
import type { CreatePostCommand, UpdatePostCaptionCommand } from "./commands.js";
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

/** `F-BE-03` — posts (backend/02-services-and-use-cases.md#postservice). */
export class PostService {
  constructor(private readonly deps: PostServiceDeps) {}

  /** `MEDIA_INVALID`, `VALIDATION_FAILED`. Emits `PostCreated`. */
  async createPost(cmd: CreatePostCommand): Promise<PostView> {
    return notImplemented("PostService.createPost");
  }

  /** `NOT_FOUND`, `FORBIDDEN`. */
  async editCaption(cmd: UpdatePostCaptionCommand): Promise<PostView> {
    return notImplemented("PostService.editCaption");
  }

  /** `NOT_FOUND`, `FORBIDDEN`. Emits `PostDeleted`. */
  async deletePost(postId: PostId, actorId: UserId): Promise<void> {
    return notImplemented("PostService.deletePost");
  }

  /** `NOT_FOUND`. */
  async getPost(postId: PostId, viewerId: UserId | null = null): Promise<PostView> {
    return notImplemented("PostService.getPost");
  }

  /** Profile grid; `NOT_FOUND` for an unknown username. */
  async listUserPosts(
    username: string,
    viewerId: UserId | null,
    page: PageRequest<TimeCursor>,
  ): Promise<Page<PostView, TimeCursor>> {
    return notImplemented("PostService.listUserPosts");
  }
}
