"use client";

import { useState } from "react";
import { Link2 } from "lucide-react";
import { createMemberRejoinLink } from "@/app/actions/recovery";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CopyLinkButton } from "@/components/shared/CopyLinkButton";

/** Band leader: make a one-time link that gets a member back in on a new device. */
export function RejoinLinkButton({ bandId, memberId, memberName }: { bandId: string; memberId: string; memberName: string }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [path, setPath] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function generate() {
    setBusy(true);
    setError(null);
    const result = await createMemberRejoinLink(bandId, memberId);
    setBusy(false);
    if (!result.ok || !result.data) {
      setError(result.ok ? "Something went wrong." : result.error);
      return;
    }
    setPath(result.data.path);
  }

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setPath(null);
      }}
    >
      <PopoverTrigger asChild>
        <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-xs">
          <Link2 className="h-3.5 w-3.5" />
          Rejoin link
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 space-y-3" align="end">
        <p className="text-sm font-semibold">Rejoin link for {memberName}</p>
        {path ? (
          <>
            <CopyLinkButton path={path} />
            <p className="text-xs text-muted-foreground">
              Send this to {memberName} only. It works once and expires in 24 hours. Opening it moves
              them to their new device, and their old link stops working.
            </p>
          </>
        ) : (
          <>
            <p className="text-xs text-muted-foreground">
              Lost their link and recovery code? This makes a one-time link that gets them back to
              their spot. Making a new link cancels any earlier one.
            </p>
            <Button type="button" size="sm" className="w-full" onClick={generate} disabled={busy}>
              {busy ? "Making link…" : "Make a rejoin link"}
            </Button>
          </>
        )}
        {error && <p className="text-xs text-destructive">{error}</p>}
      </PopoverContent>
    </Popover>
  );
}
