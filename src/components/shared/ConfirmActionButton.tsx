"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { ActionResult } from "@/lib/action-errors";
import { forgetMemberIfToken } from "@/components/recovery/member-storage";
import { Button, type ButtonProps } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

/**
 * A button that asks before running a destructive Server Action (pass it
 * pre-bound, e.g. `deleteBand.bind(null, band.id)`), then goes to
 * `redirectTo` or refreshes the page.
 */
export function ConfirmActionButton({
  action,
  label,
  title,
  description,
  confirmLabel,
  pendingLabel = "Working...",
  redirectTo,
  hardRedirect = false,
  forgetMember,
  variant = "outline",
  size = "sm",
  className,
}: {
  action: () => Promise<ActionResult>;
  label: React.ReactNode;
  title: string;
  description: string;
  confirmLabel: string;
  pendingLabel?: string;
  redirectTo?: string;
  /** Full page load instead of client navigation, e.g. after the session itself is gone. */
  hardRedirect?: boolean;
  /** Forget this device's remembered member link once it no longer works. */
  forgetMember?: { slug: string; token: string };
  variant?: ButtonProps["variant"];
  size?: ButtonProps["size"];
  className?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function confirm() {
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (!result.ok) {
        setError(result.error);
        return;
      }
      if (forgetMember) forgetMemberIfToken(forgetMember.slug, forgetMember.token);
      setOpen(false);
      if (redirectTo && hardRedirect) window.location.assign(redirectTo);
      else if (redirectTo) router.push(redirectTo);
      else router.refresh();
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setError(null);
      }}
    >
      <DialogTrigger asChild>
        <Button type="button" variant={variant} size={size} className={className}>
          {label}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={pending}>
            Cancel
          </Button>
          <Button type="button" variant="destructive" onClick={confirm} disabled={pending}>
            {pending ? pendingLabel : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
