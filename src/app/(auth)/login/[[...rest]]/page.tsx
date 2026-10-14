import { SignIn } from "@clerk/nextjs";
import { AuthUnavailable } from "@/components/auth/AuthUnavailable";
import { isAuthConfigured } from "@/lib/auth-config";

export const dynamic = "force-dynamic";

export default function LoginPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background p-4">
      {isAuthConfigured() ? (
        <SignIn path="/login" signUpUrl="/signup" fallbackRedirectUrl="/dashboard" />
      ) : (
        <AuthUnavailable />
      )}
      <p className="max-w-sm text-center text-xs text-muted-foreground">
        Just here to enter your availability? You don&apos;t need an account — use the link your
        band leader sent you.
      </p>
    </div>
  );
}
