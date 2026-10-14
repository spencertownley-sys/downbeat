"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { bandMembers, bands } from "@/db/schema";
import { and, eq, ilike, ne } from "drizzle-orm";
import { toActionError } from "./helpers";
import { ValidationError, type ActionResult } from "@/lib/action-errors";
import { getCurrentProfile } from "@/lib/auth";
import { isAuthConfigured } from "@/lib/auth-config";
import { generateRecoveryCode, hashRecoveryCode } from "@/lib/recovery";

const NAME_TAKEN =
  "Someone in this band already goes by that name. If that's you, get back in with your recovery code or passkey below, or ask your band leader for a rejoin link. Otherwise, add a last initial.";

function cleanOptional(value: string | undefined, maxLen: number): string | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  if (trimmed.length > maxLen) throw new ValidationError("That's a little long — try trimming it down.");
  return trimmed;
}

/**
 * No login: a member types their name once and gets a new row in this band.
 * The returned token is embedded in their personal link (/a/[slug]/[token]),
 * which is their credential from then on. Typing an existing member's name
 * never returns that member — getting back in takes a recovery code, a
 * passkey, or a rejoin link from the band leader.
 *
 * `recoveryCode` is shown to the member once and only its hash is stored.
 */
export async function joinBand(
  slug: string,
  name: string,
  instrument?: string,
  contact?: string
): Promise<ActionResult<{ token: string; memberName: string; recoveryCode: string }>> {
  try {
    const trimmed = name.trim();
    if (!trimmed) throw new ValidationError("Enter your name to continue.");
    if (trimmed.length > 60) throw new ValidationError("That name's a little long.");
    const cleanInstrument = cleanOptional(instrument, 60);
    const cleanContact = cleanOptional(contact, 120);

    const band = await db.query.bands.findFirst({ where: eq(bands.slug, slug) });
    if (!band) throw new ValidationError("That link doesn't look right — check it and try again.");

    if (await nameTaken(band.id, trimmed)) throw new ValidationError(NAME_TAKEN);

    const recoveryCode = generateRecoveryCode();
    const [member] = await db
      .insert(bandMembers)
      .values({
        bandId: band.id,
        name: trimmed,
        instrument: cleanInstrument,
        contact: cleanContact,
        recoveryCodeHash: hashRecoveryCode(recoveryCode),
      })
      .returning();

    return { ok: true, data: { token: member.memberToken, memberName: member.name, recoveryCode } };
  } catch (err) {
    return toActionError(err);
  }
}

/** Case-insensitive: is `name` used by another member of this band? */
async function nameTaken(bandId: string, name: string, exceptMemberId?: string): Promise<boolean> {
  const existing = await db.query.bandMembers.findFirst({
    where: and(
      eq(bandMembers.bandId, bandId),
      ilike(bandMembers.name, escapeLike(name)),
      exceptMemberId ? ne(bandMembers.id, exceptMemberId) : undefined
    ),
  });
  return !!existing;
}

/** ilike treats % and _ as wildcards; match them literally. */
function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (ch) => `\\${ch}`);
}

/** Lets a member (no account) update their own name/role/contact from their personal link. */
export async function updateMemberProfile(
  slug: string,
  token: string,
  fields: { name: string; instrument?: string; contact?: string }
): Promise<ActionResult> {
  try {
    const trimmed = fields.name.trim();
    if (!trimmed) throw new ValidationError("Enter your name.");
    if (trimmed.length > 60) throw new ValidationError("That name's a little long.");
    const cleanInstrument = cleanOptional(fields.instrument, 60);
    const cleanContact = cleanOptional(fields.contact, 120);

    const band = await db.query.bands.findFirst({ where: eq(bands.slug, slug) });
    if (!band) throw new ValidationError("That link doesn't look right.");

    const member = await db.query.bandMembers.findFirst({
      where: and(eq(bandMembers.memberToken, token), eq(bandMembers.bandId, band.id)),
    });
    if (!member) throw new ValidationError("That link doesn't look right.");
    if (await nameTaken(band.id, trimmed, member.id)) {
      throw new ValidationError("Someone else in this band already goes by that name.");
    }

    await db
      .update(bandMembers)
      .set({
        name: trimmed,
        instrument: cleanInstrument,
        contact: cleanContact,
        lastSeenAt: new Date(),
      })
      .where(eq(bandMembers.id, member.id));

    revalidatePath(`/a/${slug}/${token}`);
    return { ok: true };
  } catch (err) {
    return toActionError(err);
  }
}

/**
 * Links this anonymous member row to the signed-in account, so it shows up
 * on that account's dashboard. Requires Clerk and an active session.
 */
export async function claimMemberRow(slug: string, token: string): Promise<ActionResult> {
  try {
    if (!isAuthConfigured()) {
      throw new ValidationError("Account linking isn't available in this environment.");
    }

    const profile = await getCurrentProfile();
    if (!profile) throw new ValidationError("Sign in first, then try again.");

    const band = await db.query.bands.findFirst({ where: eq(bands.slug, slug) });
    if (!band) throw new ValidationError("That link doesn't look right.");
    const member = await db.query.bandMembers.findFirst({
      where: and(eq(bandMembers.memberToken, token), eq(bandMembers.bandId, band.id)),
    });
    if (!member) throw new ValidationError("That link doesn't look right.");

    await db.update(bandMembers).set({ profileId: profile.id }).where(eq(bandMembers.id, member.id));

    revalidatePath(`/a/${slug}/${token}`);
    return { ok: true };
  } catch (err) {
    return toActionError(err);
  }
}
