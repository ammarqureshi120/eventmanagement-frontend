import { http, HttpResponse } from "msw"
import { afterEach, describe, expect, it, vi } from "vitest"

import { generatedApi as meApi } from "@/api/generated/me"
import { baseApi } from "@/shared/api/base-api"
import { server } from "@/test/msw/server"

import { createStore } from "./store"

/**
 * AD-29 invalidation matrix: every mutation and the cache tags it must invalidate, as composed by
 * `app/api-enhance.ts`. Each later story adds its rows (and its tags to `TAGS`). Proven by behaviour: a probe
 * query providing exactly one tag must refetch after the mutation exactly when that tag is in the row.
 */
const TAGS = ["Me", "Audit"] as const
type Tag = (typeof TAGS)[number]

interface MatrixRow {
  mutation: string
  /** Dispatches the mutation once against a store. */
  run: (store: ReturnType<typeof createStore>) => Promise<unknown>
  invalidates: readonly Tag[]
}

const MATRIX: readonly MatrixRow[] = [
  {
    mutation: "updateMyProfile",
    run: (store) =>
      store.dispatch(
        meApi.endpoints.updateMyProfile.initiate({
          updateMyProfileRequest: { firstName: "Sara", lastName: "Admin", phone: null, version: 1 },
        }),
      ),
    invalidates: ["Me", "Audit"],
  },
  {
    mutation: "changeMyPassword",
    run: (store) =>
      store.dispatch(
        meApi.endpoints.changeMyPassword.initiate({
          changeMyPasswordRequest: { currentPassword: "old-passw0rd", newPassword: "new-passw0rd" },
        }),
      ),
    invalidates: ["Me", "Audit"],
  },
]

/** One probe query per tag, each providing only that tag. */
const probeApi = baseApi.enhanceEndpoints({ addTagTypes: TAGS }).injectEndpoints({
  endpoints: (build) => ({
    probeTag: build.query<{ tag: string }, Tag>({
      query: (tag) => ({ url: `/api/probe-tag/${tag}` }),
      providesTags: (_result, _error, tag) => [tag],
    }),
  }),
})

describe("AD-29 invalidation matrix", () => {
  afterEach(() => {
    document.cookie = "XSRF-TOKEN=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/"
  })

  it("covers every mutation registered on the API", () => {
    const mutations = Object.entries(baseApi.endpoints as Record<string, object>)
      .filter(([, endpoint]) => "useMutation" in endpoint)
      .map(([name]) => name)
    // Auth mutations (login, logout, forgot/reset password) act on the session, not on cached data: no tags.
    const tagless = ["login", "logout", "forgotPassword", "resetPassword"]
    expect(mutations.filter((name) => !tagless.includes(name)).sort()).toEqual(MATRIX.map((row) => row.mutation).sort())
  })

  for (const row of MATRIX) {
    for (const tag of TAGS) {
      const expected = row.invalidates.includes(tag)
      it(`${row.mutation} ${expected ? "invalidates" : "does not invalidate"} ${tag}`, async () => {
        const fetches: string[] = []
        server.use(
          http.get("*/api/probe-tag/:tag", ({ params }) => {
            fetches.push(String(params.tag))
            return HttpResponse.json({ tag: params.tag })
          }),
        )
        const store = createStore()
        const subscription = store.dispatch(probeApi.endpoints.probeTag.initiate(tag))
        await subscription
        expect(fetches).toEqual([tag])

        const result = (await row.run(store)) as { error?: unknown }
        expect(result.error).toBeUndefined()

        if (expected) {
          await vi.waitFor(() => expect(fetches).toEqual([tag, tag]))
        } else {
          // Invalidation runs as the mutation settles, so any refetch has started by now: let it finish.
          await Promise.all(store.dispatch(baseApi.util.getRunningQueriesThunk()))
          expect(store.dispatch(baseApi.util.getRunningQueriesThunk())).toEqual([])
          expect(fetches).toEqual([tag])
        }
        subscription.unsubscribe()
      })
    }
  }
})
