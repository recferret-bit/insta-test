import { v7 } from "uuid";

import type { IdGenerator } from "../../domain/shared/id-generator.js";

/** Time-ordered UUIDv7 ids (`DEC-04`), lowercase canonical dashed form. */
export class UuidV7IdGenerator implements IdGenerator {
  uuidv7(): string {
    return v7();
  }
}
