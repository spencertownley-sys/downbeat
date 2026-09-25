"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { bands } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { generateSlug } from "@/lib/slug";
import { requireProfile, toActionError } from "./helpers";
import { ValidationError, type ActionResult } from "@/lib/action-errors";
import { ALL_DAY_BLOCK, TIME_BLOCKS } from "@/lib/constants";
import type { Band } from "@/types";

export async function createBand(name: string): Promise<ActionResult<Band>> {
  try {
    const profile = await requireProfile();
    const trimmed = name.trim();
    if (!trimmed) throw new ValidationError("Give your band a name.");
    if (trimmed.length > 80) throw new ValidationError("That name's a little long.");

    // Practically never collides, but guard against it anyway.
    let slug = generateSlug();
    for (let attempt = 0; attempt < 5; attempt++) {
      const existing = await db.query.bands.findFirst({ where: eq(bands.slug, slug) });
      if (!existing) break;
      slug = generateSlug();
    }

    const [band] = await db
      .insert(bands)
      .values({ name: trimmed, slug, leaderId: profile.id })
      .returning();

    revalidatePath("/dashboard");
    return { ok: true, data: band };
  } catch (err) {
    return toActionError(err);
  }
}

export async function renameBand(bandId: string, name: string): Promise<ActionResult> {
  try {
    const profile = await requireProfile();
    const trimmed = name.trim();
    if (!trimmed) throw new ValidationError("Give your band a name.");

    const [updated] = await db
      .update(bands)
      .set({ name: trimmed })
      .where(and(eq(bands.id, bandId), eq(bands.leaderId, profile.id)))
      .returning();
    if (!updated) throw new ValidationError("Band not found.");

    revalidatePath("/dashboard");
    revalidatePath(`/dashboard/bands/${bandId}`);
    return { ok: true };
  } catch (err) {
    return toActionError(err);
  }
}

export interface BandScheduleInput {
  activeDays: number[];
  useTimeBlocks: boolean;
  activeTimeBlocks: string[];
  startDate: string | null;
  endDate: string | null;
  eventLabel: string | null;
  venue: string | null;
}

function cleanLabel(value: string | null, maxLen: number): string | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  if (trimmed.length > maxLen) throw new ValidationError("That's a little long — try trimming it down.");
  return trimmed;
}

export async function updateBandSchedule(
  bandId: string,
  input: BandScheduleInput
): Promise<ActionResult> {
  try {
    const profile = await requireProfile();

    const activeDays = [...new Set(input.activeDays)].filter((d) => d >= 0 && d <= 6);
    if (activeDays.length === 0) throw new ValidationError("Pick at least one day.");

    const validBlocks = new Set<string>(TIME_BLOCKS.map((b) => b.value));
    const activeTimeBlocks = [...new Set(input.activeTimeBlocks)].filter((b) => validBlocks.has(b));
    if (input.useTimeBlocks && activeTimeBlocks.length === 0) {
      throw new ValidationError("Pick at least one time of day.");
    }

    if (input.startDate && input.endDate && input.startDate > input.endDate) {
      throw new ValidationError("The start date is after the end date.");
    }

    const eventLabel = cleanLabel(input.eventLabel, 80);
    const venue = cleanLabel(input.venue, 100);

    const [updated] = await db
      .update(bands)
      .set({
        activeDays,
        useTimeBlocks: input.useTimeBlocks,
        activeTimeBlocks: input.useTimeBlocks ? activeTimeBlocks : [ALL_DAY_BLOCK.value],
        startDate: input.startDate || null,
        endDate: input.endDate || null,
        eventLabel,
        venue,
      })
      .where(and(eq(bands.id, bandId), eq(bands.leaderId, profile.id)))
      .returning();
    if (!updated) throw new ValidationError("Band not found.");

    revalidatePath(`/dashboard/bands/${bandId}`);
    return { ok: true };
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
