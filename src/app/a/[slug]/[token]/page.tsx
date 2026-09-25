import Link from "next/link";
import { getMemberByToken } from "@/db/queries/members";
import { getBandBySlug } from "@/db/queries/bands";
import { Logo } from "@/components/brand/Logo";
import { AvailabilityEditor } from "@/components/availability/AvailabilityEditor";
import { PersonalLinkCard } from "@/components/availability/PersonalLinkCard";
import { Button } from "@/components/ui/button";
import { describeEvent, describeSchedule } from "@/lib/band-settings";
import { MapPin } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function AvailabilityPage({
  params,
}: {
  params: Promise<{ slug: string; token: string }>;
}) {
  const { slug, token } = await params;
  const context = await getMemberByToken(slug, token);

  if (!context) {
    // The token doesn't match anything — a stale/mistyped link. Point them
    // back at the join page rather than a dead-end 404; entering the same
    // name there reconnects them to their existing availability.
    const band = await getBandBySlug(slug);
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background p-8 text-center">
        <Logo />
        <div className="max-w-sm space-y-2">
          <p className="font-semibold">That link doesn&apos;t work anymore</p>
          <p className="text-sm text-muted-foreground">
            {band
              ? "Enter your name again on the join page and we'll take you right back to your availability."
              : "This band's link may have changed. Ask whoever invited you for a fresh one."}
          </p>
        </div>
        {band && (
          <Button asChild>
            <Link href={`/join/${slug}`}>Go to {band.name}</Link>
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container flex h-16 items-center justify-between">
          <Logo />
          <div className="text-right text-sm">
            <p className="font-medium">{context.bandName}</p>
            <p className="text-xs text-muted-foreground">Hi, {context.member.name}</p>
          </div>
        </div>
      </header>
      <main className="container max-w-3xl py-10">
        <h1 className="text-2xl font-bold tracking-tight">Your availability</h1>
        <p className="mt-1 text-muted-foreground">
          Tap the squares below for how your week usually looks. Changes save automatically.
        </p>
        {describeEvent(context) && (
          <p className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-accent px-3 py-1 text-sm font-medium text-accent-foreground">
            <MapPin className="h-3.5 w-3.5" />
            {describeEvent(context)}
          </p>
        )}
        <p className="mt-2 text-sm text-muted-foreground">
          {context.bandName} is checking:{" "}
          <span className="font-medium text-foreground">{describeSchedule(context)}</span>
        </p>

        <div className="mt-8">
          <PersonalLinkCard slug={slug} token={token} name={context.member.name} />
        </div>

        <AvailabilityEditor
          slug={slug}
          token={token}
          member={context.member}
          activeDays={context.activeDays}
          useTimeBlocks={context.useTimeBlocks}
          activeTimeBlocks={context.activeTimeBlocks}
          startDate={context.startDate}
          endDate={context.endDate}
        />
      </main>
    </div>
  );
}
