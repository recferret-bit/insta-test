/** `SearchResultViewModel` & mappers (frontend/02). Owned by w05 after w00. */
import type { HashtagResultDto, UserSummaryDto } from "@insta/contracts";

import { formatCount } from "./format";
import { toUserSummaryVM, type UserSummaryViewModel } from "./user";

export type UserResultViewModel = {
  kind: "user";
  key: string;
  href: string;
  title: string;
  subtitle: string;
  avatarUrl: string;
  user: UserSummaryViewModel;
};

export type HashtagResultViewModel = {
  kind: "hashtag";
  key: string;
  href: string;
  title: string;
  /** `"1,234 posts"`. */
  subtitle: string;
  tag: string;
  postCount: number;
};

export type SearchResultViewModel = UserResultViewModel | HashtagResultViewModel;

export function toUserResultVM(dto: UserSummaryDto): UserResultViewModel {
  const user = toUserSummaryVM(dto);
  return {
    kind: "user",
    key: `user:${user.id}`,
    href: user.profilePath,
    title: user.username,
    subtitle: user.fullName,
    avatarUrl: user.avatarUrl,
    user,
  };
}

export function toHashtagResultVM(dto: HashtagResultDto): HashtagResultViewModel {
  return {
    kind: "hashtag",
    key: `tag:${dto.tag}`,
    href: `/tags/${encodeURIComponent(dto.tag)}`,
    title: `#${dto.tag}`,
    subtitle: formatCount(dto.post_count, "post"),
    tag: dto.tag,
    postCount: dto.post_count,
  };
}

/** Search input → `q`: trimmed; leading `@`/`#` are kept (the server strips them). `null` when empty. */
export function toSearchQuery(input: string, max: number): string | null {
  const q = input.trim().slice(0, max);
  return q.length > 0 ? q : null;
}
