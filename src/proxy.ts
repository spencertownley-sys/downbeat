import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse, type NextFetchEvent, type NextRequest } from "next/server";
import { isAuthConfigured } from "@/lib/auth-config";

// Everything is public except the dashboard: the marketing site, login/signup,
// and the /join and /a member flows all work without an account.
const isProtected = createRouteMatcher(["/dashboard(.*)"]);

const withClerk = clerkMiddleware(
  async (auth, request) => {
    if (isProtected(request)) await auth.protect();
  },
  { signInUrl: "/login", signUpUrl: "/signup" }
);

export function proxy(request: NextRequest, event: NextFetchEvent) {
  if (isAuthConfigured()) return withClerk(request, event);

  // Without Clerk keys nobody can sign in. Locally that's fine (the dashboard
  // falls back to the seeded profile); in production keep the dashboard
  // closed rather than open it to everyone.
  if (process.env.NODE_ENV === "production" && isProtected(request)) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|api/|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
