import { generatedApi } from "@/api/generated/me"

/**
 * AD-29 cache tags for the account feature, applied once by `app/api-enhance.ts`. Both My account writes change the
 * signed-in user (the profile, or the version a credential write bumps) and write an Audit Entry, so they invalidate
 * `Me` (the shell's name and the profile form re-seed) and `Audit` (audit lists, from Epic 2 on).
 * `enhanceEndpoints` updates the shared endpoint definitions, so the generated hooks pick this up.
 */
export function enhanceAccountApi() {
  return generatedApi.enhanceEndpoints({
    addTagTypes: ["Audit"],
    endpoints: {
      updateMyProfile: { invalidatesTags: ["Me", "Audit"] },
      changeMyPassword: { invalidatesTags: ["Me", "Audit"] },
    },
  })
}
