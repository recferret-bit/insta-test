import { ERROR_CODES as CONTRACT_ERROR_CODES, LIMITS } from "@insta/contracts";
import { describe, expect, it } from "vitest";

import { ERROR_CODES as DOMAIN_ERROR_CODES } from "../../../src/domain/shared/errors.js";
import { DOMAIN_LIMITS } from "../../../src/domain/shared/limits.js";

describe("domain ↔ contracts parity", () => {
  it("ErrorCode lists are identical (same members, same order)", () => {
    expect([...DOMAIN_ERROR_CODES]).toEqual([...CONTRACT_ERROR_CODES]);
  });

  it("every domain limit equals the contracts LIMITS value", () => {
    for (const [key, value] of Object.entries(DOMAIN_LIMITS)) {
      expect(LIMITS, `LIMITS.${key}`).toHaveProperty(key, value);
    }
  });
});
