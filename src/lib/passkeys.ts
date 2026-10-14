import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
  type AuthenticationResponseJSON,
  type RegistrationResponseJSON,
} from "@simplewebauthn/server";
import { and, eq, gt, lt } from "drizzle-orm";
import { db } from "@/db";
import { bandMembers, memberPasskeys, webauthnChallenges } from "@/db/schema";
import { ValidationError } from "@/lib/action-errors";

const CHALLENGE_TTL_MS = 5 * 60 * 1000;

/** Who the passkey is for: `rpID` is the domain it's bound to, `origins` where it may be used. */
export interface RelyingParty {
  rpID: string;
  origins: string[];
}

/**
 * Passkeys are bound to the registrable domain, so one saved on
 * trydownbeat.app also works on www.trydownbeat.app. `WEBAUTHN_RP_ID`
 * overrides the domain when the host name alone isn't right.
 */
export function relyingPartyFor(host: string, protocol: string, rpIdOverride?: string): RelyingParty {
  const hostname = host.split(":")[0].toLowerCase();
  const rpID = rpIdOverride || hostname.replace(/^www\./, "");
  if (hostname !== rpID && !hostname.endsWith(`.${rpID}`)) {
    throw new Error(`WEBAUTHN_RP_ID "${rpID}" doesn't cover host "${hostname}".`);
  }
  return { rpID, origins: [`${protocol}://${host}`] };
}

type Member = typeof bandMembers.$inferSelect;
type Purpose = "register" | "authenticate";

async function saveChallenge(challenge: string, purpose: Purpose, scope: { memberId?: string; bandId?: string }) {
  const now = new Date();
  await db.delete(webauthnChallenges).where(lt(webauthnChallenges.expiresAt, now));
  await db.insert(webauthnChallenges).values({
    challenge,
    purpose,
    memberId: scope.memberId ?? null,
    bandId: scope.bandId ?? null,
    expiresAt: new Date(now.getTime() + CHALLENGE_TTL_MS),
  });
}

/** Deletes and returns the challenge the browser signed, if we issued it for this purpose and scope. */
async function takeChallenge(
  clientDataJSON: string,
  purpose: Purpose,
  scope: { memberId: string } | { bandId: string }
): Promise<string> {
  let challenge: unknown;
  try {
    challenge = JSON.parse(Buffer.from(clientDataJSON, "base64url").toString("utf8")).challenge;
  } catch {
    challenge = null;
  }
  if (typeof challenge !== "string") throw new ValidationError("That passkey response wasn't valid.");

  const [row] = await db
    .delete(webauthnChallenges)
    .where(
      and(
        eq(webauthnChallenges.challenge, challenge),
        eq(webauthnChallenges.purpose, purpose),
        "memberId" in scope
          ? eq(webauthnChallenges.memberId, scope.memberId)
          : eq(webauthnChallenges.bandId, scope.bandId),
        gt(webauthnChallenges.expiresAt, new Date())
      )
    )
    .returning();
  if (!row) throw new ValidationError("That passkey request expired. Try again.");
  return row.challenge;
}

/** Options for saving a passkey for this band membership. */
export async function startPasskeyRegistration(member: Member, bandName: string, rp: RelyingParty) {
  const existing = await db
    .select({ id: memberPasskeys.credentialId, transports: memberPasskeys.transports })
    .from(memberPasskeys)
    .where(eq(memberPasskeys.memberId, member.id));

  const options = await generateRegistrationOptions({
    rpName: "Downbeat",
    rpID: rp.rpID,
    // Shown in the passkey picker, so people in several bands can tell them apart.
    userName: `${member.name} · ${bandName}`,
    userID: new TextEncoder().encode(member.id),
    attestationType: "none",
    excludeCredentials: existing.map((c) => ({ id: c.id, transports: c.transports ?? undefined })),
    authenticatorSelection: { residentKey: "required", userVerification: "preferred" },
  });
  await saveChallenge(options.challenge, "register", { memberId: member.id });
  return options;
}

export async function finishPasskeyRegistration(
  member: Member,
  response: RegistrationResponseJSON,
  rp: RelyingParty
): Promise<void> {
  const expectedChallenge = await takeChallenge(response.response.clientDataJSON, "register", {
    memberId: member.id,
  });
  const verification = await verifyRegistrationResponse({
    response,
    expectedChallenge,
    expectedOrigin: rp.origins,
    expectedRPID: rp.rpID,
    requireUserVerification: false,
  }).catch(() => ({ verified: false as const }));
  if (!verification.verified) throw new ValidationError("Your device couldn't save that passkey.");

  const { credential } = verification.registrationInfo;
  await db
    .insert(memberPasskeys)
    .values({
      memberId: member.id,
      credentialId: credential.id,
      publicKey: Buffer.from(credential.publicKey).toString("base64url"),
      counter: credential.counter,
      transports: credential.transports ?? null,
    })
    .onConflictDoNothing();
}

/** Options for signing in to a band with a saved passkey (the browser offers its own list). */
export async function startPasskeySignIn(bandId: string, rp: RelyingParty) {
  const options = await generateAuthenticationOptions({ rpID: rp.rpID, userVerification: "preferred" });
  await saveChallenge(options.challenge, "authenticate", { bandId });
  return options;
}

/**
 * Verifies a passkey sign-in for this band and returns that member's current
 * link. Unlike a recovery code, this doesn't replace the member's token: a
 * passkey is a way in, so other devices stay signed in.
 */
export async function finishPasskeySignIn(
  bandId: string,
  response: AuthenticationResponseJSON,
  rp: RelyingParty
): Promise<{ token: string; memberName: string }> {
  const expectedChallenge = await takeChallenge(response.response.clientDataJSON, "authenticate", { bandId });

  const [row] = await db
    .select({ passkey: memberPasskeys, member: bandMembers })
    .from(memberPasskeys)
    .innerJoin(bandMembers, eq(bandMembers.id, memberPasskeys.memberId))
    .where(eq(memberPasskeys.credentialId, response.id))
    .limit(1);
  if (!row) throw new ValidationError("That passkey isn't saved for anyone here.");
  if (row.member.bandId !== bandId) {
    throw new ValidationError("That passkey is for a different event. Pick the one for this band.");
  }

  const verification = await verifyAuthenticationResponse({
    response,
    expectedChallenge,
    expectedOrigin: rp.origins,
    expectedRPID: rp.rpID,
    credential: {
      id: row.passkey.credentialId,
      publicKey: new Uint8Array(Buffer.from(row.passkey.publicKey, "base64url")),
      counter: row.passkey.counter,
      transports: row.passkey.transports ?? undefined,
    },
    requireUserVerification: false,
  }).catch(() => ({ verified: false as const, authenticationInfo: null }));
  if (!verification.verified) throw new ValidationError("That passkey couldn't be verified.");

  const now = new Date();
  await db
    .update(memberPasskeys)
    .set({ counter: verification.authenticationInfo.newCounter, lastUsedAt: now })
    .where(eq(memberPasskeys.id, row.passkey.id));
  await db.update(bandMembers).set({ lastSeenAt: now }).where(eq(bandMembers.id, row.member.id));

  return { token: row.member.memberToken, memberName: row.member.name };
}

export async function countPasskeys(memberId: string): Promise<number> {
  const rows = await db
    .select({ id: memberPasskeys.id })
    .from(memberPasskeys)
    .where(eq(memberPasskeys.memberId, memberId));
  return rows.length;
}
