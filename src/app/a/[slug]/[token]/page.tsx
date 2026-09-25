import { notFound } from "next/navigation";
import { getMemberByToken } from "@/db/queries/members";
import { Logo } from "@/components/brand/Logo";
import { AvailabilityEditor } from "@/components/availability/AvailabilityEditor";
import { describeSchedule } from "@/lib/band-settings";

export const dynamic = "force-dynamic";

export default async function AvailabilityPage({
  params,
}: {
  params: Promise<{ slug: string; token: string }>;
}) {
  const { slug, token } = await params;
  const context = await getMemberByToken(slug, token);
  if (!context) notFound();

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
        <p className="mt-1 text-sm text-muted-foreground">
          {context.bandName} is checking:{" "}
          <span className="font-medium text-foreground">{describeSchedule(context)}</span>
        </p>
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
