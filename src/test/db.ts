import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { eq, sql } from "drizzle-orm";
import * as schema from "@/db/schema";

/** In-memory Postgres with the app's real migrations applied. */
export async function createTestDb() {
  const db = drizzle(new PGlite(), { schema });
  await migrate(db, { migrationsFolder: "src/db/migrations" });
  return db;
}

export type TestDb = Awaited<ReturnType<typeof createTestDb>>;

export async function resetTestDb(db: TestDb) {
  await db.execute(sql`TRUNCATE profiles, bands RESTART IDENTITY CASCADE`);
}

/** A profile that predates Clerk (like the seeded demo leader), owning `bandNames`. */
export async function insertPreClerkLeader(db: TestDb, bandNames: string[]) {
  const [leader] = await db
    .insert(schema.profiles)
    .values({ id: crypto.randomUUID(), email: "leader@downbeat.test", fullName: "Sam Rivera" })
    .returning();
  for (const name of bandNames) await insertBand(db, leader.id, name);
  return leader;
}

export async function insertBand(db: TestDb, leaderId: string, name: string) {
  const [band] = await db
    .insert(schema.bands)
    .values({
      name,
      slug: `${name.toLowerCase().replace(/\W+/g, "-")}-${crypto.randomUUID().slice(0, 4)}`,
      leaderId,
      startDate: "2026-11-01",
      endDate: "2026-11-30",
    })
    .returning();
  return band;
}

export async function insertMember(db: TestDb, bandId: string, name: string, recoveryCodeHash?: string) {
  const [member] = await db
    .insert(schema.bandMembers)
    .values({ bandId, name, recoveryCodeHash })
    .returning();
  return member;
}

export async function getMember(db: TestDb, id: string) {
  const [member] = await db.select().from(schema.bandMembers).where(eq(schema.bandMembers.id, id));
  return member;
}

export async function bandOwners(db: TestDb) {
  const rows = await db.select({ name: schema.bands.name, leaderId: schema.bands.leaderId }).from(schema.bands);
  return Object.fromEntries(rows.map((r) => [r.name, r.leaderId]));
}
