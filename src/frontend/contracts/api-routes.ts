// Typed catalog of every public REST endpoint the web client calls.
// Sources: docs/specs/external-communication/02..06. Paths are relative to `${apiUrl}/api/v1`.
import type { MediaResponseDto } from "./dto/common.ts";
import type {
  HashtagPostsResponseDto,
  HashtagSearchResponseDto,
  MarkNotificationsReadRequestDto,
  NotificationPageResponseDto,
  UnreadCountResponseDto,
  UserSearchResponseDto,
} from "./dto/discovery.ts";
import type {
  CommentPageResponseDto,
  CommentResponseDto,
  CreateCommentRequestDto,
  CreatePostRequestDto,
  LikeStateResponseDto,
  PostPageResponseDto,
  PostResponseDto,
  UpdatePostRequestDto,
} from "./dto/posts.ts";
import type {
  CreateStoryRequestDto,
  StoryResponseDto,
  StoryTrayResponseDto,
  StoryViewerPageResponseDto,
  UserStoriesResponseDto,
} from "./dto/stories.ts";
import type {
  AuthTokenResponseDto,
  FollowStateResponseDto,
  LoginRequestDto,
  MeResponseDto,
  SignupRequestDto,
  SseTicketResponseDto,
  UpdateProfileRequestDto,
  UserProfileResponseDto,
  UserSummaryPageResponseDto,
} from "./dto/users.ts";
import type { PageQuery } from "./pagination.ts";

export const API_BASE_PATH = "/api/v1";

export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
export type AuthLevel = "none" | "optional" | "required" | "ticket";
export type BodyKind = "none" | "json" | "multipart";

export type EndpointDef = {
  method: HttpMethod;
  /** Template with `{param}` placeholders, relative to API_BASE_PATH. */
  path: string;
  auth: AuthLevel;
  body: BodyKind;
  /** Success status from the spec. */
  status: 200 | 201 | 204;
};

