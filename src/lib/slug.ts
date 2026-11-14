import { randomInt } from "node:crypto";

const ADJECTIVES = [
  "brass",
  "downbeat",
  "encore",
  "groove",
  "harmony",
  "indigo",
  "jazzy",
  "loud",
  "midnight",
  "offbeat",
  "reverb",
  "sunset",
  "tempo",
  "velvet",
  "wildcard",
];

const NOUNS = [
  "band",
  "crew",
  "combo",
  "ensemble",
  "outfit",
  "quartet",
  "session",
  "setlist",
  "squad",
  "trio",
];

// The invite link is all a stranger needs to see a band and join it, so it
// must not be guessable: a CSPRNG and a 10-character suffix from 32 symbols
// (50 bits, on top of the words), not a predictable generator and 4 characters.
function randomFrom<T>(arr: readonly T[]): T {
  return arr[randomInt(arr.length)];
}

function randomSuffix(length = 10): string {
  const chars = "abcdefghijkmnpqrstuvwxyz23456789";
  let out = "";
  for (let i = 0; i < length; i++) {
    out += chars[randomInt(chars.length)];
  }
  return out;
}

/** A memorable, URL-safe, unguessable slug for a band's shareable link. */
export function generateSlug(): string {
  return `${randomFrom(ADJECTIVES)}-${randomFrom(NOUNS)}-${randomSuffix()}`;
}
