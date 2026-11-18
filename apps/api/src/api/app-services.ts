import type { FeedService } from "../domain/feed/feed.service.js";
import type { IdentityService } from "../domain/identity/identity.service.js";
import type { MediaService } from "../domain/media/media.service.js";
import type { NotificationService } from "../domain/notifications/notification.service.js";
import type { CommentService } from "../domain/posts/comment.service.js";
import type { LikeService } from "../domain/posts/like.service.js";
import type { PostService } from "../domain/posts/post.service.js";
import type { SearchService } from "../domain/search/search.service.js";
import type { FollowService } from "../domain/social/follow.service.js";
import type { StoryService } from "../domain/stories/story.service.js";
import type { SseHub } from "./sse/index.js";
import type { UrlBuilder } from "./url-builder.js";

/** Every use-case service, built once by `main.ts` (the composition root). */
export type ApiServices = {
  identity: IdentityService;
  media: MediaService;
  posts: PostService;
  likes: LikeService;
  comments: CommentService;
  follows: FollowService;
  stories: StoryService;
  feed: FeedService;
  search: SearchService;
  notifications: NotificationService;
};

/** Options handed to every route module plugin (`api/routes/*.routes.ts`). */
export type RouteDeps = {
  services: ApiServices;
  urls: UrlBuilder;
  sse: SseHub;
  /** Absolute media root (`MEDIA_DIR`) for `GET /media/*` static serving (w01). */
  mediaDir: string;
};