export const API_ENDPOINTS = {
  // auth & users (02)
  signup: { method: "POST", path: "/auth/signup", auth: "none", body: "json", status: 201 },
  login: { method: "POST", path: "/auth/login", auth: "none", body: "json", status: 200 },
  logout: { method: "POST", path: "/auth/logout", auth: "required", body: "none", status: 204 },
  getMe: { method: "GET", path: "/me", auth: "required", body: "none", status: 200 },
  updateMe: { method: "PATCH", path: "/me", auth: "required", body: "json", status: 200 },
  getUser: { method: "GET", path: "/users/{username}", auth: "optional", body: "none", status: 200 },
  createSseTicket: { method: "POST", path: "/events/ticket", auth: "required", body: "none", status: 201 },
  // media & posts (03)
  uploadMedia: { method: "POST", path: "/media", auth: "required", body: "multipart", status: 201 },
  createPost: { method: "POST", path: "/posts", auth: "required", body: "json", status: 201 },
  getPost: { method: "GET", path: "/posts/{post_id}", auth: "optional", body: "none", status: 200 },
  updatePost: { method: "PATCH", path: "/posts/{post_id}", auth: "required", body: "json", status: 200 },
  deletePost: { method: "DELETE", path: "/posts/{post_id}", auth: "required", body: "none", status: 204 },
  listUserPosts: { method: "GET", path: "/users/{username}/posts", auth: "optional", body: "none", status: 200 },
  // likes, comments, follows (04)
  likePost: { method: "PUT", path: "/posts/{post_id}/like", auth: "required", body: "none", status: 200 },
  unlikePost: { method: "DELETE", path: "/posts/{post_id}/like", auth: "required", body: "none", status: 200 },
  listPostLikes: { method: "GET", path: "/posts/{post_id}/likes", auth: "optional", body: "none", status: 200 },
  listComments: { method: "GET", path: "/posts/{post_id}/comments", auth: "optional", body: "none", status: 200 },
  createComment: { method: "POST", path: "/posts/{post_id}/comments", auth: "required", body: "json", status: 201 },
  deleteComment: { method: "DELETE", path: "/comments/{comment_id}", auth: "required", body: "none", status: 204 },
  followUser: { method: "PUT", path: "/users/{username}/follow", auth: "required", body: "none", status: 200 },
  unfollowUser: { method: "DELETE", path: "/users/{username}/follow", auth: "required", body: "none", status: 200 },
  listFollowers: { method: "GET", path: "/users/{username}/followers", auth: "optional", body: "none", status: 200 },
  listFollowing: { method: "GET", path: "/users/{username}/following", auth: "optional", body: "none", status: 200 },
  // stories (05)
  createStory: { method: "POST", path: "/stories", auth: "required", body: "json", status: 201 },
  deleteStory: { method: "DELETE", path: "/stories/{story_id}", auth: "required", body: "none", status: 204 },
  getStoryTray: { method: "GET", path: "/stories/tray", auth: "required", body: "none", status: 200 },
  listUserStories: { method: "GET", path: "/users/{username}/stories", auth: "optional", body: "none", status: 200 },
  markStorySeen: { method: "POST", path: "/stories/{story_id}/seen", auth: "required", body: "none", status: 204 },
  listStoryViewers: { method: "GET", path: "/stories/{story_id}/viewers", auth: "required", body: "none", status: 200 },
  // feed, search, notifications (06)
  getFeed: { method: "GET", path: "/feed", auth: "required", body: "none", status: 200 },
  getExplore: { method: "GET", path: "/explore", auth: "optional", body: "none", status: 200 },
  searchUsers: { method: "GET", path: "/search/users", auth: "optional", body: "none", status: 200 },
  searchHashtags: { method: "GET", path: "/search/hashtags", auth: "none", body: "none", status: 200 },
  listHashtagPosts: { method: "GET", path: "/hashtags/{tag}/posts", auth: "optional", body: "none", status: 200 },
  listNotifications: { method: "GET", path: "/notifications", auth: "required", body: "none", status: 200 },
  getUnreadCount: { method: "GET", path: "/notifications/unread-count", auth: "required", body: "none", status: 200 },
  markNotificationsRead: { method: "POST", path: "/notifications/read", auth: "required", body: "json", status: 200 },
  eventStream: { method: "GET", path: "/events/stream", auth: "ticket", body: "none", status: 200 },
} as const satisfies Record<string, EndpointDef>;

export type EndpointKey = keyof typeof API_ENDPOINTS;

type NoParams = Record<never, never>;
type SearchQuery = { q: string; limit?: number };

