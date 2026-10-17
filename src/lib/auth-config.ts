/**
 * Clerk sign-in is on only when both keys are present. Safe to import from
 * middleware (no database or Clerk server imports).
 */
export function isAuthConfigured(): boolean {
  return !!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY && !!process.env.CLERK_SECRET_KEY;
}

/**
 * Whether pages render inside <ClerkProvider>. The provider needs only the
 * publishable key, which (unlike the secret key) is also set at build time, so
 * prerendered pages like the home page get the same root layout as dynamic
 * ones. Client-side navigation keeps the root layout of the first page loaded;
 * if that page was built without the provider, <SignIn> on /login crashes.
 */
export function hasClerkProvider(): boolean {
  return !!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
}
