import { getRejoinLinkStatus } from "@/lib/recovery";
import { Logo } from "@/components/brand/Logo";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { RejoinConfirm } from "@/components/join/RejoinConfirm";

export const dynamic = "force-dynamic";

const PROBLEMS = {
  invalid: {
    title: "This rejoin link isn't valid",
    body: "It may have been replaced by a newer link. Ask your band leader to send you a new one.",
  },
  expired: {
    title: "This rejoin link has expired",
    body: "Rejoin links work for 24 hours. Ask your band leader to send you a new one.",
  },
  used: {
    title: "This rejoin link has already been used",
    body: "Each rejoin link works once. If that wasn't you, ask your band leader for a new link.",
  },
} as const;

export default async function RejoinPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  // Read-only: looking at the link doesn't spend it.
  const status = await getRejoinLinkStatus(token);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background p-4">
      <div className="mb-6">
        <Logo />
      </div>
      <Card className="w-full max-w-sm text-center">
        {status.ok ? (
          <>
            <CardHeader>
              <CardTitle className="text-xl">{status.bandName}</CardTitle>
              <CardDescription>Your band leader sent you a link to get back to your spot.</CardDescription>
            </CardHeader>
            <CardContent>
              <RejoinConfirm token={token} memberName={status.memberName} />
            </CardContent>
          </>
        ) : (
          <CardHeader>
            <CardTitle className="text-lg">{PROBLEMS[status.reason].title}</CardTitle>
            <CardDescription>{PROBLEMS[status.reason].body}</CardDescription>
          </CardHeader>
        )}
      </Card>
    </div>
  );
}
