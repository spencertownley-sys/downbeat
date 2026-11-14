// Internal helpers for the Server Actions, not actions themselves: no
// "use server" here, so they can never be called from the browser.
import "server-only";

import { getCurrentProfile } from "@/lib/auth";
import { ValidationError, type ActionResult } from "@/lib/action-errors";
import type { Profile } from "@/types";

export async function requireProfile(): Promise<Profile> {
  const profile = await getCurrentProfile();
  if (!profile) throw new Error("Not authenticated");
  return profile;
}

export async function toActionError(err: unknown): Promise<ActionResult<never>> {
  // Log the error type and the Postgres error code only. Drizzle's error
  // message carries the SQL and its bound parameters (member tokens, contact
  // details, hashes), which must not end up in the hosting provider's logs.
  console.error(
    "[action]",
    err instanceof ValidationError ? err.message : err instanceof Error ? err.name : "unknown error",
    (err as { cause?: { code?: string } })?.cause?.code ?? ""
  );
  if (err instanceof ValidationError) {
    return { ok: false, error: err.message };
  }
  if (err instanceof Error && err.message === "Not authenticated") {
    return { ok: false, error: "You must be signed in." };
  }
  return { ok: false, error: "Something went wrong. Please try again." };
}
