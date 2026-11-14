"use server";

import { clerkClient } from "@clerk/nextjs/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { bandMembers, bands, profiles } from "@/db/schema";
import { requireProfile, toActionError } from "./helpers";
import type { ActionResult } from "@/lib/action-errors";
import { isAuthConfigured } from "@/lib/auth-config";

/**
 * Deletes the signed-in leader's bands (members, availability and passkeys go
 * with them through the cascade), their profile, and then their Clerk user.
 * The database goes first so a Clerk failure never leaves data behind.
 */
export async function deleteMyAccount(): Promise<ActionResult> {
  try {
    const profile = await requireProfile();
    await db.transaction(async (tx) => {
      await tx.delete(bands).where(eq(bands.leaderId, profile.id));
      await tx.delete(profiles).where(eq(profiles.id, profile.id));
    });
    if (isAuthConfigured() && profile.clerkUserId) {
      const clerk = await clerkClient();
      await clerk.users.deleteUser(profile.clerkUserId);
    }
    return { ok: true };
  } catch (err) {
    return toActionError(err);
  }
}

/**
 * Everything Downbeat holds about the signed-in leader, as JSON: their
 * profile, the bands they run (with members and availability) and any member
 * spots linked to their account. Credentials (member links, recovery code
 * hashes, passkeys) are left out.
 */
export async function exportMyData(): Promise<ActionResult<{ filename: string; json: string }>> {
  try {
    const profile = await requireProfile();
    const availabilityColumns = { date: true, timeSlot: true, status: true, updatedAt: true } as const;
    const memberColumns = { memberToken: false, recoveryCodeHash: false } as const;

    const ledBands = await db.query.bands.findMany({
      where: eq(bands.leaderId, profile.id),
      with: {
        dayLabels: { columns: { date: true, label: true } },
        members: { columns: memberColumns, with: { availability: { columns: availabilityColumns } } },
      },
    });
    const memberships = await db.query.bandMembers.findMany({
      where: eq(bandMembers.profileId, profile.id),
      columns: memberColumns,
      with: {
        band: { columns: { name: true, startDate: true, endDate: true } },
        availability: { columns: availabilityColumns },
      },
    });

    const exportedAt = new Date();
    const json = JSON.stringify(
      { exportedAt: exportedAt.toISOString(), profile, bands: ledBands, memberships },
      null,
      2
    );
    return {
      ok: true,
      data: { filename: `downbeat-export-${exportedAt.toISOString().slice(0, 10)}.json`, json },
    };
  } catch (err) {
    return toActionError(err);
  }
}
