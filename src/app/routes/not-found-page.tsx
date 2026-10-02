import { Link } from "react-router"

/** Placeholder not-found page. The full system page arrives with the app shell (Story 1.4). */
export function NotFoundPage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-xl flex-col justify-center gap-3 p-4 sm:p-6">
      <h1 className="text-2xl font-semibold">We couldn&apos;t find that page</h1>
      <p className="text-muted-foreground">Check the address, or go back to the start.</p>
      <Link
        to="/"
        className="inline-flex min-h-11 w-fit items-center rounded-lg px-1 text-primary underline underline-offset-4"
      >
        Go to home
      </Link>
    </main>
  )
}
