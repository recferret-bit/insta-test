import { describe, expect, it } from "vitest";

import {
  mapSessionEntityToRow,
  mapSessionRowToEntity,
} from "../../../src/data/mappers/sessions.row-mapper.js";
import type { SessionRow } from "../../../src/data/rows/sessions.row.js";
import type { Session } from "../../../src/domain/identity/session.entity.js";
import type { SessionId, UserId } from "../../../src/domain/shared/ids.js";

const session: Session = {
  id: "0193a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5b" as SessionId,
  userId: "0193a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5c" as UserId,
  tokenHash: Buffer.alloc(32, 7),
  userAgent: "Mozilla/5.0",
  createdAt: new Date("2026-11-17T10:00:00.000Z"),
  expiresAt: new Date("2026-12-17T10:00:00.000Z"),
  revokedAt: null,
};

describe("sessions row mapper", () => {
  it("round-trips entity → row → entity", () => {
    expect(mapSessionRowToEntity(mapSessionEntityToRow(session))).toEqual(session);
  });

  it("maps snake_case columns and keeps the Buffer and revoked_at", () => {
    const row: SessionRow = {
      ...mapSessionEntityToRow(session),
      revoked_at: new Date("2026-11-18T00:00:00.000Z"),
    };
    expect(row.user_id).toBe(session.userId);
    expect(row.token_hash).toBe(session.tokenHash);
    expect(mapSessionRowToEntity(row).revokedAt).toEqual(new Date("2026-11-18T00:00:00.000Z"));
  });
});
