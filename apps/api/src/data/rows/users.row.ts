/* Database Entity — mirrors the table columns exactly (persistence/03-row-mappers.md#row-types). */

/** `users` */
export type UserRow = {
  id: string;
  username: string;
  email: string;
  password_hash: string;
  full_name: string;
  bio: string;
  avatar_media_id: string | null;
  posts_count: number;
  followers_count: number;
  following_count: number;
  created_at: Date;
  updated_at: Date;
};
