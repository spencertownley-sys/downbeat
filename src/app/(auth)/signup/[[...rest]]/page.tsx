import { SignUp } from "@clerk/nextjs";
import { AuthUnavailable } from "@/components/auth/AuthUnavailable";
import { isAuthConfigured } from "@/lib/auth-config";

export const dynamic = "force-dynamic";

export default function SignupPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background p-4">
      {isAuthConfigured() ? (
        <SignUp path="/signup" signInUrl="/login" fallbackRedirectUrl="/dashboard" />
      ) : (
        <AuthUnavailable />
      )}
      <p className="max-w-sm text-center text-xs text-muted-foreground">
        Only band leaders need an account — your bandmates just get a link.
      </p>
    </div>
  );
}
