import { notFound, redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth";
import { getBandSettingsForLeader } from "@/db/queries/bands";
import { BandForm } from "@/components/dashboard/BandForm";
import { ConfirmActionButton } from "@/components/shared/ConfirmActionButton";
import { deleteBand } from "@/app/actions/bands";
import type { BandSettingsInput } from "@/app/actions/bands";
import type { ScheduleType, LocationType } from "@/lib/constants";

export const dynamic = "force-dynamic";

export default async function EditBandPage({ params }: { params: Promise<{ bandId: string }> }) {
  const { bandId } = await params;
  const profile = await getCurrentProfile();
  if (!profile) redirect(`/login?next=/dashboard/bands/${bandId}/edit`);

  const band = await getBandSettingsForLeader(bandId, profile.id);
  if (!band) notFound();

  const initialValues: BandSettingsInput = {
    name: band.name,
    description: band.description ?? "",
    scheduleType: band.scheduleType as ScheduleType,
    startDate: band.startDate,
    endDate: band.endDate,
    activeDays: band.activeDays ?? [0, 1, 2, 3, 4, 5, 6],
    timeSlotStart: band.timeSlotStart,
    timeSlotEnd: band.timeSlotEnd,
    timeSlotMinutes: band.timeSlotMinutes,
    eventDurationMinutes: band.eventDurationMinutes,
    location: band.location ?? "",
    locationType: band.locationType as LocationType,
    timezone: band.timezone,
  };

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-2xl font-bold tracking-tight">Edit {band.name}</h1>
      <p className="mt-1 text-muted-foreground">Update the details of your event.</p>
      <div className="mt-8">
        <BandForm mode="edit" bandId={band.id} initialValues={initialValues} />
      </div>
      <section className="mt-12 rounded-xl border border-destructive/40 p-4 sm:p-6">
        <h2 className="font-semibold">Delete this event</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Deletes {band.name}, its invite link, every member and all their availability. This can&apos;t
          be undone.
        </p>
        <ConfirmActionButton
          action={deleteBand.bind(null, band.id)}
          label="Delete event"
          variant="destructive"
          className="mt-4"
          title={`Delete ${band.name}?`}
          description="The invite link and every member's personal link stop working, and all availability is deleted for good."
          confirmLabel="Delete event"
          pendingLabel="Deleting..."
          redirectTo="/dashboard"
        />
      </section>
    </div>
  );
}
