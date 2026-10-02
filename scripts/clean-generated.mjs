// Empties src/api/generated before codegen so tags removed from the contract show up as deleted files (AD-4).
import { mkdirSync, readdirSync, rmSync } from "node:fs"
import { join } from "node:path"

const dir = join(import.meta.dirname, "..", "src", "api", "generated")
mkdirSync(dir, { recursive: true })
for (const entry of readdirSync(dir)) {
  rmSync(join(dir, entry), { recursive: true, force: true })
}
