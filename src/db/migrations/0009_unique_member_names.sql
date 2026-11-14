-- Existing duplicates (same band, same name ignoring case) would stop the
-- unique index from building and the app from starting. Keep the earliest
-- member's name as it is and add a short suffix to later ones.
UPDATE "band_members" AS m
SET "name" = m."name" || ' (' || left(m."id"::text, 4) || ')'
FROM (
  SELECT "id", row_number() OVER (PARTITION BY "band_id", lower("name") ORDER BY "created_at", "id") AS rn
  FROM "band_members"
) AS d
WHERE m."id" = d."id" AND d.rn > 1;
--> statement-breakpoint
CREATE UNIQUE INDEX "uq_band_members_band_name" ON "band_members" USING btree ("band_id",lower("name"));