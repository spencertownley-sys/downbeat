"use client"; // Error boundaries must be Client Components

import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function Error({ retry }: { error: unknown; retry: () => void }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 p-8 text-center">
      <h1 className="text-xl font-semibold">Something went wrong</h1>
      <p className="max-w-sm text-sm text-muted-foreground">
        This page couldn&apos;t load just now. Try again in a moment. Nothing you saved has been lost.
      </p>
      <div className="mt-2 flex flex-wrap items-center justify-center gap-2">
        <Button size="sm" onClick={() => retry()}>
          Try again
        </Button>
        <Button variant="outline" size="sm" asChild>
          <Link href="/">Back to home</Link>
        </Button>
      </div>
    </div>
  );
}
