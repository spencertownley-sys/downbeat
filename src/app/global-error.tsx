"use client"; // Error boundaries must be Client Components

import "./globals.css";

// Replaces the root layout when it fails, so it brings its own document and
// styles, and plain links rather than anything that needs the app's providers.
export default function GlobalError({ retry }: { error: unknown; retry: () => void }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-background font-sans text-foreground antialiased">
        <title>Something went wrong · Downbeat</title>
        <div className="flex min-h-screen flex-col items-center justify-center gap-3 p-8 text-center">
          <h1 className="text-xl font-semibold">Something went wrong</h1>
          <p className="max-w-sm text-sm text-muted-foreground">
            Downbeat couldn&apos;t load just now. Try again in a moment.
          </p>
          <div className="mt-2 flex flex-wrap items-center justify-center gap-2">
            <button
              type="button"
              onClick={() => retry()}
              className="inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              Try again
            </button>
            {/* A full page load: the app's router may be what failed. */}
            <a href="/" className="inline-flex h-9 items-center rounded-md border px-4 text-sm font-medium hover:bg-muted">
              Back to home
            </a>
          </div>
        </div>
      </body>
    </html>
  );
}
