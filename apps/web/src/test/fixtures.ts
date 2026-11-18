/** Contract-valid DTO factories for web unit tests. */
import type {
  CommentResponseDto,
  MediaResponseDto,
  MeResponseDto,
  NotificationResponseDto,
  PostResponseDto,
  StoryResponseDto,
  StoryTrayItemDto,
  UserProfileResponseDto,
  UserSummaryDto,
} from "@insta/contracts";

export function hexId(prefix: string, n: number): string {
  return `${prefix}_${n.toString(16).padStart(32, "0")}`;
}

export const NOW = new Date("2026-11-17T12:00:00.000Z");

export function userSummary(overrides: Partial<UserSummaryDto> = {}): UserSummaryDto {
  return {
    id: hexId("usr", 1),
    username: "alice",
    full_name: "Alice Liddell",
    avatar_url: null,
    is_following: null,
    ...overrides,
  };
}

export function profile(overrides: Partial<UserProfileResponseDto> = {}): UserProfileResponseDto {
  return {
    id: hexId("usr", 1),
    username: "alice",
    full_name: "Alice Liddell",
    bio: "Down the rabbit hole",
    avatar_url: "http://api.test/media/2026/11/a.jpg",
    posts_count: 12,
    followers_count: 1234,
    following_count: 80,
    is_following: null,
    has_active_story: true,
    created_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

export function me(overrides: Partial<MeResponseDto> = {}): MeResponseDto {
  return { ...profile(), email: "alice@example.com", ...overrides };
}

export function media(overrides: Partial<MediaResponseDto> = {}): MediaResponseDto {
  return {
    id: hexId("med", 1),
    kind: "image",
    purpose: "post",
    mime_type: "image/jpeg",
    url: "http://api.test/media/2026/11/x.jpg",
    width: 1080,
    height: 1350,
    duration_ms: null,
    size_bytes: 12345,
    created_at: "2026-11-17T10:00:00.000Z",
    ...overrides,
  };
}

export function post(overrides: Partial<PostResponseDto> = {}): PostResponseDto {
  return {
    id: hexId("pst", 1),
    author: userSummary(),
    caption: "Sunset at the #Beach with @bob",
    media: [media()],
    hashtags: ["beach"],
    like_count: 1,
    comment_count: 0,
    viewer_has_liked: false,
    created_at: "2026-11-17T09:00:00.000Z",
    updated_at: "2026-11-17T09:00:00.000Z",
    ...overrides,
  };
}

export function comment(overrides: Partial<CommentResponseDto> = {}): CommentResponseDto {
  return {
    id: hexId("cmt", 1),
    post_id: hexId("pst", 1),
    author: userSummary({ id: hexId("usr", 2), username: "bob", full_name: "Bob" }),
    text: "Nice!",
    created_at: "2026-11-17T11:30:00.000Z",
    ...overrides,
  };
}

export function story(overrides: Partial<StoryResponseDto> = {}): StoryResponseDto {
  return {
    id: hexId("sty", 1),
    author: userSummary(),
    media: media({ purpose: "story" }),
    created_at: "2026-11-17T11:00:00.000Z",
    expires_at: "2026-11-18T11:00:00.000Z",
    viewer_has_seen: false,
    view_count: null,
    ...overrides,
  };
}

export function trayItem(overrides: Partial<StoryTrayItemDto> = {}): StoryTrayItemDto {
  return {
    user: userSummary(),
    has_unseen: true,
    latest_story_at: "2026-11-17T11:00:00.000Z",
    story_count: 2,
    ...overrides,
  };
}

export function notification(overrides: Partial<NotificationResponseDto> = {}): NotificationResponseDto {
  return {
    id: hexId("ntf", 1),
    type: "like",
    actor: userSummary({ id: hexId("usr", 2), username: "bob", full_name: "Bob" }),
    post_id: hexId("pst", 1),
    post_thumbnail_url: "http://api.test/media/2026/11/x.jpg",
    comment_id: null,
    comment_text: null,
    read_at: null,
    created_at: "2026-11-17T11:55:00.000Z",
    ...overrides,
  };
}
