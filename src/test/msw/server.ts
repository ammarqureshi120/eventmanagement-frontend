import { setupServer } from "msw/node"

import { handlers } from "./handlers"

/** Node MSW server for Vitest. Feature handlers live in `features/<f>/mocks.ts` and are listed in `handlers.ts`. */
export const server = setupServer(...handlers)
