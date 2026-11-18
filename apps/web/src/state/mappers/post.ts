/** `PostViewModel`, caption tokenizer & post form mappers (frontend/02). Owned by w02 after w00. */
import type { PostResponseDto } from "@insta/contracts";

import type { CreatePostBody, UpdatePostBody } from "../../api/posts";
import { formatCount, formatFullDate, formatRelativeTime, truncate } from "./format";
import { toMediaVM, type MediaViewModel } from "./media";
import { toUserSummaryVM, type UserSummaryViewModel } from "./user";

export type CaptionToken =
  | { type: "text"; text: string }
  | { type: "hashtag"; text: string; tag: string; href: string }
  | { type: "mention"; text: string; username: string; href: string };

export type PostViewModel = {
  id: string;
  path: string;
  author: UserSummaryViewModel;
  caption: string;
  captionTokens: CaptionToken[];
  /** Image alt text: caption's first 100 chars, else `"Photo by @username"`. */
  altText: string;
  media: MediaViewModel[];
  hasMultipleMedia: boolean;
  hashtags: string[];
  likeCount: number;
  likeCountLabel: string;
  commentCount: number;
  /** `"View all 12 comments"`, `"View 1 comment"`, or `""` when there are none. */
  viewCommentsLabel: string;
  viewerHasLiked: boolean;
  isOwn: boolean;
  isEdited: boolean;
  createdAt: string;
  createdAtRelative: string;
  createdAtTitle: string;
  updatedAt: string;
};

export type PostMapContext = {
  /** `usr_…` of the signed-in user, or `null` when anonymous. */
  viewerId: string | null;
  now?: Date;
};

/**
 * Hashtags follow the server rule `#([\p{L}\p{N}_]{1,64})` (specs/03 entity map); mentions are display-only
 * links for `@[a-z0-9._]{1,30}` (a trailing `.` is treated as punctuation).
 */
const TOKEN_PATTERN = /#([\p{L}\p{N}_]{1,64})|@([A-Za-z0-9._]{1,30})/gu;

export function tokenizeCaption(caption: string): CaptionToken[] {
  const tokens: CaptionToken[] = [];
  let last = 0;
  const pushText = (text: string) => {
    if (!text) return;
    const prev = tokens[tokens.length - 1];
    if (prev?.type === "text") prev.text += text;
    else tokens.push({ type: "text", text });
  };
  for (const match of caption.matchAll(TOKEN_PATTERN)) {
    const index = match.index ?? 0;
    const prevChar = index > 0 ? caption[index - 1] : "";
    // `a#b` / `mail@host` are not tags or mentions: require a non-word character before the sigil.
    if (prevChar && /[\p{L}\p{N}_]/u.test(prevChar)) continue;
    pushText(caption.slice(last, index));
    const [full, tag, mention] = match;
    if (tag !== undefined) {
      const lower = tag.toLowerCase();
      tokens.push({ type: "hashtag", text: full, tag: lower, href: `/tags/${encodeURIComponent(lower)}` });
      last = index + full.length;
    } else if (mention !== undefined) {
      const username = mention.replace(/\.+$/, "").toLowerCase();
      if (!username) continue;
      const text = `@${mention.replace(/\.+$/, "")}`;
      tokens.push({ type: "mention", text, username, href: `/u/${encodeURIComponent(username)}` });
      last = index + text.length;
    }
  }
  pushText(caption.slice(last));
  return tokens;
}

function viewCommentsLabel(count: number): string {
  if (count <= 0) return "";
  return count === 1 ? "View 1 comment" : `View all ${formatCount(count, "comment")}`;
}

/** Applies counter/like changes and recomputes the derived labels (used by optimistic updates & SSE). */
export function withPostCounters(
  vm: PostViewModel,
  patch: Partial<Pick<PostViewModel, "likeCount" | "commentCount" | "viewerHasLiked">>,
): PostViewModel {
  const likeCount = Math.max(0, patch.likeCount ?? vm.likeCount);
  const commentCount = Math.max(0, patch.commentCount ?? vm.commentCount);
  return {
    ...vm,
    likeCount,
    commentCount,
    viewerHasLiked: patch.viewerHasLiked ?? vm.viewerHasLiked,
    likeCountLabel: formatCount(likeCount, "like"),
    viewCommentsLabel: viewCommentsLabel(commentCount),
  };
}

export function toPostVM(dto: PostResponseDto, ctx: PostMapContext): PostViewModel {
  const author = toUserSummaryVM(dto.author);
  const caption = dto.caption.trim();
  return {
    id: dto.id,
    path: `/p/${encodeURIComponent(dto.id)}`,
    author,
    caption: dto.caption,
    captionTokens: tokenizeCaption(dto.caption),
    altText: caption ? truncate(caption, 100) : `Photo by @${author.username}`,
    media: dto.media.map(toMediaVM),
    hasMultipleMedia: dto.media.length > 1,
    hashtags: dto.hashtags,
    likeCount: dto.like_count,
    likeCountLabel: formatCount(dto.like_count, "like"),
    commentCount: dto.comment_count,
    viewCommentsLabel: viewCommentsLabel(dto.comment_count),
    viewerHasLiked: dto.viewer_has_liked,
    isOwn: ctx.viewerId !== null && ctx.viewerId === dto.author.id,
    isEdited: dto.updated_at !== dto.created_at,
    createdAt: dto.created_at,
    createdAtRelative: formatRelativeTime(dto.created_at, ctx.now),
    createdAtTitle: formatFullDate(dto.created_at),
    updatedAt: dto.updated_at,
  };
}

export function toCreatePostDto(caption: string, uploadedMediaIds: string[]): CreatePostBody {
  return { caption, media_ids: [...uploadedMediaIds] };
}

export function toUpdatePostDto(caption: string): UpdatePostBody {
  return { caption };
}
