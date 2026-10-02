import js from "@eslint/js"
import globals from "globals"
import reactHooks from "eslint-plugin-react-hooks"
import reactRefresh from "eslint-plugin-react-refresh"
import tseslint from "typescript-eslint"
import { defineConfig, globalIgnores } from "eslint/config"

import { boundariesConfig } from "./eslint.boundaries.js"

export default defineConfig([
  globalIgnores(["dist", "playwright-report", "test-results"]),
  {
    files: ["**/*.{ts,tsx}"],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
    },
    rules: {
      "react-refresh/only-export-components": "off",
    },
  },
  {
    files: ["*.{js,ts}", "build/**/*.ts", "scripts/**/*.mjs", "e2e/**/*.ts", "tests/**/*.ts"],
    languageOptions: {
      globals: globals.node,
    },
  },
  // AD-2: layer boundaries for application code.
  boundariesConfig(),
])
