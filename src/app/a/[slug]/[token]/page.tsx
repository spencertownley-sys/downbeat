import Link from "next/link";
import { getMemberByToken } from "@/db/queries/members";
import { getBandBySlug } from "@/db/queries/bands";
import { getCurrentProfile } from "@/lib/auth";
import { isAuthConfigured } from "@/lib/auth-config";
import { getDateColumns, getTimeSlots, describeSchedule, describeEvent } from "@/lib/band-settings";
import { Logo } from "@/components/brand/Logo";
import { AvailabilityEditor } from "@/components/availability/AvailabilityEditor";
import { PersonalLinkCard } from "@/components/availability/PersonalLinkCard";
import { AccountClaimCard } from "@/components/availability/AccountClaimCard";
import { ProfileEditor } from "@/components/availability/ProfileEditor";
import { ForgetStaleLink } from "@/components/recovery/ForgetStaleLink";
import { IosHomeScreenPrompt } from "@/components/recovery/IosHomeScreenPrompt";
import { KeepAccessCard } from "@/components/recovery/KeepAccessCard";
import { PasskeyPrompt } from "@/components/recovery/PasskeyPrompt";
import { countPasskeys } from "@/lib/passkeys";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

export default async function AvailabilityPage({
  params,
}: {
  params: Promise<{ slug: string; token: string }>;
}) {
  const { slug, token } = await params;
  const context = await getMemberByToken(slug, token);

  if (!context) {
    const band = await getBandBySlug(slug);
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background p-4 text-center">
        <div className="mb-6">
          <Logo />
        </div>
        <ForgetStaleLink slug={slug} token={token} />
        <h1 className="text-xl font-semibold">That link doesn&apos;t work anymore</h1>
        <p className="mt-2 max-w-sm text-muted-foreground">
          {band
            ? "Your personal link may have been replaced — for example, if you got back in on another device. Use your recovery code or passkey on the invite page, or ask your band leader for a rejoin link."
            : "This event may have been removed."}
        </p>
        {band && (
          <Button asChild className="mt-6">
            <Link href={`/join/${slug}`}>Go to the {band.name} invite page</Link>
          </Button>
        )}
      </div>
    );
  }

  const { band, member } = context;
  const authConfigured = isAuthConfigured();
  const profile = authConfigured ? await getCurrentProfile() : null;
  const passkeyCount = await countPasskeys(member.id);

  const dateColumns = getDateColumns(band, band.dayLabels);
  const timeSlots = getTimeSlots(band);
  const schedule = describeSchedule(band);
  const location = describeEvent(band);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container flex h-16 items-center justify-between">
          <Logo />
          <div className="text-right text-sm">
            <p className="font-medium">{band.name}</p>
            <p className="text-xs text-muted-foreground">Hi, {member.name}</p>
          </div>
        </div>
      </header>
      <main className="container max-w-3xl py-10">
        <IosHomeScreenPrompt />
        {passkeyCount === 0 && (
          <PasskeyPrompt slug={slug} token={token} memberId={member.id} bandName={band.name} />
        )}
        <h1 className="text-2xl font-bold tracking-tight">{band.name}</h1>
        {band.description && <p className="mt-1 text-muted-foreground">{band.description}</p>}
        <p className="mt-2 text-sm text-muted-foreground">
          {schedule}
          {location ? ` · ${location}` : ""}
        </p>

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <PersonalLinkCard slug={slug} token={token} name={member.name} />
          <AccountClaimCard
            slug={slug}
            token={token}
            isLinked={!!member.profileId}
            isLoggedIn={!!profile}
            authConfigured={authConfigured}
          />
        </div>

        <div className="mt-6">
          <KeepAccessCard
            slug={slug}
            token={token}
            hasRecoveryCode={!!member.recoveryCodeHash}
            passkeyCount={passkeyCount}
          />
        </div>

        <section className="mt-6 rounded-xl border bg-card p-4 sm:p-6">
          <h2 className="mb-4 font-semibold">About you</h2>
          <ProfileEditor
            slug={slug}
            token={token}
            name={member.name}
            instrument={member.instrument}
            contact={member.contact}
          />
        </section>

        <AvailabilityEditor
          slug={slug}
          token={token}
          dateColumns={dateColumns}
          timeSlots={timeSlots}
          grid={member.grid}
        />
      </main>
    </div>
  );
}
