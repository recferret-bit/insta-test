// ESLint flat config. Layer-boundary rules implement the module-boundary table in
// docs/specs/specs/01-project-structure.md#module-boundaries (F-CORE-02, F-BE-10, F-ECOMM-12).
import js from "@eslint/js";
import importPlugin from "eslint-plugin-import";
import globals from "globals";
import tseslint from "typescript-eslint";

const API = "./apps/api/src";
const WEB = "./apps/web/src";

/** Packages the domain layer must never import (framework/driver/wire-contract free). */
const DOMAIN_FORBIDDEN_PACKAGES = [
  { name: "fastify", message: "domain/ is framework-free (F-CORE-02)." },
  { name: "pg", message: "domain/ must not import pg; define a port and implement it in data/." },
  { name: "@insta/contracts", message: "domain/ keeps its own types; DTOs are mapped in api/." },
];

/** Outbound HTTP clients are banned in apps/api/src (DEC-06, F-ECOMM-12). */
const OUTBOUND_HTTP_PACKAGES = ["axios", "undici", "node-fetch", "got", "superagent", "ky"].map((name) => ({
  name,
  message: "No outbound HTTP from the API (DEC-06, F-ECOMM-12).",
}));

export default tseslint.config(
  {
    ignores: [
      "**/node_modules/**",
      "**/dist/**",
      "**/build/**",
      "**/coverage/**",
      "**/playwright-report/**",
      "**/test-results/**",
      ".agents/**",
      ".yardos/**",
      "docs/**",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["**/*.{ts,tsx,js,mjs,cjs}"],
    plugins: { import: importPlugin },
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: "module",
      globals: { ...globals.node },
    },
    settings: {
      "import/resolver": {
        typescript: {
          project: ["packages/contracts/tsconfig.json", "apps/api/tsconfig.json", "apps/web/tsconfig.json"],
        },
        node: true,
      },
    },
    rules: {
      // Stub skeletons keep their frozen signatures, so unused *arguments* are allowed.
      "@typescript-eslint/no-unused-vars": [
        "error",
        { args: "none", varsIgnorePattern: "^_", caughtErrorsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/consistent-type-imports": ["error", { fixStyle: "inline-type-imports" }],
      "no-restricted-exports": ["error", { restrictDefaultExports: { direct: true } }],
      "import/no-restricted-paths": [
        "error",
        {
          zones: [
            // packages/contracts → nothing under apps/
            { target: "./packages/contracts", from: "./apps", message: "contracts may only import zod." },
            // api → domain ← data
            {
              target: `${API}/domain`,
              from: `${API}/api`,
              message: "domain/ must not import api/ (F-CORE-02).",
            },
            {
              target: `${API}/domain`,
              from: `${API}/data`,
              message: "domain/ must not import data/ (F-CORE-02).",
            },
            { target: `${API}/domain`, from: `${API}/jobs`, message: "domain/ must not import jobs/." },
            { target: `${API}/domain`, from: `${API}/config`, message: "domain/ must not read config." },
            { target: `${API}/data`, from: `${API}/api`, message: "data/ must not import api/ (F-CORE-02)." },
            {
              target: `${API}/api`,
              from: `${API}/data`,
              message: "api/ must not import data/; only main.ts wires adapters (F-BE-10).",
            },
            // web: ui → state → api
            { target: `${WEB}/ui`, from: `${WEB}/api`, message: "ui/ goes through state/ hooks, not api/." },
            { target: `${WEB}/state`, from: `${WEB}/ui`, message: "state/ must not import ui/." },
            { target: `${WEB}/api`, from: `${WEB}/state`, message: "api/ must not import state/." },
            { target: `${WEB}/api`, from: `${WEB}/ui`, message: "api/ must not import ui/." },
          ],
        },
      ],
    },
  },
  {
    files: ["packages/contracts/src/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              regex: "^(?!zod$|\\.{1,2}/)",
              message: "@insta/contracts has no runtime dependency other than zod (F-ICOMM-01).",
            },
          ],
        },
      ],
    },
  },
  {
    files: ["apps/api/src/domain/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [...DOMAIN_FORBIDDEN_PACKAGES, ...OUTBOUND_HTTP_PACKAGES],
          patterns: [
            { group: ["fastify/*", "@fastify/*"], message: "domain/ is framework-free (F-CORE-02)." },
            { group: ["pg/*", "pg-*"], message: "domain/ must not import pg." },
            { group: ["@insta/contracts/*"], message: "domain/ must not import contracts." },
          ],
        },
      ],
    },
  },
  {
    files: ["apps/api/src/data/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            { name: "@insta/contracts", message: "data/ maps Rows ↔ Business Entities only; no DTOs." },
            { name: "fastify", message: "data/ must not depend on the HTTP framework." },
            ...OUTBOUND_HTTP_PACKAGES,
          ],
        },
      ],
    },
  },
  {
    files: ["apps/api/src/**/*.ts"],
    ignores: ["apps/api/src/domain/**", "apps/api/src/data/**"],
    rules: {
      "no-restricted-imports": ["error", { paths: OUTBOUND_HTTP_PACKAGES }],
    },
  },
  {
    files: ["apps/api/src/**/*.ts"],
    rules: {
      "no-restricted-globals": [
        "error",
        { name: "fetch", message: "No outbound HTTP from the API (DEC-06, F-ECOMM-12)." },
      ],
    },
  },
  {
    files: ["apps/web/**/*.{ts,tsx}"],
    languageOptions: { globals: { ...globals.browser } },
  },
  {
    // React page components and tool configs are the only default exports allowed.
    files: ["apps/web/src/ui/pages/**/*.tsx", "**/*.config.{js,ts,mjs}", "eslint.config.js"],
    rules: { "no-restricted-exports": "off" },
  },
  {
    files: ["**/*.test.ts", "**/*.test.tsx", "**/test/**/*.ts"],
    rules: { "@typescript-eslint/no-non-null-assertion": "off" },
  },
);
