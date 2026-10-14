import {
  pgTable,
  uuid,
  text,
  integer,
  date,
  timestamp,
  index,
  unique,
} from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";

// ---------------------------------------------------------------------------
// profiles — band leader (and, optionally, member) accounts.
// `clerk_user_id` links a row to its Clerk user; a row is created the first
// time a signed-in Clerk user hits the app. Rows with no Clerk user predate
// Clerk (e.g. the seeded demo leader). `email` is only ever a Clerk-verified
// address, and is optional because Clerk accounts don't require one.
// ---------------------------------------------------------------------------
export const profiles = pgTable("profiles", {
  id: uuid("id").primaryKey(),
  clerkUserId: text("clerk_user_id").unique(),
  email: text("email").unique(),
  fullName: text("full_name").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

// ---------------------------------------------------------------------------
// bands — one event/schedule a leader manages. `slug` is the public,
// shareable identifier used in the join link (no auth needed to view/use it).
// ---------------------------------------------------------------------------
export const bands = pgTable(
  "bands",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    name: text("name").notNull(),
    slug: text("slug").notNull().unique(),
    leaderId: uuid("leader_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    description: text("description"),

    // Schedule shape
    scheduleType: text("schedule_type").notNull().default("date_time"), // 'date_time' | 'date_only'
    startDate: date("start_date").notNull(),
    endDate: date("end_date").notNull(),
    activeDays: integer("active_days").array().notNull().default(sql`'{0,1,2,3,4,5,6}'::int[]`),

    // Time-of-day grid (only meaningful when scheduleType === 'date_time')
    timeSlotStart: text("time_slot_start").notNull().default("17:00"), // "HH:MM"
    timeSlotEnd: text("time_slot_end").notNull().default("22:00"), // "HH:MM"
    timeSlotMinutes: integer("time_slot_minutes").notNull().default(60),
    eventDurationMinutes: integer("event_duration_minutes").notNull().default(120),

    // Event details
    location: text("location"),
    locationType: text("location_type").notNull().default("tbd"), // 'in_person' | 'virtual' | 'tbd'
    timezone: text("timezone").notNull().default("America/New_York"),

    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (table) => ({
    leaderIdx: index("idx_bands_leader").on(table.leaderId),
  })
);

// ---------------------------------------------------------------------------
// band_day_labels — leader-authored labels tagging specific dates in a
// band's range, e.g. "Load-in", "Soundcheck". One label per (band, date).
// ---------------------------------------------------------------------------
export const bandDayLabels = pgTable(
  "band_day_labels",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    bandId: uuid("band_id")
      .notNull()
      .references(() => bands.id, { onDelete: "cascade" }),
    date: date("date").notNull(),
    label: text("label").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (table) => ({
    bandIdx: index("idx_band_day_labels_band").on(table.bandId),
    bandDateUnique: unique("band_day_labels_band_date_unique").on(table.bandId, table.date),
  })
);

// ---------------------------------------------------------------------------
// band_members — a person in the band. No account required. `member_token`
// is the bearer credential embedded in their personal link
// (/a/[slug]/[memberToken]) — knowing it is how they prove who they are.
// Recovering on a new device replaces it, so the old link stops working.
// `recovery_code_hash` is a SHA-256 of the one-time-shown recovery code.
// `profile_id` is set only if/when they link this row to a real account.
// ---------------------------------------------------------------------------
export const bandMembers = pgTable(
  "band_members",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    bandId: uuid("band_id")
      .notNull()
      .references(() => bands.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    instrument: text("instrument"),
    contact: text("contact"),
    memberToken: uuid("member_token").notNull().default(sql`gen_random_uuid()`).unique(),
    recoveryCodeHash: text("recovery_code_hash"),
    profileId: uuid("profile_id").references(() => profiles.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).defaultNow(),
  },
  (table) => ({
    bandIdx: index("idx_band_members_band").on(table.bandId),
    tokenIdx: index("idx_band_members_token").on(table.memberToken),
    profileIdx: index("idx_band_members_profile").on(table.profileId),
  })
);

// ---------------------------------------------------------------------------
// member_rejoin_links — leader-generated, single-use links that move a member
// onto a new device. Only a hash of the token is stored. A link is spent when
// `used_at` is set; making a new one for the same member deletes older ones.
// ---------------------------------------------------------------------------
export const memberRejoinLinks = pgTable(
  "member_rejoin_links",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    memberId: uuid("member_id")
      .notNull()
      .references(() => bandMembers.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull().unique(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    usedAt: timestamp("used_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (table) => ({
    memberIdx: index("idx_member_rejoin_links_member").on(table.memberId),
  })
);

// ---------------------------------------------------------------------------
// member_passkeys — WebAuthn credentials a member saved for one band
// membership. `credential_id` and `public_key` are base64url.
// ---------------------------------------------------------------------------
export const memberPasskeys = pgTable(
  "member_passkeys",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    memberId: uuid("member_id")
      .notNull()
      .references(() => bandMembers.id, { onDelete: "cascade" }),
    credentialId: text("credential_id").notNull().unique(),
    publicKey: text("public_key").notNull(),
    counter: integer("counter").notNull().default(0),
    transports: text("transports").array(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
  },
  (table) => ({
    memberIdx: index("idx_member_passkeys_member").on(table.memberId),
  })
);

// ---------------------------------------------------------------------------
// webauthn_challenges — short-lived, single-use challenges for passkey
// registration (scoped to a member) and sign-in (scoped to a band).
// ---------------------------------------------------------------------------
export const webauthnChallenges = pgTable("webauthn_challenges", {
  challenge: text("challenge").primaryKey(),
  purpose: text("purpose").notNull(), // 'register' | 'authenticate'
  memberId: uuid("member_id").references(() => bandMembers.id, { onDelete: "cascade" }),
  bandId: uuid("band_id").references(() => bands.id, { onDelete: "cascade" }),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
});

// ---------------------------------------------------------------------------
// availability — one row per (member, calendar date, time slot). Missing
// row = unfilled (member hasn't responded yet). `time_slot` is "HH:MM", or
// the ALL_DAY_SLOT sentinel for date-only bands.
// ---------------------------------------------------------------------------
export const availability = pgTable(
  "availability",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    memberId: uuid("member_id")
      .notNull()
      .references(() => bandMembers.id, { onDelete: "cascade" }),
    date: date("date").notNull(),
    timeSlot: text("time_slot").notNull(),
    status: text("status").notNull(), // 'conflict' | 'maybe' | 'available' | 'preferred'
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (table) => ({
    memberIdx: index("idx_availability_member").on(table.memberId),
    memberSlotUnique: unique("availability_member_date_slot_unique").on(
      table.memberId,
      table.date,
      table.timeSlot
    ),
  })
);

// ---------------------------------------------------------------------------
// Relations
// ---------------------------------------------------------------------------
export const profilesRelations = relations(profiles, ({ many }) => ({
  bands: many(bands),
  memberships: many(bandMembers),
}));

export const bandsRelations = relations(bands, ({ one, many }) => ({
  leader: one(profiles, { fields: [bands.leaderId], references: [profiles.id] }),
  members: many(bandMembers),
  dayLabels: many(bandDayLabels),
}));

export const bandDayLabelsRelations = relations(bandDayLabels, ({ one }) => ({
  band: one(bands, { fields: [bandDayLabels.bandId], references: [bands.id] }),
}));

export const bandMembersRelations = relations(bandMembers, ({ one, many }) => ({
  band: one(bands, { fields: [bandMembers.bandId], references: [bands.id] }),
  profile: one(profiles, { fields: [bandMembers.profileId], references: [profiles.id] }),
  availability: many(availability),
}));

export const availabilityRelations = relations(availability, ({ one }) => ({
  member: one(bandMembers, {
    fields: [availability.memberId],
    references: [bandMembers.id],
  }),
}));
