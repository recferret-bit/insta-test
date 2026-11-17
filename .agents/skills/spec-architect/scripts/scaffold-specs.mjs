#!/usr/bin/env node
// Scaffolds the 7-category docs/specs/ tree, docs/questions-and-limitations/,
// AGENTS.md, CLAUDE.md, and copies wave skills into .agents/skills/ when missing.

import fs from "node:fs";
import path from "node:path";

const CATEGORIES = [
  "specs",
  "frontend",
  "backend",
  "persistence",
  "internal-communication",
  "external-communication",
  "infra",
];

function parseArgs(argv) {
  const out = { root: ".", skillsFrom: null };
  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--root" && argv[i + 1]) out.root = argv[++i];
    else if (arg === "--skills-from" && argv[i + 1]) out.skillsFrom = argv[++i];
  }
  return out;
}

function writeIfMissing(filePath, content, created) {
  if (fs.existsSync(filePath)) return false;
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, "utf8");
  created.push(filePath);
  return true;
}

function copyDirRecursive(src, dest) {
  if (!fs.existsSync(src)) return 0;
  fs.mkdirSync(dest, { recursive: true });
  let count = 0;
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const from = path.join(src, entry.name);
    const to = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      count += copyDirRecursive(from, to);
    } else if (entry.isFile()) {
      fs.copyFileSync(from, to);
      const stat = fs.statSync(from);
      if ((stat.mode & 0o111) !== 0 || /\.(mjs|sh)$/i.test(entry.name)) {
        fs.chmodSync(to, 0o755);
      }
      count++;
    }
  }
  return count;
}

