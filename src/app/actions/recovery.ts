"use server";

import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { bandMembers, bands } from "@/db/schema";
import { requireProfile, toActionError } from "./helpers";
import { ValidationError, type ActionResult } from "@/lib/action-errors";
import {
  createRejoinLink,
  issueRecoveryCode,
  recoverWithCode,
  redeemRejoinLink,
  type Reclaimed,
  type RejoinLinkProblem,
} from "@/lib/recovery";

const LINK_PROBLEMS: Record<RejoinLinkProblem, string> = {
  invalid: "This rejoin link isn't valid. It may have been replaced by a newer one.",
  expired: "This rejoin link has expired. Ask your band leader for a new one.",
  used: "This rejoin link has already been used. Ask your band leader for a new one.",
};

/** A member on a new device enters their recovery code to get their spot back. */
export async function recoverMember(slug: string, code: string): Promise<ActionResult<Reclaimed>> {
  try {
    const reclaimed = await recoverWithCode(slug, code);
    if (!reclaimed) {
      throw new ValidationError("That code doesn't match anyone in this band. Check it and try again.");
    }
    return { ok: true, data: reclaimed };
  } catch (err) {
    return toActionError(err);
  }
}

/** Spends a rejoin link (from the button on /rejoin/[token], never on page load). */
export async function spendRejoinLink(token: string): Promise<ActionResult<Reclaimed>> {
  try {
    const result = await redeemRejoinLink(token);
    if (!result.ok) throw new ValidationError(LINK_PROBLEMS[result.reason]);
    const { slug, token: newToken, memberName, recoveryCode } = result;
    return { ok: true, data: { slug, token: newToken, memberName, recoveryCode } };
  } catch (err) {
    return toActionError(err);
  }
}

/** Band leader: a single-use link, valid 24h, that moves `memberId` onto a new device. */
export async function createMemberRejoinLink(
  bandId: string,
  memberId: string
): Promise<ActionResult<{ path: string; expiresAt: string }>> {
  try {
    const profile = await requireProfile();
    const [member] = await db
      .select({ id: bandMembers.id })
      .from(bandMembers)
      .innerJoin(bands, eq(bands.id, bandMembers.bandId))
      .where(and(eq(bandMembers.id, memberId), eq(bands.id, bandId), eq(bands.leaderId, profile.id)))
      .limit(1);
    if (!member) throw new ValidationError("Member not found.");

    const { token, expiresAt } = await createRejoinLink(member.id);
    return { ok: true, data: { path: `/rejoin/${token}`, expiresAt: expiresAt.toISOString() } };
  } catch (err) {
    return toActionError(err);
  }
}

/** From their personal page, a member makes a new recovery code (replacing any old one). */
export async function newRecoveryCode(
  slug: string,
  token: string
): Promise<ActionResult<{ recoveryCode: string }>> {
  try {
    const [member] = await db
      .select({ id: bandMembers.id })
      .from(bandMembers)
      .innerJoin(bands, eq(bands.id, bandMembers.bandId))
      .where(and(eq(bands.slug, slug), eq(bandMembers.memberToken, token)))
      .limit(1);
    if (!member) throw new ValidationError("That link doesn't look right.");

    return { ok: true, data: { recoveryCode: await issueRecoveryCode(member.id) } };
  } catch (err) {
    return toActionError(err);
  }
}
