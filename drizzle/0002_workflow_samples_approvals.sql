CREATE TYPE "public"."pack_status" AS ENUM('DRAFT', 'IN_REVIEW', 'APPROVED', 'SENT', 'PROTO_RECEIVED', 'CLOSED');--> statement-breakpoint
CREATE TYPE "public"."sample_stage" AS ENUM('PROTO', 'SMS', 'PP', 'TOP');--> statement-breakpoint
CREATE TABLE "factory_questions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"pack_id" uuid NOT NULL,
	"asked_by" text DEFAULT '' NOT NULL,
	"question" text NOT NULL,
	"answer" text DEFAULT '' NOT NULL,
	"answered_by" uuid,
	"answered_at" timestamp with time zone,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sample_comments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"round_id" uuid NOT NULL,
	"letter" text NOT NULL,
	"text" text NOT NULL,
	"photo_url" text,
	"markup" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"status" text DEFAULT 'OPEN' NOT NULL,
	"carried_from" uuid,
	"updated_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sample_rounds" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"pack_id" uuid NOT NULL,
	"stage" "sample_stage" NOT NULL,
	"number" integer DEFAULT 1 NOT NULL,
	"received_at" text DEFAULT '' NOT NULL,
	"factory" text DEFAULT '' NOT NULL,
	"verdict" text DEFAULT 'PENDING' NOT NULL,
	"notes" text DEFAULT '' NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "hardware" ADD COLUMN "finish_spec" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "hardware" ADD COLUMN "approval" jsonb DEFAULT '{"status":"PENDING","type":"","date":"","note":""}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "materials" ADD COLUMN "approval" jsonb DEFAULT '{"status":"PENDING","type":"","date":"","note":""}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "packs" ADD COLUMN "status" "pack_status" DEFAULT 'DRAFT' NOT NULL;--> statement-breakpoint
ALTER TABLE "packs" ADD COLUMN "factory" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "packs" ADD COLUMN "factory_style_no" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "packs" ADD COLUMN "review_requested_by" uuid;--> statement-breakpoint
ALTER TABLE "packs" ADD COLUMN "reviewed_by" uuid;--> statement-breakpoint
ALTER TABLE "packs" ADD COLUMN "reviewed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "packs" ADD COLUMN "copied_from" uuid;--> statement-breakpoint
ALTER TABLE "factory_questions" ADD CONSTRAINT "factory_questions_pack_id_packs_id_fk" FOREIGN KEY ("pack_id") REFERENCES "public"."packs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "factory_questions" ADD CONSTRAINT "factory_questions_answered_by_users_id_fk" FOREIGN KEY ("answered_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "factory_questions" ADD CONSTRAINT "factory_questions_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sample_comments" ADD CONSTRAINT "sample_comments_round_id_sample_rounds_id_fk" FOREIGN KEY ("round_id") REFERENCES "public"."sample_rounds"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sample_comments" ADD CONSTRAINT "sample_comments_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sample_rounds" ADD CONSTRAINT "sample_rounds_pack_id_packs_id_fk" FOREIGN KEY ("pack_id") REFERENCES "public"."packs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sample_rounds" ADD CONSTRAINT "sample_rounds_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "packs" ADD CONSTRAINT "packs_review_requested_by_users_id_fk" FOREIGN KEY ("review_requested_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "packs" ADD CONSTRAINT "packs_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;