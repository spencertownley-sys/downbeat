"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { browserSupportsWebAuthn } from "@simplewebauthn/browser";
import { Fingerprint, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { createPasskey } from "@/components/recovery/passkey-client";

function dismissKey(memberId: string) {
  return `downbeat:passkey-prompt-dismissed:${memberId}`;
}

/**
 * Nudges a member to save a passkey for this band. It shows for every band
 * membership that has none — so joining a new band prompts again — until
 * they save one or choose "Not now" for this membership on this device.
 */
export function PasskeyPrompt({
  slug,
  token,
  memberId,
  bandName,
}: {
  slug: string;
  token: string;
  memberId: string;
  bandName: string;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let dismissed = false;
    try {
      dismissed = localStorage.getItem(dismissKey(memberId)) === "1";
    } catch {
      // Storage unavailable — show the prompt.
    }
    setVisible(browserSupportsWebAuthn() && !dismissed);
  }, [memberId]);

  function dismiss() {
    setVisible(false);
    try {
      localStorage.setItem(dismissKey(memberId), "1");
    } catch {
      // Can't remember the choice; it just shows again next time.
    }
  }

  async function save() {
    setBusy(true);
    const result = await createPasskey(slug, token);
    setBusy(false);
    if (!result.ok) {
      toast({ title: "Passkey not saved", description: result.error, variant: "destructive" });
      return;
    }
    setVisible(false);
    toast({ title: "Passkey saved", description: `You can get back into ${bandName} from any device.` });
    router.refresh();
  }

  if (!visible) return null;

  return (
    <div className="relative mb-6 flex flex-col gap-3 rounded-xl border border-primary/30 bg-primary/5 p-4 sm:flex-row sm:items-center">
      <Fingerprint className="hidden h-6 w-6 shrink-0 text-primary sm:block" />
      <div className="flex-1 pr-6 text-sm">
        <p className="font-medium">Save a passkey for {bandName}?</p>
        <p className="text-muted-foreground">
          Then Face ID, Touch ID or your screen lock gets you back here on any device — no link to lose.
        </p>
      </div>
      <div className="flex gap-2">
        <Button type="button" size="sm" onClick={save} disabled={busy}>
          {busy ? "Waiting for your device…" : "Save a passkey"}
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={dismiss} disabled={busy}>
          Not now
        </Button>
      </div>
      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss"
        className="absolute right-2 top-2 rounded p-1 text-muted-foreground hover:bg-muted sm:hidden"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