/** Type-level contract: path params, query, request body and success response per endpoint. */
export interface ApiContract {
  signup: { params: NoParams; query: never; body: SignupRequestDto; response: AuthTokenResponseDto };
  login: { params: NoParams; query: never; body: LoginRequestDto; response: AuthTokenResponseDto };
  logout: { params: NoParams; query: never; body: never; response: void };
  getMe: { params: NoParams; query: never; body: never; response: MeResponseDto };
  updateMe: { params: NoParams; query: never; body: UpdateProfileRequestDto; response: MeResponseDto };
  getUser: { params: { username: string }; query: never; body: never; response: UserProfileResponseDto };
  createSseTicket: { params: NoParams; query: never; body: never; response: SseTicketResponseDto };
  /** Body is FormData built from `UploadMediaFields` + `file`. */
  uploadMedia: { params: NoParams; query: never; body: FormData; response: MediaResponseDto };
  createPost: { params: NoParams; query: never; body: CreatePostRequestDto; response: PostResponseDto };
  getPost: { params: { post_id: string }; query: never; body: never; response: PostResponseDto };
  updatePost: { params: { post_id: string }; query: never; body: UpdatePostRequestDto; response: PostResponseDto };
  deletePost: { params: { post_id: string }; query: never; body: never; response: void };
  listUserPosts: { params: { username: string }; query: PageQuery; body: never; response: PostPageResponseDto };
  likePost: { params: { post_id: string }; query: never; body: never; response: LikeStateResponseDto };
  unlikePost: { params: { post_id: string }; query: never; body: never; response: LikeStateResponseDto };
  listPostLikes: { params: { post_id: string }; query: PageQuery; body: never; response: UserSummaryPageResponseDto };
  listComments: { params: { post_id: string }; query: PageQuery; body: never; response: CommentPageResponseDto };
  createComment: { params: { post_id: string }; query: never; body: CreateCommentRequestDto; response: CommentResponseDto };
  deleteComment: { params: { comment_id: string }; query: never; body: never; response: void };
  followUser: { params: { username: string }; query: never; body: never; response: FollowStateResponseDto };
  unfollowUser: { params: { username: string }; query: never; body: never; response: FollowStateResponseDto };
  listFollowers: { params: { username: string }; query: PageQuery; body: never; response: UserSummaryPageResponseDto };
  listFollowing: { params: { username: string }; query: PageQuery; body: never; response: UserSummaryPageResponseDto };
  createStory: { params: NoParams; query: never; body: CreateStoryRequestDto; response: StoryResponseDto };
  deleteStory: { params: { story_id: string }; query: never; body: never; response: void };
  getStoryTray: { params: NoParams; query: never; body: never; response: StoryTrayResponseDto };
  listUserStories: { params: { username: string }; query: never; body: never; response: UserStoriesResponseDto };
  markStorySeen: { params: { story_id: string }; query: never; body: never; response: void };
  listStoryViewers: { params: { story_id: string }; query: PageQuery; body: never; response: StoryViewerPageResponseDto };
  getFeed: { params: NoParams; query: PageQuery; body: never; response: PostPageResponseDto };
  getExplore: { params: NoParams; query: PageQuery; body: never; response: PostPageResponseDto };
  searchUsers: { params: NoParams; query: SearchQuery; body: never; response: UserSearchResponseDto };
  searchHashtags: { params: NoParams; query: SearchQuery; body: never; response: HashtagSearchResponseDto };
  listHashtagPosts: { params: { tag: string }; query: PageQuery; body: never; response: HashtagPostsResponseDto };
  listNotifications: { params: NoParams; query: PageQuery; body: never; response: NotificationPageResponseDto };
  getUnreadCount: { params: NoParams; query: never; body: never; response: UnreadCountResponseDto };
  markNotificationsRead: { params: NoParams; query: never; body: MarkNotificationsReadRequestDto; response: UnreadCountResponseDto };
  /** Not fetched; URL is handed to `EventSource`. */
  eventStream: { params: NoParams; query: { ticket: string }; body: never; response: never };
}

export type ParamsOf<K extends EndpointKey> = ApiContract[K]["params"];
export type QueryOf<K extends EndpointKey> = ApiContract[K]["query"];
export type BodyOf<K extends EndpointKey> = ApiContract[K]["body"];
export type ResponseOf<K extends EndpointKey> = ApiContract[K]["response"];

export type QueryValue = string | number | undefined;

const PLACEHOLDER = /\{([a-z_]+)\}/g;

/** Expand `{param}` placeholders (URI-encoded); throws if a param is missing or empty. */
export function buildApiPath<K extends EndpointKey>(
  key: K,
  params: ParamsOf<K>,
  query?: Record<string, QueryValue>,
): string {
  const values = params as Record<string, string | undefined>;
  const path = API_ENDPOINTS[key].path.replace(PLACEHOLDER, (_, name: string) => {
    const value = values[name];
    if (value === undefined || value === "") {
      throw new Error(`Missing path param "${name}" for endpoint "${key}"`);
    }
    return encodeURIComponent(value);
  });
  return `${API_BASE_PATH}${path}${toQueryString(query)}`;
}

/** `?a=1&b=x` with undefined values dropped; "" when nothing remains. */
export function toQueryString(query?: Record<string, QueryValue>): string {
  if (!query) return "";
  const search = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) {
    if (v !== undefined) search.append(k, String(v));
  }
  const s = search.toString();
  return s ? `?${s}` : "";
}
