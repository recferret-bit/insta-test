#!/usr/bin/env node
// Validates the 7-category docs/specs/ superset, cross-layer entity map,
// relative markdown links, AGENTS.md, and CLAUDE.md, and emits SpecArtifactStatus JSON.

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

const CORE_REQUIRED = [
  "docs/specs/specs/01-project-structure.md",
  "docs/specs/specs/02-architecture-and-patterns.md",
  "docs/specs/specs/03-domain-and-entity-map.md",
];

function parseArgs(argv) {
  const out = { root: ".", json: false };
  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === "--root" && argv[i + 1]) out.root = argv[++i];
    else if (argv[i] === "--json") out.json = true;
  }
  return out;
}

function walkMd(dir, root) {
  if (!fs.existsSync(dir)) return [];
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith(".")) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walkMd(full, root));
    else if (entry.isFile() && entry.name.endsWith(".md")) {
      out.push(path.relative(root, full).split(path.sep).join("/"));
    }
  }
  return out.sort();
}

export function validateSpecsTree(rootDir) {
  const root = path.resolve(rootDir);
  const errors = [];
  const rootIndex = "docs/specs/README.md";
  const rootIndexAbs = path.join(root, rootIndex);
  if (!fs.existsSync(rootIndexAbs)) {
    errors.push(`missing master index ${rootIndex}`);
  }

  const agentsAbs = path.join(root, "AGENTS.md");
  const claudeAbs = path.join(root, "CLAUDE.md");
  const agentsMd = fs.existsSync(agentsAbs);
  const claudeMd = fs.existsSync(claudeAbs);
  if (!agentsMd) errors.push("missing root AGENTS.md");
  else {
    const txt = fs.readFileSync(agentsAbs, "utf8");
    if (!txt.includes("docs/specs")) {
      errors.push("AGENTS.md does not reference docs/specs");
    }
  }
  if (!claudeMd) errors.push("missing root CLAUDE.md");
  else {
    const txt = fs.readFileSync(claudeAbs, "utf8");
    if (!txt.includes("docs/specs") && !txt.includes("AGENTS.md")) {
      errors.push("CLAUDE.md must reference AGENTS.md or docs/specs");
    }
  }

  const skillsScaffolded = fs.existsSync(path.join(root, ".agents/skills"));
  const allFeatures = new Set();
  const allEntities = new Set();
  const categories = [];
  let persistenceApplicable = true;
  let externalApplicable = true;

  for (const category of CATEGORIES) {
    const catDir = path.join(root, "docs/specs", category);
    const readmeAbs = path.join(catDir, "README.md");
    const files = walkMd(catDir, root);
    if (!fs.existsSync(readmeAbs)) {
      errors.push(`missing category index docs/specs/${category}/README.md`);
      categories.push({
        category,
        applicable: true,
        files,
        entities: [],
        feature_ids: [],
      });
      continue;
    }
    const readmeText = fs.readFileSync(readmeAbs, "utf8");
    const naMatch =
      /status\*?:\*?\s*(?:not\s+applicable|n\/a)(?:\s*[—:-]\s*(.+))?/i.exec(
        readmeText,
      );
    const applicable = !naMatch;
    if (category === "persistence") persistenceApplicable = applicable;
    if (category === "external-communication") externalApplicable = applicable;

    const catEntities = new Set();
    const catFeatures = new Set();
    for (const rel of files) {
      const content = fs.readFileSync(path.join(root, rel), "utf8");
      for (const m of content.matchAll(/\b(F-[A-Z0-9]+-\d{1,3})\b/g)) {
        catFeatures.add(m[1]);
        allFeatures.add(m[1]);
      }
      for (const m of content.matchAll(/\b(ENT-[A-Za-z0-9_]+)\b/g)) {
        catEntities.add(m[1]);
        allEntities.add(m[1]);
      }
      // Verify relative markdown links (ignoring fenced code blocks)
      const stripped = content.replace(/```[\s\S]*?```/g, "");
      for (const link of stripped.matchAll(/\[[^\]]*\]\(([^)#\s]+)(?:#[^)]*)?\)/g)) {
        const target = link[1];
        if (
          target.startsWith("http://") ||
          target.startsWith("https://") ||
          target.startsWith("mailto:") ||
          target.startsWith("file://")
        ) {
          continue;
        }
        const resolved = path.resolve(path.dirname(path.join(root, rel)), target);
        if (!fs.existsSync(resolved)) {
          errors.push(`${rel}: broken link to ${target}`);
        }
      }
    }

    categories.push({
      category,
      applicable,
      ...(naMatch?.[1] ? { rationale: naMatch[1].trim().slice(0, 500) } : {}),
      files,
      entities: [...catEntities].sort(),
      feature_ids: [...catFeatures].sort(),
    });
  }

  for (const req of CORE_REQUIRED) {
    if (!fs.existsSync(path.join(root, req))) {
      errors.push(`missing required core spec ${req}`);
    }
  }

  // Validate cross-layer entity map when ENT-* entities exist or persistence/API are applicable
  const entityMapAbs = path.join(
    root,
    "docs/specs/specs/03-domain-and-entity-map.md",
  );
  if (fs.existsSync(entityMapAbs)) {
    const mapText = fs.readFileSync(entityMapAbs, "utf8");
    const sections = mapText.split(/^##+\s+(?=ENT-)/m).slice(1);
    if (sections.length === 0 && (persistenceApplicable || externalApplicable)) {
      errors.push(
        "docs/specs/specs/03-domain-and-entity-map.md must define at least one ## ENT-<Name> cross-layer entity section",
      );
    }
    for (const sec of sections) {
      const header = /^ENT-[A-Za-z0-9_]+/.exec(sec.trim());
      const entId = header ? header[0] : "ENT-unknown";
      allEntities.add(entId);
      const hasBusiness = /business\s+entity/i.test(sec);
      const hasDto = !externalApplicable || /dto|request|response|n\/a/i.test(sec);
      const hasDb = !persistenceApplicable || /database\s+entity|table|row|n\/a/i.test(sec);
      const hasTable = /\|.*\|.*\|/.test(sec);
      if (!hasBusiness || !hasDto || !hasDb || !hasTable) {
        errors.push(
          `${entId} in 03-domain-and-entity-map.md must specify API DTO, Business Entity, Database Entity, and a field mapping table`,
        );
      }
    }
  }

  if (allFeatures.size === 0) {
    errors.push(
      "docs/specs/ must declare at least one feature ID matching F-<CATEGORY>-<NN>",
    );
  }

  return {
    valid: errors.length === 0,
    validation_errors: errors.slice(0, 64),
    root_index: rootIndex,
    agents_md: agentsMd,
    claude_md: claudeMd,
    skills_scaffolded: skillsScaffolded,
    categories,
    feature_ids: [...allFeatures].sort(),
    entity_ids: [...allEntities].sort(),
  };
}

if (import.meta.main || process.argv[1]?.endsWith("validate-specs.mjs")) {
  const args = parseArgs(process.argv);
  const report = validateSpecsTree(args.root);
  if (args.json) {
    console.log(JSON.stringify(report, null, 2));
  } else if (report.valid) {
    console.log(
      `specs valid: ${report.feature_ids.length} features, ${report.entity_ids.length} entities across 7 categories.`,
    );
  } else {
    console.error("spec validation failed:");
    for (const err of report.validation_errors) console.error(`  - ${err}`);
  }
  process.exit(report.valid ? 0 : 1);
}
