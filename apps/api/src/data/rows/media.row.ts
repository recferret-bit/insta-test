/* Database Entity — mirrors the table columns exactly (persistence/03-row-mappers.md#row-types). */

/** `media_assets` */
export type MediaAssetRow = {
  id: string;
  owner_id: string;
  purpose: "post" | "story" | "avatar";
  kind: "image" | "video";
  mime_type: string;
  storage_key: string;
  /** `bigint` is returned by `pg` as a string; parse with `Number()` (sizes < 2^53). */
  byte_size: string;
  width: number | null;
  height: number | null;
  duration_ms: number | null;
  status: "uploaded" | "attached";
  created_at: Date;
};
