import { act, render, screen } from "@testing-library/react"
import { http, HttpResponse } from "msw"
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { toast } from "sonner"

import { createStore } from "@/app/store"
import { baseApi } from "@/shared/api/base-api"
import { notifyNetworkError } from "@/shared/api/network"
import { Toaster } from "@/shared/ui/sonner"
import { server } from "@/test/msw/server"

import { registerNetworkToast } from "./network-toast"

const OFFLINE = "You seem to be offline. Check your connection and try again."

const probeApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    networkProbe: build.query<unknown, number>({ query: (n) => ({ url: `/api/network-probe/${n}` }) }),
  }),
})

describe("registerNetworkToast", () => {
  let unregister: () => void = () => undefined
  beforeEach(() => {
    unregister = registerNetworkToast()
  })
  afterEach(() => {
    unregister()
    act(() => {
      toast.dismiss()
    })
  })

  it("shows one offline toast however many requests fail", async () => {
    server.use(http.get("*/api/network-probe/:n", () => HttpResponse.error()))
    render(<Toaster />)
    const store = createStore()

    await Promise.all([1, 2, 3].map((n) => store.dispatch(probeApi.endpoints.networkProbe.initiate(n))))

    expect(await screen.findByText(OFFLINE)).toBeInTheDocument()
    expect(screen.getAllByText(OFFLINE)).toHaveLength(1)
  })

  it("does nothing once unregistered", async () => {
    unregister()
    render(<Toaster />)

    act(() => notifyNetworkError())

    await new Promise((resolve) => setTimeout(resolve, 50))
    expect(screen.queryByText(OFFLINE)).not.toBeInTheDocument()
  })
})
