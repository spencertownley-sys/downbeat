import { createHash, randomBytes, randomInt } from "node:crypto";
import { and, eq, gt, isNull } from "drizzle-orm";
import { db } from "@/db";
import { bandMembers, bands, memberRejoinLinks } from "@/db/schema";

export const REJOIN_LINK_TTL_MS = 24 * 60 * 60 * 1000;

// No 0/O or 1/I, so a code read off a screen can't be mistyped that way.
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const CODE_LENGTH = 12;

export function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

/** e.g. "K7QM-2RXD-HV9P" — 60 bits of randomness. */
export function generateRecoveryCode(): string {
  let raw = "";
  for (let i = 0; i < CODE_LENGTH; i++) raw += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
  return `${raw.slice(0, 4)}-${raw.slice(4, 8)}-${raw.slice(8)}`;
}

/** Accepts the code however it's typed: any case, with or without dashes/spaces. */
export function normalizeRecoveryCode(input: string): string {
  return input.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export function hashRecoveryCode(code: string): string {
  return sha256(normalizeRecoveryCode(code));
}

/** What a member gets back after moving to a new device. The code is shown once. */
export interface Reclaimed {
  slug: string;
  token: string;
  memberName: string;
  recoveryCode: string;
}

/** Replaces the member's recovery code and returns the new one — the only time it's readable. */
export async function issueRecoveryCode(memberId: string): Promise<string> {
  const code = generateRecoveryCode();
  await db
    .update(bandMembers)
    .set({ recoveryCodeHash: hashRecoveryCode(code) })
    .where(eq(bandMembers.id, memberId));
  return code;
}

/**
 * Moves a member onto this device using their recovery code. Their old link
 * and old code stop working, and a new code is issued. The code check and the
 * swap are one UPDATE, so the same code can't be redeemed twice concurrently.
 */
export async function recoverWithCode(slug: string, code: string): Promise<Reclaimed | null> {
  const normalized = normalizeRecoveryCode(code);
  if (normalized.length !== CODE_LENGTH) return null;

  const band = await db.query.bands.findFirst({ where: eq(bands.slug, slug) });
  if (!band) return null;

  const token = crypto.randomUUID();
  const recoveryCode = generateRecoveryCode();
  const [member] = await db
    .update(bandMembers)
    .set({ memberToken: token, recoveryCodeHash: hashRecoveryCode(recoveryCode), lastSeenAt: new Date() })
    .where(and(eq(bandMembers.bandId, band.id), eq(bandMembers.recoveryCodeHash, sha256(normalized))))
    .returning();
  if (!member) return null;

  return { slug, token, memberName: member.name, recoveryCode };
}

/**
 * Creates a single-use rejoin link for a member, valid for 24 hours. Any
 * older links for the same member are deleted, so only the newest works.
 * Returns the raw token; only its hash is stored.
 */
export async function createRejoinLink(
  memberId: string,
  now: Date = new Date()
): Promise<{ token: string; expiresAt: Date }> {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(now.getTime() + REJOIN_LINK_TTL_MS);
  await db.transaction(async (tx) => {
    await tx.delete(memberRejoinLinks).where(eq(memberRejoinLinks.memberId, memberId));
    await tx.insert(memberRejoinLinks).values({ memberId, tokenHash: sha256(token), expiresAt, createdAt: now });
  });
  return { token, expiresAt };
}

export type RejoinLinkProblem = "invalid" | "expired" | "used";

export type RejoinLinkStatus =
  | { ok: true; memberName: string; bandName: string; expiresAt: Date }
  | { ok: false; reason: RejoinLinkProblem };

async function findLink(token: string) {
  const [row] = await db
    .select({ link: memberRejoinLinks, memberName: bandMembers.name, bandName: bands.name, slug: bands.slug })
    .from(memberRejoinLinks)
    .innerJoin(bandMembers, eq(bandMembers.id, memberRejoinLinks.memberId))
    .innerJoin(bands, eq(bands.id, bandMembers.bandId))
    .where(eq(memberRejoinLinks.tokenHash, sha256(token)))
    .limit(1);
  return row ?? null;
}

function problemWith(link: typeof memberRejoinLinks.$inferSelect, now: Date): RejoinLinkProblem | null {
  if (link.usedAt) return "used";
  if (link.expiresAt <= now) return "expired";
  return null;
}

/** Read-only check, for showing the link page. Doesn't spend the link. */
export async function getRejoinLinkStatus(token: string, now: Date = new Date()): Promise<RejoinLinkStatus> {
  const row = await findLink(token);
  if (!row) return { ok: false, reason: "invalid" };
  const problem = problemWith(row.link, now);
  if (problem) return { ok: false, reason: problem };
  return { ok: true, memberName: row.memberName, bandName: row.bandName, expiresAt: row.link.expiresAt };
}

/**
 * Spends a rejoin link: moves the member onto this device with a new token
 * and a new recovery code. Marking the link used is conditional on it being
 * unused and unexpired, so two concurrent redemptions can't both succeed.
 */
export async function redeemRejoinLink(
  token: string,
  now: Date = new Date()
): Promise<({ ok: true } & Reclaimed) | { ok: false; reason: RejoinLinkProblem }> {
  const row = await findLink(token);
  if (!row) return { ok: false, reason: "invalid" };

  return db.transaction(async (tx) => {
    const [spent] = await tx
      .update(memberRejoinLinks)
      .set({ usedAt: now })
      .where(
        and(
          eq(memberRejoinLinks.id, row.link.id),
          isNull(memberRejoinLinks.usedAt),
          gt(memberRejoinLinks.expiresAt, now)
        )
      )
      .returning();
    if (!spent) return { ok: false as const, reason: problemWith(row.link, now) ?? "used" };

    const newToken = crypto.randomUUID();
    const recoveryCode = generateRecoveryCode();
    await tx
      .update(bandMembers)
      .set({ memberToken: newToken, recoveryCodeHash: hashRecoveryCode(recoveryCode), lastSeenAt: now })
      .where(eq(bandMembers.id, spent.memberId));

    return { ok: true as const, slug: row.slug, token: newToken, memberName: row.memberName, recoveryCode };
  });
}
