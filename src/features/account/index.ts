/** Public API of the account feature (AD-2). */
export { enhanceAccountApi } from "./api.enhance"

/**
 * The My account page, loaded on demand. `app/api-enhance.ts` imports this barrel statically (for the cache tags),
 * so a static page export would pull the page into the main chunk; the router calls this from its lazy route.
 */
export const loadProfilePage = async () => (await import("./pages/profile-page")).ProfilePage
