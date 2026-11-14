"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { rotateMemberToken } from "@/app/actions/members";
import { rememberMember } from "@/components/recovery/member-storage";
import { CopyLinkButton } from "@/components/shared/CopyLinkButton";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";

export function PersonalLinkCard({
  slug,
  token,
  name,
}: {
  slug: string;
  token: string;
  name: string;
}) {
  // Keep localStorage in sync even if they landed here straight from a saved
  // or shared link rather than the join form — so /join/[slug] on this
  // device recognizes them next time too.
  useEffect(() => {
    try {
      localStorage.setItem(`downbeat:member:${slug}`, JSON.stringify({ token, name }));
    } catch {
      // localStorage unavailable — the URL itself still works fine.
    }
  }, [slug, token, name]);

  const router = useRouter();
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);

  async function handleNewLink() {
    if (!window.confirm("Get a new personal link? Your current link stops working everywhere, including on your other devices.")) {
      return;
    }
    setBusy(true);
    const result = await rotateMemberToken(slug, token);
    if (!result.ok || !result.data) {
      setBusy(false);
      toast({ title: "Couldn't make a new link", description: result.ok ? undefined : result.error, variant: "destructive" });
      return;
    }
    rememberMember(slug, result.data.token, name);
    toast({ title: "New link ready", description: "Your old link no longer works. Save this one." });
    router.replace(`/a/${slug}/${result.data.token}`);
  }

  return (
    <section className="rounded-xl border bg-card p-4 sm:p-6">
      <h2 className="mb-1 font-semibold">Your link</h2>
      <p className="mb-4 text-sm text-muted-foreground">
        Bookmark this or text it to yourself — it always brings you back here to update your
        availability.
      </p>
      <CopyLinkButton path={`/a/${slug}/${token}`} />
      <p className="mt-4 text-xs text-muted-foreground">
        Shared this link by mistake? Get a new one and the old one stops working.
      </p>
      <Button type="button" size="sm" variant="ghost" className="mt-1 h-7 px-2 text-xs" onClick={handleNewLink} disabled={busy}>
        {busy ? "Making a new link..." : "Get a new personal link"}
      </Button>
    </section>
  );
}
