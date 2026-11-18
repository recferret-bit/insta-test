import { fileURLToPath } from "node:url";

import { ESLint } from "eslint";
import { beforeAll, describe, expect, it } from "vitest";

/**
 * Lint fixtures for the module-boundary table (F-CORE-02, F-BE-10, F-ECOMM-12): the repo's real
 * `eslint.config.js` must reject forbidden imports. Fixtures are linted in memory under virtual
 * file paths, so nothing is written to `src/`.
 */
const repoRoot = fileURLToPath(new URL("../../../../../", import.meta.url));

let eslint: ESLint;

async function ruleIdsFor(filePath: string, code: string): Promise<string[]> {
  const [result] = await eslint.lintText(code, { filePath: `${repoRoot}${filePath}` });
  return (result?.messages ?? []).map((m) => m.ruleId ?? "fatal");
}

describe("layer boundaries (eslint.config.js)", () => {
  beforeAll(() => {
    eslint = new ESLint({ cwd: repoRoot });
  });

  it("rejects `pg` imported from domain/", async () => {
    const ids = await ruleIdsFor(
      "apps/api/src/domain/shared/__fixture__.ts",
      'import pg from "pg";\nexport const x = pg;\n',
    );
    expect(ids).toContain("no-restricted-imports");
  });

  it("rejects @insta/contracts imported from domain/", async () => {
    const ids = await ruleIdsFor(
      "apps/api/src/domain/shared/__fixture__.ts",
      'import { LIMITS } from "@insta/contracts";\nexport const x = LIMITS;\n',
    );
    expect(ids).toContain("no-restricted-imports");
  });

  it("rejects data/ imported from domain/", async () => {
    const ids = await ruleIdsFor(
      "apps/api/src/domain/shared/__fixture__.ts",
      'import { createPool } from "../../data/db/pool.js";\nexport const x = createPool;\n',
    );
    expect(ids).toContain("import/no-restricted-paths");
  });

  it("rejects data/ imported from api/", async () => {
    const ids = await ruleIdsFor(
      "apps/api/src/api/__fixture__.ts",
      'import { createPool } from "../data/db/pool.js";\nexport const x = createPool;\n',
    );
    expect(ids).toContain("import/no-restricted-paths");
  });

  it("rejects outbound fetch in the API", async () => {
    const ids = await ruleIdsFor("apps/api/src/api/__fixture__.ts", 'export const r = fetch("http://x");\n');
    expect(ids).toContain("no-restricted-globals");
  });

  it("accepts an allowed domain import", async () => {
    const ids = await ruleIdsFor(
      "apps/api/src/domain/shared/__fixture__.ts",
      'import { ERROR_CODES } from "./errors.js";\nexport const x = ERROR_CODES;\n',
    );
    expect(ids).toEqual([]);
  });
});
