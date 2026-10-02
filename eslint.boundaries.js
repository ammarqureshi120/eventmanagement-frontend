// AD-2: feature-sliced layer rules, enforced by eslint-plugin-boundaries.
// Shared by eslint.config.js and tests/eslint-boundaries.test.ts so the test proves the real policy.
import boundaries from "eslint-plugin-boundaries"

/** Architectural elements (first match wins). */
export const boundaryElements = [
  { type: "app", pattern: "src/app" },
  { type: "feature", pattern: "src/features/*", capture: ["feature"] },
  { type: "generated", pattern: "src/api/generated" },
  { type: "shared", pattern: "src/shared" },
  { type: "styles", pattern: "src/styles" },
  { type: "test-support", pattern: "src/test" },
]

const featurePublicApi = { element: { type: "feature", fileInternalPath: "index.{ts,tsx}" } }

/** Policies: everything not allowed here is an error. */
export const boundaryPolicies = [
  // Files inside one element may import each other (a feature's own internals, shared's own modules).
  { allow: { dependency: { relationship: { to: "internal" } } } },
  // Packages and Node built-ins are not governed by layer rules.
  { allow: { to: { module: { origin: ["external", "core"] } } } },
  {
    from: { element: { type: "app" } },
    allow: {
      to: [
        featurePublicApi,
        { element: { types: { anyOf: ["shared", "generated", "styles"] } } },
      ],
    },
    message: "app may import features only through their index.ts, plus shared, api/generated and styles.",
  },
  {
    from: { element: { type: "feature" } },
    allow: {
      to: [featurePublicApi, { element: { types: { anyOf: ["shared", "generated"] } } }],
    },
    message:
      "A feature may import another feature only through its index.ts (no deep imports), plus shared and api/generated.",
  },
  {
    from: { element: { type: "shared" } },
    allow: { to: { element: { type: "generated" } } },
    message: "shared may not import features or app.",
  },
  {
    from: { element: { type: "generated" } },
    allow: { to: { element: { type: "shared", fileInternalPath: "api/**" } } },
    message: "Generated API code may import only the shared/api base.",
  },
  // Test support and test files may reach any local layer.
  { from: { element: { type: "test-support" } }, allow: { to: { module: { origin: "local" } } } },
  { from: { file: { categories: "test" } }, allow: { to: { module: { origin: "local" } } } },
]

/**
 * Flat-config block for the boundaries rule.
 * @param {{ files?: string[], resolver?: Record<string, unknown> }} [options]
 */
export function boundariesConfig(options = {}) {
  return {
    files: options.files ?? ["src/**/*.{ts,tsx}"],
    plugins: { boundaries },
    settings: {
      "import/resolver": options.resolver ?? {
        typescript: { project: "./tsconfig.app.json", alwaysTryTypes: true },
      },
      "boundaries/elements": boundaryElements,
      "boundaries/files": [{ category: "test", pattern: "**/*.test.{ts,tsx}" }],
    },
    rules: {
      "boundaries/dependencies": [2, { default: "disallow", policies: boundaryPolicies }],
      // Every file under src/ must belong to a layer, and imports may not target unclassified local files
      // ("no-unknown" is named no-unknown-dependencies in boundaries v7).
      "boundaries/no-unknown-files": 2,
      "boundaries/no-unknown-dependencies": 2,
    },
  }
}
