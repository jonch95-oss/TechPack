CREATE TYPE "public"."answer_origin" AS ENUM('DESIGNER', 'SPEC', 'BASE_STYLE', 'LIBRARY', 'HOUSE', 'TEMPLATE', 'AI', 'DERIVED');--> statement-breakpoint
CREATE TABLE "answer_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"pack_id" uuid NOT NULL,
	"question_id" text NOT NULL,
	"value" jsonb,
	"origin" "answer_origin" NOT NULL,
	"status" "answer_status" NOT NULL,
	"source" text DEFAULT '' NOT NULL,
	"action" text NOT NULL,
	"user_id" uuid,
	"at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "pack_answers" ADD COLUMN "origin" "answer_origin" DEFAULT 'DESIGNER' NOT NULL;--> statement-breakpoint
ALTER TABLE "pack_answers" ADD COLUMN "conflict" jsonb;--> statement-breakpoint
ALTER TABLE "pack_answers" ADD COLUMN "confidence" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "answer_history" ADD CONSTRAINT "answer_history_pack_id_packs_id_fk" FOREIGN KEY ("pack_id") REFERENCES "public"."packs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "answer_history" ADD CONSTRAINT "answer_history_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "answer_history_pack_q" ON "answer_history" USING btree ("pack_id","question_id","at");--> statement-breakpoint
-- Backfill origins for existing answers: spec-sheet values are SPEC; anything else read by the AI
-- (render, photos, swatch cards, supplier sheets) is AI — confirmed or not; the rest was a person's.
UPDATE "pack_answers" SET "origin" = (CASE
  WHEN "source" = 'SPEC SHEET' THEN 'SPEC'
  WHEN "source" <> '' OR "status" <> 'confirmed' OR "ai_note" <> '' THEN 'AI'
  ELSE 'DESIGNER' END)::"answer_origin";
