"use server";

import { headers } from "next/headers";
import { and, eq } from "drizzle-orm";
import type {
  AuthenticationResponseJSON,
  PublicKeyCredentialCreationOptionsJSON,
  PublicKeyCredentialRequestOptionsJSON,
  RegistrationResponseJSON,
} from "@simplewebauthn/server";
import { db } from "@/db";
import { bandMembers, bands } from "@/db/schema";
import { toActionError } from "./helpers";
import { ValidationError, type ActionResult } from "@/lib/action-errors";
import {
  finishPasskeyRegistration,
  finishPasskeySignIn,
  relyingPartyFor,
  startPasskeyRegistration,
  startPasskeySignIn,
} from "@/lib/passkeys";

async function relyingParty() {
  const h = await headers();
  const host = h.get("host");
  if (!host) throw new Error("Request has no Host header.");
  const local = /^(localhost|127\.0\.0\.1)(:|$)/.test(host);
  const protocol = h.get("x-forwarded-proto")?.split(",")[0].trim() || (local ? "http" : "https");
  return relyingPartyFor(host, protocol, process.env.WEBAUTHN_RP_ID);
}

async function requireMember(slug: string, token: string) {
  const [row] = await db
    .select({ member: bandMembers, bandName: bands.name })
    .from(bandMembers)
    .innerJoin(bands, eq(bands.id, bandMembers.bandId))
    .where(and(eq(bands.slug, slug), eq(bandMembers.memberToken, token)))
    .limit(1);
  if (!row) throw new ValidationError("That link doesn't look right.");
  return row;
}

async function requireBand(slug: string) {
  const band = await db.query.bands.findFirst({ where: eq(bands.slug, slug) });
  if (!band) throw new ValidationError("That link doesn't look right.");
  return band;
}

export async function passkeyRegistrationOptions(
  slug: string,
  token: string
): Promise<ActionResult<PublicKeyCredentialCreationOptionsJSON>> {
  try {
    const { member, bandName } = await requireMember(slug, token);
    return { ok: true, data: await startPasskeyRegistration(member, bandName, await relyingParty()) };
  } catch (err) {
    return toActionError(err);
  }
}

export async function savePasskey(
  slug: string,
  token: string,
  response: RegistrationResponseJSON
): Promise<ActionResult> {
  try {
    const { member } = await requireMember(slug, token);
    await finishPasskeyRegistration(member, response, await relyingParty());
    return { ok: true };
  } catch (err) {
    return toActionError(err);
  }
}

export async function passkeySignInOptions(
  slug: string
): Promise<ActionResult<PublicKeyCredentialRequestOptionsJSON>> {
  try {
    const band = await requireBand(slug);
    return { ok: true, data: await startPasskeySignIn(band.id, await relyingParty()) };
  } catch (err) {
    return toActionError(err);
  }
}

export async function signInWithPasskey(
  slug: string,
  response: AuthenticationResponseJSON
): Promise<ActionResult<{ token: string; memberName: string }>> {
  try {
    const band = await requireBand(slug);
    return { ok: true, data: await finishPasskeySignIn(band.id, response, await relyingParty()) };
  } catch (err) {
    return toActionError(err);
  }
}
