import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { Provider } from "react-redux"
import { RouterProvider } from "react-router/dom"

import "@/styles/globals.css"

import { createRouter } from "./router"
import { createStore } from "./store"

const store = createStore()
const router = createRouter()

const root = document.getElementById("root")
if (!root) {
  throw new Error("Missing #root element in index.html")
}

createRoot(root).render(
  <StrictMode>
    <Provider store={store}>
      <RouterProvider router={router} />
    </Provider>
  </StrictMode>,
)
