"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { spendRejoinLink } from "@/app/actions/recovery";
import { Button } from "@/components/ui/button";
import { RecoveryCodeNotice } from "@/components/recovery/RecoveryCodeNotice";
import { rememberMember } from "@/components/recovery/member-storage";

/**
 * The rejoin link is only spent when the member presses the button — never
 * on page load — so link previews in chat apps can't burn it.
 */
export function RejoinConfirm({ token, memberName }: { token: string; memberName: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ slug: string; token: string; recoveryCode: string } | null>(null);

  async function handleContinue() {
    setBusy(true);
    setError(null);
    const result = await spendRejoinLink(token);
    setBusy(false);
    if (!result.ok || !result.data) {
      setError(result.ok ? "Something went wrong." : result.error);
      return;
    }
    rememberMember(result.data.slug, result.data.token, result.data.memberName);
    setDone({ slug: result.data.slug, token: result.data.token, recoveryCode: result.data.recoveryCode });
  }

  if (done) {
    return (
      <div className="space-y-4 text-left">
        <p className="text-sm">
          You&apos;re back in on this device. Your old link and old recovery code no longer work — here&apos;s
          your new code.
        </p>
        <RecoveryCodeNotice code={done.recoveryCode} />
        <Button className="w-full" onClick={() => router.push(`/a/${done.slug}/${done.token}`)}>
          I saved it — continue
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <Button className="w-full" onClick={handleContinue} disabled={busy}>
        {busy ? "One sec…" : `Continue as ${memberName}`}
      </Button>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <p className="text-xs text-muted-foreground">
        This moves you to this device. Your old link will stop working.
      </p>
    </div>
  );
}
