"use client";

import { useState } from "react";
import { Check, Copy, KeyRound } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Shows a recovery code once, with a copy button. The server never shows it again. */
export function RecoveryCodeNotice({ code, note }: { code: string; note?: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard unavailable — the code is selectable.
    }
  }

  return (
    <div className="rounded-lg border border-primary/30 bg-primary/5 p-4">
      <p className="flex items-center gap-1.5 text-sm font-semibold">
        <KeyRound className="h-4 w-4 text-primary" />
        Your recovery code
      </p>
      <div className="mt-3 flex items-center gap-2">
        <code className="flex-1 select-all rounded-md border bg-card px-3 py-2 text-center font-mono text-lg font-semibold tracking-widest">
          {code}
        </code>
        <Button type="button" variant="outline" size="sm" onClick={copy}>
          {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
          {copied ? "Copied" : "Copy"}
        </Button>
      </div>
      <p className="mt-3 text-xs text-muted-foreground">
        {note ??
          "Save this somewhere safe, like your notes app or password manager. If you lose this device, enter it on the band's invite page to get your spot back. We won't show it again."}
      </p>
    </div>
  );
}
