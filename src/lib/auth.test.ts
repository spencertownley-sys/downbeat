import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { profiles } from "@/db/schema";
import { bandOwners, createTestDb, insertPreClerkLeader, resetTestDb, type TestDb } from "@/test/db";

const holder = vi.hoisted(() => ({ db: null as unknown as TestDb }));
vi.mock("@/db", () => ({
  get db() {
    return holder.db;
  },
}));

// React's request-scoped `cache` only exists in the server build Next uses.
vi.mock("react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react")>()),
  cache: <T>(fn: T) => fn,
}));

const clerk = vi.hoisted(() => ({ auth: vi.fn(), currentUser: vi.fn() }));
vi.mock("@clerk/nextjs/server", () => clerk);

const { getCurrentProfile } = await import("./auth");

function clerkUser(email: { address: string; verified: boolean } | null, fullName: string | null = "Jordan Rivers") {
  return {
    fullName,
    username: null,
    primaryEmailAddress: email && {
      emailAddress: email.address,
      verification: { status: email.verified ? "verified" : "unverified" },
    },
  };
}

function withClerkKeys() {
  vi.stubEnv("NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY", "pk_test_x");
  vi.stubEnv("CLERK_SECRET_KEY", "sk_test_x");
}

beforeAll(async () => {
  holder.db = await createTestDb();
});

beforeEach(async () => {
  await resetTestDb(holder.db);
  vi.stubEnv("NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY", "");
  vi.stubEnv("CLERK_SECRET_KEY", "");
  vi.stubEnv("CLAIM_EXISTING_BANDS_FOR", "");
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

describe("getCurrentProfile without Clerk keys", () => {
  it("stays signed out in production instead of using the demo leader", async () => {
    vi.stubEnv("NODE_ENV", "production");
    await insertPreClerkLeader(holder.db, ["The Basement Tapes"]);

    expect(await getCurrentProfile()).toBeNull();
    expect(clerk.auth).not.toHaveBeenCalled();
  });

  it("falls back to the seeded profile in development", async () => {
    vi.stubEnv("NODE_ENV", "development");
    const legacy = await insertPreClerkLeader(holder.db, []);

    expect((await getCurrentProfile())?.id).toBe(legacy.id);
  });

  it("needs both keys, not just the publishable one", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY", "pk_test_x");

    expect(await getCurrentProfile()).toBeNull();
    expect(clerk.auth).not.toHaveBeenCalled();
  });
});

describe("getCurrentProfile with Clerk", () => {
  beforeEach(() => {
    vi.stubEnv("NODE_ENV", "production");
    withClerkKeys();
  });

  it("is null when signed out", async () => {
    clerk.auth.mockResolvedValue({ userId: null });
    await insertPreClerkLeader(holder.db, []);

    expect(await getCurrentProfile()).toBeNull();
    expect(clerk.currentUser).not.toHaveBeenCalled();
  });

  it("creates the signed-in user's profile with their verified email", async () => {
    clerk.auth.mockResolvedValue({ userId: "user_jordan" });
    clerk.currentUser.mockResolvedValue(clerkUser({ address: "jordan@example.com", verified: true }));

    expect(await getCurrentProfile()).toMatchObject({
      clerkUserId: "user_jordan",
      email: "jordan@example.com",
      fullName: "Jordan Rivers",
    });
  });

  it("doesn't store an unverified email, and falls back to a name", async () => {
    clerk.auth.mockResolvedValue({ userId: "user_jordan" });
    clerk.currentUser.mockResolvedValue(clerkUser({ address: "jordan@example.com", verified: false }, null));

    expect(await getCurrentProfile()).toMatchObject({ email: null, fullName: "Band leader" });
  });

  it("hands pre-Clerk bands to the user named in CLAIM_EXISTING_BANDS_FOR", async () => {
    vi.stubEnv("CLAIM_EXISTING_BANDS_FOR", "jordan@example.com");
    await insertPreClerkLeader(holder.db, ["The Basement Tapes", "asdf"]);
    clerk.auth.mockResolvedValue({ userId: "user_jordan" });
    clerk.currentUser.mockResolvedValue(clerkUser({ address: "jordan@example.com", verified: true }));

    const me = await getCurrentProfile();

    expect(await bandOwners(holder.db)).toEqual({ "The Basement Tapes": me!.id, asdf: me!.id });
  });

  it("leaves pre-Clerk bands alone for anyone else", async () => {
    vi.stubEnv("CLAIM_EXISTING_BANDS_FOR", "user_owner");
    const legacy = await insertPreClerkLeader(holder.db, ["The Basement Tapes"]);
    clerk.auth.mockResolvedValue({ userId: "user_stranger" });
    clerk.currentUser.mockResolvedValue(clerkUser({ address: "s@example.com", verified: true }));

    await getCurrentProfile();

    expect(await bandOwners(holder.db)).toEqual({ "The Basement Tapes": legacy.id });
    expect(await holder.db.select().from(profiles)).toHaveLength(2);
  });
});
