/**
 * AD-29: composes each feature's `enhance<F>(api)` (from `features/<f>/api.enhance.ts`, via the
 * feature's `index.ts`). Only composition lives here. Importing the generated modules registers
 * their endpoints on the shared base API.
 */
import "@/api/generated/auth"
