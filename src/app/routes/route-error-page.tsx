/** Root error boundary: calm fallback for failed chunk loads and render errors (no error details shown). */
export function RouteErrorPage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-xl flex-col justify-center gap-3 p-4 sm:p-6">
      <h1 className="text-2xl font-semibold">Something went wrong</h1>
      <p className="text-muted-foreground">Your data is safe. Reload the page to try again.</p>
      <button
        type="button"
        onClick={() => window.location.reload()}
        className="inline-flex min-h-11 w-fit items-center rounded-lg bg-primary px-4 font-medium text-primary-foreground"
      >
        Reload
      </button>
    </main>
  )
}
