import { cache } from "react";
import { auth, currentUser } from "@clerk/nextjs/server";
import { db } from "@/db";
import { profiles } from "@/db/schema";
import { isAuthConfigured } from "@/lib/auth-config";
import {
  claimPreClerkBands,
  findOrCreateProfileForClerkUser,
  type ClerkIdentity,
} from "@/lib/profiles";
import type { Profile } from "@/types";

/**
 * Current signed-in band leader's profile, or null.
 *
 * Without Clerk configured there is no way to sign in. In local development
 * we fall back to the first profile in the database (the seeded demo leader)
 * so the dashboard is explorable; in production we return null, which keeps
 * the dashboard closed instead of handing it to every visitor.
 */
export const getCurrentProfile = cache(async (): Promise<Profile | null> => {
  if (!isAuthConfigured()) {
    if (process.env.NODE_ENV === "production") return null;
    const [fallback] = await db.select().from(profiles).limit(1);
    return fallback ?? null;
  }

  const { userId } = await auth();
  if (!userId) return null;

  const profile = await findOrCreateProfileForClerkUser(userId, loadClerkIdentity);
  if (profile) await claimPreClerkBands(profile, process.env.CLAIM_EXISTING_BANDS_FOR);
  return profile;
});

async function loadClerkIdentity(): Promise<ClerkIdentity | null> {
  const user = await currentUser();
  if (!user) return null;

  const primary = user.primaryEmailAddress;
  const verifiedEmail =
    primary?.verification?.status === "verified" ? primary.emailAddress : null;
  const fullName =
    user.fullName?.trim() ||
    user.username ||
    verifiedEmail?.split("@")[0] ||
    "Band leader";

  return { fullName, verifiedEmail };
}
