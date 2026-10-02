import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { Provider } from "react-redux"
import { RouterProvider } from "react-router/dom"

import "@/styles/globals.css"

import { useThemeSync } from "@/features/theme"
import { keepFocusedFieldInView } from "@/shared/lib/keep-focus-in-view"
import { Toaster } from "@/shared/ui/sonner"

import { createRouter } from "./router"
import { createStore } from "./store"

const store = createStore()
const router = createRouter()

/** Keeps `<html class="dark">` in sync with the theme preference (and the OS while on System). */
function ThemeSync() {
  useThemeSync()
  return null
}

const stopKeepingFocusInView = keepFocusedFieldInView()
import.meta.hot?.dispose(stopKeepingFocusInView)

const root = document.getElementById("root")
if (!root) {
  throw new Error("Missing #root element in index.html")
}

createRoot(root).render(
  <StrictMode>
    <Provider store={store}>
      <ThemeSync />
      <RouterProvider router={router} />
      <Toaster />
    </Provider>
  </StrictMode>,
)
