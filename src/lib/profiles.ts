import { db } from "@/db";
import { bands, profiles } from "@/db/schema";
import { eq, inArray, isNull } from "drizzle-orm";
import type { Profile } from "@/types";

/** What we need from Clerk to create someone's profile row. */
export type ClerkIdentity = {
  fullName: string;
  /** Only an address Clerk has verified — never an unverified one. */
  verifiedEmail: string | null;
};

async function findByClerkUserId(clerkUserId: string): Promise<Profile | null> {
  const [profile] = await db
    .select()
    .from(profiles)
    .where(eq(profiles.clerkUserId, clerkUserId))
    .limit(1);
  return profile ?? null;
}

/**
 * The profile linked to this Clerk user, created on their first request.
 * `loadIdentity` (a Clerk API call) only runs when the row doesn't exist yet.
 */
export async function findOrCreateProfileForClerkUser(
  clerkUserId: string,
  loadIdentity: () => Promise<ClerkIdentity | null>
): Promise<Profile | null> {
  const existing = await findByClerkUserId(clerkUserId);
  if (existing) return existing;

  const identity = await loadIdentity();
  if (!identity) return null;

  // A conflict means either a concurrent first request for this same user
  // (clerk_user_id) or another profile already holding this email.
  const [created] = await db
    .insert(profiles)
    .values({
      id: crypto.randomUUID(),
      clerkUserId,
      email: identity.verifiedEmail?.toLowerCase() ?? null,
      fullName: identity.fullName,
    })
    .onConflictDoNothing()
    .returning();
  if (created) return created;

  const raced = await findByClerkUserId(clerkUserId);
  if (raced) return raced;

  // The email belongs to another profile. Don't merge accounts on that
  // basis; just create this one without an email.
  const [withoutEmail] = await db
    .insert(profiles)
    .values({ id: crypto.randomUUID(), clerkUserId, email: null, fullName: identity.fullName })
    .onConflictDoNothing()
    .returning();
  return withoutEmail ?? (await findByClerkUserId(clerkUserId));
}

/**
 * Hands every band owned by a pre-Clerk profile (one with no Clerk user, such
 * as the seeded demo leader that owned everything while production had no
 * sign-in) to `profile` — but only if `claimFor` names this user by Clerk
 * user ID or verified email. Returns how many bands moved.
 */
export async function claimPreClerkBands(
  profile: Profile,
  claimFor: string | undefined
): Promise<number> {
  const target = claimFor?.trim();
  if (!target || !profile.clerkUserId) return 0;

  const isThisUser =
    target === profile.clerkUserId ||
    (!!profile.email && target.toLowerCase() === profile.email.toLowerCase());
  if (!isThisUser) return 0;

  const preClerkProfiles = db
    .select({ id: profiles.id })
    .from(profiles)
    .where(isNull(profiles.clerkUserId));

  const moved = await db
    .update(bands)
    .set({ leaderId: profile.id })
    .where(inArray(bands.leaderId, preClerkProfiles))
    .returning({ id: bands.id });
  return moved.length;
}
