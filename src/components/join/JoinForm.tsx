"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { joinBand } from "@/app/actions/members";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RecoverSpot } from "@/components/join/RecoverSpot";
import { RecoveryCodeNotice } from "@/components/recovery/RecoveryCodeNotice";
import { recallMember, rememberMember } from "@/components/recovery/member-storage";

export function JoinForm({ slug }: { slug: string }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [instrument, setInstrument] = useState("");
  const [contact, setContact] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [returning, setReturning] = useState<{ token: string; name: string } | null>(null);
  const [joined, setJoined] = useState<{ token: string; recoveryCode: string } | null>(null);
  const [recoverOpen, setRecoverOpen] = useState(false);

  useEffect(() => {
    setReturning(recallMember(slug));
  }, [slug]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const result = await joinBand(slug, name, instrument, contact);
    setLoading(false);
    if (!result.ok || !result.data) {
      setError(!result.ok ? result.error : "Something went wrong. Please try again.");
      if (!result.ok && /already goes by that name/.test(result.error)) setRecoverOpen(true);
      return;
    }
    rememberMember(slug, result.data.token, result.data.memberName);
    setJoined({ token: result.data.token, recoveryCode: result.data.recoveryCode });
  }

  if (joined) {
    return (
      <div className="space-y-4">
        <p className="text-sm">You&apos;re in! One quick thing before you mark your availability:</p>
        <RecoveryCodeNotice code={joined.recoveryCode} />
        <Button className="w-full" onClick={() => router.push(`/a/${slug}/${joined.token}`)}>
          I saved it — continue
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {returning && (
        <div className="rounded-lg border bg-accent p-4 text-center">
          <p className="text-sm text-accent-foreground">
            Welcome back, <span className="font-semibold">{returning.name}</span>.
          </p>
          <Button asChild className="mt-3 w-full">
            <Link href={`/a/${slug}/${returning.token}`}>Continue to your availability</Link>
          </Button>
          <button
            type="button"
            onClick={() => setReturning(null)}
            className="mt-2 text-xs text-muted-foreground underline underline-offset-2"
          >
            Not you? Enter a different name
          </button>
        </div>
      )}

      {!returning && (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Your name</Label>
            <Input
              id="name"
              autoFocus
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Alex"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="instrument">
              Role / instrument <span className="font-normal text-muted-foreground">(optional)</span>
            </Label>
            <Input
              id="instrument"
              value={instrument}
              onChange={(e) => setInstrument(e.target.value)}
              placeholder="Guitar, vocals, manager…"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="contact">
              Phone or email <span className="font-normal text-muted-foreground">(optional)</span>
            </Label>
            <Input
              id="contact"
              value={contact}
              onChange={(e) => setContact(e.target.value)}
              placeholder="So the band can reach you"
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "One sec…" : "Continue"}
          </Button>
        </form>
      )}

      <RecoverSpot slug={slug} open={recoverOpen} onOpenChange={setRecoverOpen} />
    </div>
  );
}
