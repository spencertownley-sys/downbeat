/**
 * Clerk sign-in is on only when both keys are present. Safe to import from
 * middleware (no database or Clerk server imports).
 */
export function isAuthConfigured(): boolean {
  return !!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY && !!process.env.CLERK_SECRET_KEY;
}
