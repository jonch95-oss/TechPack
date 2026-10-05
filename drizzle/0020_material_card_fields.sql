ALTER TABLE "materials" ADD COLUMN "icon_code" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "materials" ADD COLUMN "thread_count" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "materials" ADD COLUMN "peel_strength" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "materials" ADD COLUMN "rub_fastness" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "materials" ADD COLUMN "backing" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "materials" ADD COLUMN "quality_only" boolean DEFAULT false NOT NULL;--> statement-breakpoint
CREATE INDEX "materials_icon_code_idx" ON "materials" USING btree ("icon_code");