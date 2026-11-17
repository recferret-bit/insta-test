/**
 * Public ID prefixes (F-CORE-04, DEC-04). Wire IDs are `<prefix>_<32 lowercase hex>`.
 * Like, Follow and StoryView use composite keys and have no public ID.
 */
export const ID_PREFIX = {
  user: "usr",
  session: "ses",
  media: "med",
  post: "pst",
  comment: "cmt",
  story: "sty",
  notification: "ntf",
} as const;

export type IdPrefix = (typeof ID_PREFIX)[keyof typeof ID_PREFIX];

export function publicIdPattern(prefix: IdPrefix): RegExp {
  return new RegExp(`^${prefix}_[0-9a-f]{32}$`);
}
