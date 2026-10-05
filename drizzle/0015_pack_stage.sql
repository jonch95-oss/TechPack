CREATE TYPE "public"."pack_stage" AS ENUM('PROTO', 'PRODUCTION');--> statement-breakpoint
ALTER TABLE "packs" ADD COLUMN "stage" "pack_stage" DEFAULT 'PROTO' NOT NULL;--> statement-breakpoint
-- Packs that already have a production sample round (SMS / PP / TOP) start at PRODUCTION.
UPDATE "packs" p SET "stage" = 'PRODUCTION' WHERE EXISTS (SELECT 1 FROM "sample_rounds" r WHERE r."pack_id" = p."id" AND r."stage" <> 'PROTO');