export function scaffoldSpecsTree(options = {}) {
  const root = path.resolve(options.root ?? ".");
  const created = [];

  writeIfMissing(
    path.join(root, "docs/specs/README.md"),
    `# Project Specifications Index

> **Spec-First Rule:** Agents MUST read the relevant category specs below before writing or modifying code.

| Category | Directory | Status | Summary |
|---|---|---|---|
| Core Specs | [specs/](./specs/README.md) | Active | Targeted structure, architecture, cross-layer entity map, decisions |
| Frontend | [frontend/](./frontend/README.md) | Active | UI routes, components, ViewModels, design system |
| Backend | [backend/](./backend/README.md) | Active | Business entities, domain services, thin orchestrators |
| Persistence | [persistence/](./persistence/README.md) | Active | Database entities, schema, indexes, migrations, mappers |
| Internal Communication | [internal-communication/](./internal-communication/README.md) | Active | Shared contracts, events, queues, internal RPC/streams |
| External Communication | [external-communication/](./external-communication/README.md) | Active | Public HTTP/API specs, Req/Res DTOs, external integrations |
| Infra | [infra/](./infra/README.md) | Active | Docker, isolated wave compose deployment, CI, observability |
`,
    created,
  );

  for (const category of CATEGORIES) {
    writeIfMissing(
      path.join(root, "docs/specs", category, "README.md"),
      `# ${category} Specifications\n\n- **Status:** Active\n\nDocument ${category} contracts, entities, and feature IDs here.\n`,
      created,
    );
  }

  writeIfMissing(
    path.join(root, "docs/specs/specs/01-project-structure.md"),
    "# 01 — Targeted Project Structure\n\nDefine directory tree, module boundaries, and `owned_paths` rules.\n",
    created,
  );
  writeIfMissing(
    path.join(root, "docs/specs/specs/02-architecture-and-patterns.md"),
    "# 02 — Architecture & Patterns\n\nDefine layer rules, dependency direction, error handling, and Test Pyramid standards.\n",
    created,
  );
  writeIfMissing(
    path.join(root, "docs/specs/specs/03-domain-and-entity-map.md"),
    "# 03 — Master Domain & Cross-Layer Entity Map\n\nDocument every `ENT-<Name>` across API Req/Res DTOs, Application Business Entities, and Database Entities.\n",
    created,
  );
  writeIfMissing(
    path.join(root, "docs/specs/specs/04-decisions-and-invariants.md"),
    "# 04 — Architectural Decisions & Invariants\n\nRecord `DEC-01..NN` decisions and domain invariants.\n",
    created,
  );
  writeIfMissing(
    path.join(root, "docs/questions-and-limitations/README.md"),
    `# Questions & Limitations Ledger

Agents automatically record discovered gaps, issues/limitations, and open questions per wave in \`docs/questions-and-limitations/<wNN>-gaps.md\` during wave execution and validation (\`wave-validate\`).
When each wave lands on \`main\` (\`wave-land\`), all per-wave files are compiled into [GAPS_AND_QUESTIONS.md](./GAPS_AND_QUESTIONS.md) for owner review and remediation.
`,
    created,
  );
  writeIfMissing(
    path.join(root, "docs/questions-and-limitations/GAPS_AND_QUESTIONS.md"),
    `# Consolidated Gaps, Issues & Open Questions

> Automatically compiled from \`docs/questions-and-limitations/<wNN>-gaps.md\` as waves land on \`main\`.
> Review open items after wave completion and run a fix pass to resolve them.

## Summary
- **Waves recorded:** 0
- **Open items:** 0 of 0 total (Gaps: 0, Issues: 0, Open Questions: 0)
`,
    created,
  );

  writeIfMissing(
    path.join(root, "AGENTS.md"),
    `# AGENTS.md — Spec-First Engineering Constitution

## Mandatory Spec-First Protocol
1. **Check Specs First:** Always inspect [docs/specs/README.md](./docs/specs/README.md) and the relevant category spec before writing or editing code.
2. **Three-Layer Entities:** Keep API Req/Res DTOs (\`docs/specs/external-communication/\`), Application Business Entities (\`docs/specs/backend/\`), and Database Entities (\`docs/specs/persistence/\`) separate with explicit mappers per [03-domain-and-entity-map.md](./docs/specs/specs/03-domain-and-entity-map.md).
3. **Wave Isolation & Gaps Ledger:** Stay strictly within your task's \`owned_paths\`; save wave gaps, issues, and open questions into \`docs/questions-and-limitations/<wNN>-gaps.md\` (consolidated into [GAPS_AND_QUESTIONS.md](./docs/questions-and-limitations/GAPS_AND_QUESTIONS.md) on landing).
4. **Skills:** Use repo skills under \`.agents/skills/\` (\`spec-architect\`, \`wave-planner\`, \`spec-first-worker\`, \`wave-validate\`, \`wave-land\`, \`wave-sync\`, \`wave-compose-deploy\`).
`,
    created,
  );

  writeIfMissing(
    path.join(root, "CLAUDE.md"),
    `# CLAUDE.md

Read and follow [AGENTS.md](./AGENTS.md) and [docs/specs/README.md](./docs/specs/README.md) before modifying any code.

- **Spec-First Rule:** Check \`docs/specs/{specs,frontend,backend,persistence,internal-communication,external-communication,infra}/\` first. Update specs before changing contracts.
- **Wave Skills:**
  - Validate wave: \`node .agents/skills/wave-validate/scripts/validate-wave.mjs --root . --wave <wNN>\`
  - Land finished wave into \`main\`: \`node .agents/skills/wave-land/scripts/wave-land.mjs --repo . --wave <wNN>\`
  - Sync refreshed \`main\` into WIP wave: \`node .agents/skills/wave-sync/scripts/wave-sync.mjs --repo . --wave <wNN> --sync-issues\`
  - Deploy wave on unique compose ports: \`node .agents/skills/wave-compose-deploy/scripts/compose-wave.mjs --root . --project <slug> --wave <wNN> --render-only\`
`,
    created,
  );

  const gitignorePath = path.join(root, ".gitignore");
  const ignoreEntry = ".yardos/";
  if (fs.existsSync(gitignorePath)) {
    const cur = fs.readFileSync(gitignorePath, "utf8");
    if (
      !cur.split(/\r?\n/).some((line) =>
        line.trim() === ignoreEntry || line.trim() === ".yardos"
      )
    ) {
      fs.writeFileSync(
        gitignorePath,
        `${cur.replace(/\s*$/, "")}\n${ignoreEntry}\n`,
        "utf8",
      );
    }
  } else {
    fs.writeFileSync(gitignorePath, `${ignoreEntry}\n`, "utf8");
    created.push(gitignorePath);
  }

  const skillsSource = options.skillsFrom
    ? path.resolve(options.skillsFrom)
    : path.join(root, ".yardos/skills");
  let copiedSkillFiles = 0;
  if (fs.existsSync(skillsSource)) {
    copiedSkillFiles = copyDirRecursive(
      skillsSource,
      path.join(root, ".agents/skills"),
    );
  }

  return {
    ok: true,
    created: created.map((p) => path.relative(root, p)),
    copied_skill_files: copiedSkillFiles,
  };
}

if (import.meta.main || process.argv[1]?.endsWith("scaffold-specs.mjs")) {
  const args = parseArgs(process.argv);
  const res = scaffoldSpecsTree(args);
  console.log(JSON.stringify(res, null, 2));
}
