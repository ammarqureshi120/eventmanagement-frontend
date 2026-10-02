import { readFileSync } from "node:fs"

import type { ConfigFile } from "@rtk-query/codegen-openapi"

// AD-4 / AD-29: generate RTK Query endpoints from the backend contract, one file per OpenAPI tag,
// injected into the shared base API. Output is committed and never hand-edited.
// `npm run api:generate` empties src/api/generated first, so removed tags show up as deletions in git.
const schemaFile = "../backend/openapi/openapi.json"

type Operation = { operationId?: string; tags?: string[] }
type Document = { paths?: Record<string, Record<string, Operation>> }

const HTTP_METHODS = new Set(["get", "put", "post", "delete", "patch", "options", "head", "trace"])

/** Tags come from the schema itself; every operation must carry exactly one (AD-29). */
function readTags(path: string): string[] {
  const document = JSON.parse(readFileSync(path, "utf8")) as Document
  const tags = new Set<string>()
  for (const [route, item] of Object.entries(document.paths ?? {})) {
    for (const [method, operation] of Object.entries(item)) {
      if (!HTTP_METHODS.has(method)) continue
      if (operation.tags?.length !== 1) {
        throw new Error(`${method.toUpperCase()} ${route} must have exactly one OpenAPI tag (has ${operation.tags?.length ?? 0}).`)
      }
      tags.add(operation.tags[0])
    }
  }
  return [...tags].sort()
}

const fileNameFor = (tag: string) => tag.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase()

const config: ConfigFile = {
  schemaFile,
  apiFile: "./src/shared/api/base-api.ts",
  apiImport: "baseApi",
  exportName: "generatedApi",
  hooks: { queries: true, lazyQueries: true, mutations: true },
  tag: true,
  outputFiles: Object.fromEntries(
    readTags(schemaFile).map((tag) => [
      `./src/api/generated/${fileNameFor(tag)}.ts`,
      { filterEndpoints: (_name, definition) => definition.operation.tags?.includes(tag) ?? false },
    ]),
  ),
}

export default config
