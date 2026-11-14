"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { bands, bandDayLabels } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { generateSlug } from "@/lib/slug";
import { requireProfile, toActionError } from "./helpers";
import { ValidationError, type ActionResult } from "@/lib/action-errors";
import { validateSettings, type BandSettingsInput } from "@/lib/band-validation";
import { LIMITS, dayLabel, labelDates } from "@/lib/schemas";
import type { Band } from "@/types";

export type { BandSettingsInput };

function toBandValues(input: BandSettingsInput) {
  return {
    name: input.name.trim(),
    description: input.description?.trim() || null,
    scheduleType: input.scheduleType,
    startDate: input.startDate,
    endDate: input.endDate,
    activeDays: input.activeDays,
    timeSlotStart: input.timeSlotStart,
    timeSlotEnd: input.timeSlotEnd,
    timeSlotMinutes: input.timeSlotMinutes,
    eventDurationMinutes: input.eventDurationMinutes,
    location: input.location?.trim() || null,
    locationType: input.locationType,
    timezone: input.timezone,
  };
}

export async function createBand(input: BandSettingsInput): Promise<ActionResult<Band>> {
  try {
    const profile = await requireProfile();
    const errors = validateSettings(input);
    if (errors.length > 0) throw new ValidationError(errors[0]);

    // Practically never collides, but guard against it anyway.
    let slug = generateSlug();
    for (let attempt = 0; attempt < 5; attempt++) {
      const existing = await db.query.bands.findFirst({ where: eq(bands.slug, slug) });
      if (!existing) break;
      slug = generateSlug();
    }

    const [band] = await db
      .insert(bands)
      .values({ ...toBandValues(input), slug, leaderId: profile.id })
      .returning();

    revalidatePath("/dashboard");
    return { ok: true, data: band };
  } catch (err) {
    return toActionError(err);
  }
}

export async function updateBandSettings(
  bandId: string,
  input: BandSettingsInput
): Promise<ActionResult<Band>> {
  try {
    const profile = await requireProfile();
    const errors = validateSettings(input);
    if (errors.length > 0) throw new ValidationError(errors[0]);

    const [updated] = await db
      .update(bands)
      .set(toBandValues(input))
      .where(and(eq(bands.id, bandId), eq(bands.leaderId, profile.id)))
      .returning();
    if (!updated) throw new ValidationError("Event not found.");

    revalidatePath("/dashboard");
    revalidatePath(`/dashboard/bands/${bandId}`);
    return { ok: true, data: updated };
  } catch (err) {
    return toActionError(err);
  }
}

export async function deleteBand(bandId: string): Promise<ActionResult> {
  try {
    const profile = await requireProfile();
    await db.delete(bands).where(and(eq(bands.id, bandId), eq(bands.leaderId, profile.id)));
    revalidatePath("/dashboard");
    return { ok: true };
  } catch (err) {
    return toActionError(err);
  }
}

async function requireLeaderBand(bandId: string) {
  const profile = await requireProfile();
  const band = await db.query.bands.findFirst({
    where: and(eq(bands.id, bandId), eq(bands.leaderId, profile.id)),
  });
  if (!band) throw new ValidationError("Event not found.");
  return band;
}

/** Upserts a `bandDayLabels` row per date — supports labeling many days at once. */
export async function addDayLabel(
  bandId: string,
  dates: string[],
  label: string
): Promise<ActionResult> {
  try {
    const band = await requireLeaderBand(bandId);
    if (typeof label !== "string" || !label.trim()) throw new ValidationError("Give the label some text.");
    const parsedLabel = dayLabel.safeParse(label);
    if (!parsedLabel.success) {
      throw new ValidationError(`Keep the label under ${LIMITS.dayLabel} characters.`);
    }
    const trimmed = parsedLabel.data;
    if (!Array.isArray(dates) || dates.length === 0) throw new ValidationError("Pick at least one date.");
    const parsedDates = labelDates.safeParse(dates);
    if (!parsedDates.success) throw new ValidationError("Invalid date.");
    if (dates.some((d) => d < band.startDate || d > band.endDate)) {
      throw new ValidationError("Pick dates inside the event's date range.");
    }

    await db
      .insert(bandDayLabels)
      .values(dates.map((date) => ({ bandId: band.id, date, label: trimmed })))
      .onConflictDoUpdate({
        target: [bandDayLabels.bandId, bandDayLabels.date],
        set: { label: trimmed },
      });

    revalidatePath(`/dashboard/bands/${bandId}`);
    return { ok: true };
  } catch (err) {
    return toActionError(err);
  }
}

export async function removeDayLabel(bandId: string, date: string): Promise<ActionResult> {
  try {
    const band = await requireLeaderBand(bandId);
    await db
      .delete(bandDayLabels)
      .where(and(eq(bandDayLabels.bandId, band.id), eq(bandDayLabels.date, date)));
    revalidatePath(`/dashboard/bands/${bandId}`);
    return { ok: true };
  } catch (err) {
    return toActionError(err);
  }
}
