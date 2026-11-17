import { test } from "node:test";
import assert from "node:assert/strict";
import { LIMITS } from "../wire/limits.ts";
import { ERROR_CODES, ERROR_HTTP_STATUS } from "../wire/error-codes.ts";
import { ID_PREFIX, publicIdPattern } from "../wire/id-prefixes.ts";
import { DOMAIN_LIMITS } from "../domain/shared/limits.ts";
import { DOMAIN_ERROR_CODES } from "../domain/shared/errors.ts";
import { PUBLIC_ID_PREFIX } from "../domain/shared/public-id.ts";

test("every domain limit equals the wire limit of the same name", () => {
  for (const [key, value] of Object.entries(DOMAIN_LIMITS)) {
    assert.ok(key in LIMITS, `wire LIMITS is missing ${key}`);
    assert.equal(LIMITS[key as keyof typeof LIMITS], value, `limit ${key} differs`);
  }
});

test("domain ErrorCode list equals wire ErrorCode list", () => {
  assert.deepEqual([...DOMAIN_ERROR_CODES], [...ERROR_CODES]);
});

test("every error code has an HTTP status in the 4xx/5xx range", () => {
  assert.deepEqual(Object.keys(ERROR_HTTP_STATUS).sort(), [...ERROR_CODES].sort());
  for (const status of Object.values(ERROR_HTTP_STATUS)) {
    assert.ok(status >= 400 && status <= 599);
  }
});

test("domain and wire ID prefixes are equal", () => {
  assert.deepEqual(PUBLIC_ID_PREFIX, ID_PREFIX);
});

test("publicIdPattern accepts 32 lowercase hex and rejects others", () => {
  const re = publicIdPattern("usr");
  assert.ok(re.test("usr_0190f3c2a1b47c3e9d1f2a3b4c5d6e7f"));
  assert.ok(!re.test("usr_0190F3C2A1B47C3E9D1F2A3B4C5D6E7F"));
  assert.ok(!re.test("pst_0190f3c2a1b47c3e9d1f2a3b4c5d6e7f"));
  assert.ok(!re.test("usr_0190f3c2a1b47c3e9d1f2a3b4c5d6e7"));
  assert.ok(!re.test("usr_0190f3c2a1b47c3e9d1f2a3b4c5d6e7f0"));
});
