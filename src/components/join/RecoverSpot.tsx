"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { browserSupportsWebAuthn } from "@simplewebauthn/browser";
import { Fingerprint } from "lucide-react";
import { recoverMember } from "@/app/actions/recovery";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RecoveryCodeNotice } from "@/components/recovery/RecoveryCodeNotice";
import { rememberMember } from "@/components/recovery/member-storage";
import { signInWithSavedPasskey } from "@/components/recovery/passkey-client";

/** "Already joined on another device?" — passkey sign-in or a recovery code. */
export function RecoverSpot({ slug, open, onOpenChange }: { slug: string; open: boolean; onOpenChange: (open: boolean) => void }) {
  const router = useRouter();
  const [canUsePasskey, setCanUsePasskey] = useState(false);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<"passkey" | "code" | null>(null);
  const [recovered, setRecovered] = useState<{ token: string; recoveryCode: string } | null>(null);

  useEffect(() => setCanUsePasskey(browserSupportsWebAuthn()), []);

  async function handlePasskey() {
    setError(null);
    setBusy("passkey");
    const result = await signInWithSavedPasskey(slug);
    setBusy(null);
    if (!result.ok || !result.data) {
      setError(result.ok ? "Something went wrong." : result.error);
      return;
    }
    rememberMember(slug, result.data.token, result.data.memberName);
    router.push(`/a/${slug}/${result.data.token}`);
  }

  async function handleCode(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy("code");
    const result = await recoverMember(slug, code);
    setBusy(null);
    if (!result.ok || !result.data) {
      setError(result.ok ? "Something went wrong." : result.error);
      return;
    }
    rememberMember(slug, result.data.token, result.data.memberName);
    setRecovered({ token: result.data.token, recoveryCode: result.data.recoveryCode });
  }

  if (recovered) {
    return (
      <div className="space-y-4">
        <p className="text-sm">
          You&apos;re back in. Your old code no longer works — here&apos;s your new one.
        </p>
        <RecoveryCodeNotice code={recovered.recoveryCode} />
        <Button className="w-full" onClick={() => router.push(`/a/${slug}/${recovered.token}`)}>
          I saved it — continue
        </Button>
      </div>
    );
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => onOpenChange(true)}
        className="w-full text-center text-xs text-muted-foreground underline underline-offset-2"
      >
        Already joined on another device? Get back in
      </button>
    );
  }

  return (
    <div className="space-y-4 rounded-lg border p-4">
      <p className="text-sm font-medium">Get back to your spot</p>
      {canUsePasskey && (
        <Button type="button" variant="outline" className="w-full" onClick={handlePasskey} disabled={busy !== null}>
          <Fingerprint className="h-4 w-4" />
          {busy === "passkey" ? "Waiting for your device…" : "Sign in with a passkey"}
        </Button>
      )}
      <form onSubmit={handleCode} className="space-y-2">
        <Label htmlFor="recovery-code">Recovery code</Label>
        <div className="flex gap-2">
          <Input
            id="recovery-code"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="XXXX-XXXX-XXXX"
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            className="font-mono uppercase tracking-wider"
          />
          <Button type="submit" disabled={busy !== null || code.trim().length === 0}>
            {busy === "code" ? "Checking…" : "Recover"}
          </Button>
        </div>
      </form>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <p className="text-xs text-muted-foreground">
        No code or passkey? Ask your band leader to send you a rejoin link.
      </p>
    </div>
  );
}
