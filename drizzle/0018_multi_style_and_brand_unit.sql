ALTER TABLE "brands" ADD COLUMN "default_unit" text DEFAULT 'CM' NOT NULL;--> statement-breakpoint
ALTER TABLE "packs" ADD COLUMN "colorway_styles" jsonb DEFAULT '{}'::jsonb NOT NULL;