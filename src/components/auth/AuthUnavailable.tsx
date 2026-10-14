import Link from "next/link";
import { LogoMark } from "@/components/brand/Logo";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

/** Shown on /login and /signup when Clerk keys aren't configured. */
export function AuthUnavailable() {
  const isProduction = process.env.NODE_ENV === "production";

  return (
    <Card className="w-full max-w-sm">
      <CardHeader className="space-y-1 text-center">
        <div className="mx-auto mb-2">
          <LogoMark />
        </div>
        <CardTitle className="text-lg">Sign-in isn&apos;t set up yet</CardTitle>
        <CardDescription>
          {isProduction
            ? "Band leader accounts are being switched on. Check back soon."
            : "Add NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY and CLERK_SECRET_KEY to .env.local to turn on sign-in."}
        </CardDescription>
      </CardHeader>
      {!isProduction && (
        <CardContent className="text-center text-sm">
          <Link href="/dashboard" className="text-primary hover:underline">
            Open the dashboard as the demo leader
          </Link>
        </CardContent>
      )}
    </Card>
  );
}
