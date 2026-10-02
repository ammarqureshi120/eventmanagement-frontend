// AD-4 drift check: fails when regenerated output differs from what git tracks
// (modified tracked files or new untracked files under the given paths).
import { execFileSync } from "node:child_process"

const paths = process.argv.slice(2)
if (paths.length === 0) {
  console.error("usage: node scripts/check-drift.mjs <path> [...path]")
  process.exit(2)
}

const git = (...args) => execFileSync("git", args, { encoding: "utf8" }).trim()

const modified = git("diff", "--name-only", "--", ...paths)
const untracked = git("ls-files", "--others", "--exclude-standard", "--", ...paths)

if (modified || untracked) {
  console.error("Generated code drifted from the committed version:")
  for (const file of [modified, untracked].filter(Boolean).join("\n").split("\n")) {
    console.error(`  ${file}`)
  }
  console.error("Run `npm run api:generate` and commit the result. Never hand-edit generated files.")
  process.exit(1)
}

console.log(`No drift in ${paths.join(", ")}.`)
