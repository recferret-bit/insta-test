import type pg from "pg";

import type { MediaAsset } from "../../domain/media/media-asset.entity.js";
import type { MediaRepository } from "../../domain/media/ports.js";
import { notImplemented } from "../../domain/shared/errors.js";
import type { MediaId } from "../../domain/shared/ids.js";
import type { Tx } from "../../domain/shared/unit-of-work.js";

/** `media_assets` adapter — w00 stub; implemented by w01 (media). */
export class PgMediaRepository implements MediaRepository {
  constructor(private readonly pool: pg.Pool) {}

  async insert(m: MediaAsset): Promise<void> {
    return notImplemented("PgMediaRepository.insert");
  }

  async findManyForUpdate(ids: MediaId[], tx: Tx): Promise<MediaAsset[]> {
    return notImplemented("PgMediaRepository.findManyForUpdate");
  }

  async markAttached(ids: MediaId[], tx: Tx): Promise<void> {
    return notImplemented("PgMediaRepository.markAttached");
  }

  async deleteUnattachedOlderThan(cutoff: Date, limit: number): Promise<MediaAsset[]> {
    return notImplemented("PgMediaRepository.deleteUnattachedOlderThan");
  }
}
