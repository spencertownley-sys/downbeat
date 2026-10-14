"use client";

import { useEffect } from "react";
import { forgetMemberIfToken } from "@/components/recovery/member-storage";

/**
 * Rendered on a dead personal link (e.g. the member recovered on another
 * device). Without this, /join/[slug] would keep offering "Welcome back"
 * with the same dead link.
 */
export function ForgetStaleLink({ slug, token }: { slug: string; token: string }) {
  useEffect(() => forgetMemberIfToken(slug, token), [slug, token]);
  return null;
}
