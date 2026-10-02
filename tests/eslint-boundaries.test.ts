// @vitest-environment node
// AD-2 proof: the real boundary policy (eslint.boundaries.js) rejects deep imports into another
// feature's internals and any shared -> features import, and still allows the public index.ts.
import { resolve } from "node:path"

import { ESLint, type Linter } from "eslint"
import tseslint from "typescript-eslint"
import { describe, expect, it } from "vitest"

import { boundariesConfig } from "../eslint.boundaries.js"

const fixtureRoot = resolve(import.meta.dirname, "fixtures/boundaries")

function createEslint(resolver: Record<string, unknown>) {
  return new ESLint({
    cwd: fixtureRoot,
    overrideConfigFile: true,
    overrideConfig: [
      { files: ["**/*.ts"], languageOptions: { parser: tseslint.parser } },
      boundariesConfig({ resolver }) as unknown as Linter.Config,
    ],
  })
}

const eslint = createEslint({ node: { extensions: [".ts", ".tsx"] } })
// Same resolver the app uses, against the fixture's own tsconfig with the "@/*" alias.
const aliasEslint = createEslint({
  typescript: { project: resolve(fixtureRoot, "tsconfig.json"), alwaysTryTypes: true },
})

async function boundaryErrors(filePath: string, code: string, linter = eslint) {
  const [result] = await linter.lintText(code, { filePath: resolve(fixtureRoot, filePath) })
  const fatal = result.messages.filter((m) => m.fatal)
  expect(fatal).toEqual([])
  return result.messages.filter((m) => m.ruleId?.startsWith("boundaries/"))
}

describe("eslint-plugin-boundaries (AD-2)", () => {
  it("fails a deep import into another feature's internals", async () => {
    const errors = await boundaryErrors(
      "src/features/beta/pages/beta-page.ts",
      'import { thing } from "../../alpha/internal/thing"\nexport const x = thing\n',
    )

    expect(errors).toHaveLength(1)
  })

  it("allows importing another feature through its index.ts", async () => {
    const errors = await boundaryErrors(
      "src/features/beta/pages/beta-page.ts",
      'import { alphaThing } from "../../alpha"\nexport const x = alphaThing\n',
    )

    expect(errors).toHaveLength(0)
  })

  it("fails any shared -> features import, even through index.ts", async () => {
    const errors = await boundaryErrors(
      "src/shared/lib/uses-feature.ts",
      'import { alphaThing } from "../../features/alpha"\nexport const x = alphaThing\n',
    )

    expect(errors).toHaveLength(1)
  })

  it("allows a feature to import shared and its own internals", async () => {
    const errors = await boundaryErrors(
      "src/features/alpha/pages/alpha-page.ts",
      'import { util } from "../../../shared/lib/util"\nimport { thing } from "../internal/thing"\nexport const x = util + thing\n',
    )

    expect(errors).toHaveLength(0)
  })

  it("fails an @/ alias deep import into another feature's internals", async () => {
    const errors = await boundaryErrors(
      "src/features/beta/pages/beta-page.ts",
      'import { thing } from "@/features/alpha/internal/thing"\nexport const x = thing\n',
      aliasEslint,
    )

    expect(errors).toHaveLength(1)
  })

  it("allows an @/ alias import of another feature's index.ts", async () => {
    const errors = await boundaryErrors(
      "src/features/beta/pages/beta-page.ts",
      'import { alphaThing } from "@/features/alpha"\nexport const x = alphaThing\n',
      aliasEslint,
    )

    expect(errors).toHaveLength(0)
  })

  it("fails app importing a feature's internals", async () => {
    const errors = await boundaryErrors(
      "src/app/routes/some-route.ts",
      'import { thing } from "../../features/alpha/internal/thing"\nexport const x = thing\n',
    )

    expect(errors).toHaveLength(1)
  })

  it("allows app importing a feature through its index.ts", async () => {
    const errors = await boundaryErrors(
      "src/app/routes/some-route.ts",
      'import { alphaThing } from "../../features/alpha"\nexport const x = alphaThing\n',
    )

    expect(errors).toHaveLength(0)
  })
})
