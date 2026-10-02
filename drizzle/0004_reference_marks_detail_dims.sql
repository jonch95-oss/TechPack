ALTER TABLE "hardware" ADD COLUMN "detail_dims" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "pack_files" ADD COLUMN "page" text;--> statement-breakpoint
ALTER TABLE "pack_files" ADD COLUMN "marks" jsonb DEFAULT '{}'::jsonb NOT NULL;