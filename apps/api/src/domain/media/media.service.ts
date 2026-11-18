import type { Clock } from "../shared/clock.js";
import { notImplemented } from "../shared/errors.js";
import type { IdGenerator } from "../shared/id-generator.js";
import type { UploadMediaCommand } from "./commands.js";
import type { MediaAsset } from "./media-asset.entity.js";
import type { MediaProbe, MediaRepository, MediaStorage } from "./ports.js";

export type MediaServiceDeps = {
  media: MediaRepository;
  storage: MediaStorage;
  probe: MediaProbe;
  clock: Clock;
  ids: IdGenerator;
};

/** `F-BE-02` — media upload (backend/02-services-and-use-cases.md#mediaservice). */
export class MediaService {
  constructor(private readonly deps: MediaServiceDeps) {}

  /** `UNSUPPORTED_MEDIA_TYPE`, `PAYLOAD_TOO_LARGE`, `VALIDATION_FAILED`. */
  async upload(cmd: UploadMediaCommand): Promise<MediaAsset> {
    return notImplemented("MediaService.upload");
  }
}
