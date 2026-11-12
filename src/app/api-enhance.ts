/**
 * AD-29: composes each feature's `enhance<F>Api()` (from `features/<f>/api.enhance.ts`, via the feature's
 * `index.ts`). Only composition lives here. Importing the generated modules registers their endpoints on the
 * shared base API; the enhancements then set each feature's cache tags. `api-enhance.test.ts` holds the
 * invalidation matrix: every mutation and the tags it must invalidate.
 */
import "@/api/generated/auth"
import "@/api/generated/me"

import { enhanceAccountApi } from "@/features/account"

enhanceAccountApi()
