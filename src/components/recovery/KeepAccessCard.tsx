"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { browserSupportsWebAuthn } from "@simplewebauthn/browser";
import { CheckCircle2, Fingerprint, KeyRound } from "lucide-react";
import { newRecoveryCode } from "@/app/actions/recovery";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { RecoveryCodeNotice } from "@/components/recovery/RecoveryCodeNotice";
import { createPasskey } from "@/components/recovery/passkey-client";

/** Ways back in if this device is lost: a passkey and a recovery code. */
export function KeepAccessCard({
  slug,
  token,
  hasRecoveryCode,
  passkeyCount,
}: {
  slug: string;
  token: string;
  hasRecoveryCode: boolean;
  passkeyCount: number;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [canUsePasskey, setCanUsePasskey] = useState(false);
  const [busy, setBusy] = useState<"passkey" | "code" | null>(null);
  const [code, setCode] = useState<string | null>(null);

  useEffect(() => setCanUsePasskey(browserSupportsWebAuthn()), []);

  async function handlePasskey() {
    setBusy("passkey");
    const result = await createPasskey(slug, token);
    setBusy(null);
    if (!result.ok) {
      toast({ title: "Passkey not saved", description: result.error, variant: "destructive" });
      return;
    }
    toast({ title: "Passkey saved", description: "Use it on the invite page to get back in on any device." });
    router.refresh();
  }

  async function handleCode() {
    if (hasRecoveryCode && !code && !window.confirm("Make a new recovery code? Your old one will stop working.")) {
      return;
    }
    setBusy("code");
    const result = await newRecoveryCode(slug, token);
    setBusy(null);
    if (!result.ok || !result.data) {
      toast({ title: "Couldn't make a code", description: result.ok ? undefined : result.error, variant: "destructive" });
      return;
    }
    setCode(result.data.recoveryCode);
    router.refresh();
  }

  return (
    <section className="rounded-xl border bg-card p-4 sm:p-6">
      <h2 className="mb-1 font-semibold">Keep your spot</h2>
      <p className="mb-4 text-sm text-muted-foreground">
        If you lose this device or your browser clears its data, these get you back in.
      </p>

      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-start gap-2 text-sm">
            <Fingerprint className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            {passkeyCount > 0 ? (
              <span>
                <span className="font-medium">Passkey saved</span>
                <span className="text-muted-foreground"> — sign in with it on the invite page.</span>
              </span>
            ) : (
              <span>
                <span className="font-medium">Passkey</span>
                <span className="text-muted-foreground"> — Face ID, Touch ID or your screen lock.</span>
              </span>
            )}
          </div>
          {canUsePasskey ? (
            <Button type="button" size="sm" variant={passkeyCount > 0 ? "outline" : "default"} onClick={handlePasskey} disabled={busy !== null}>
              {busy === "passkey" ? "Waiting for your device…" : passkeyCount > 0 ? "Add another device" : "Save a passkey"}
            </Button>
          ) : (
            <span className="text-xs text-muted-foreground">Not supported in this browser</span>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-start gap-2 text-sm">
            {hasRecoveryCode ? (
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
            ) : (
              <KeyRound className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            )}
            <span>
              <span className="font-medium">Recovery code</span>
              <span className="text-muted-foreground">
                {hasRecoveryCode ? " — you have one. Lost it? Make a new one." : " — you don't have one yet."}
              </span>
            </span>
          </div>
          <Button type="button" size="sm" variant="outline" onClick={handleCode} disabled={busy !== null}>
            {busy === "code" ? "Making…" : hasRecoveryCode ? "Make a new code" : "Get a recovery code"}
          </Button>
        </div>

        {code && <RecoveryCodeNotice code={code} />}
      </div>
    </section>
  );
}
