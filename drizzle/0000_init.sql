CREATE TYPE "public"."answer_status" AS ENUM('ai', 'est', 'inferred', 'confirmed');--> statement-breakpoint
CREATE TYPE "public"."pack_file_kind" AS ENUM('render', 'colorway_render', 'reference', 'construction', 'reference_sample', 'swatch_photo');--> statement-breakpoint
CREATE TYPE "public"."role" AS ENUM('admin', 'designer', 'viewer');--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"entity" text NOT NULL,
	"entity_id" text NOT NULL,
	"action" text NOT NULL,
	"field" text,
	"before" jsonb,
	"after" jsonb,
	"at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "brands" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"code_prefix" text NOT NULL,
	"code_format" text NOT NULL,
	"logo_url" text,
	"licensor_required" boolean DEFAULT false NOT NULL,
	"updated_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "brands_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "hardware" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"brand_id" uuid,
	"name" text DEFAULT '' NOT NULL,
	"type" text NOT NULL,
	"dims_mm" text DEFAULT '' NOT NULL,
	"views" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"material" text DEFAULT '' NOT NULL,
	"finish" text DEFAULT '' NOT NULL,
	"logo_treatment" text DEFAULT '' NOT NULL,
	"enamel_pantone" text DEFAULT '' NOT NULL,
	"construction" text DEFAULT '' NOT NULL,
	"photo_url" text,
	"notes" text DEFAULT '' NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "library_usage" (
	"pack_id" uuid NOT NULL,
	"lib" text NOT NULL,
	"item_id" uuid NOT NULL,
	CONSTRAINT "library_usage_pack_id_lib_item_id_pk" PRIMARY KEY("pack_id","lib","item_id")
);
--> statement-breakpoint
CREATE TABLE "materials" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"supplier" text DEFAULT '' NOT NULL,
	"article_name" text DEFAULT '' NOT NULL,
	"article_no" text DEFAULT '' NOT NULL,
	"colour_no" text DEFAULT '' NOT NULL,
	"colour_name" text DEFAULT '' NOT NULL,
	"composition" text DEFAULT '' NOT NULL,
	"thickness" text DEFAULT '' NOT NULL,
	"width" text DEFAULT '' NOT NULL,
	"finish" text DEFAULT '' NOT NULL,
	"card_photo_url" text,
	"chip_box" jsonb,
	"field_status" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"ai_notes" text DEFAULT '' NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pack_answers" (
	"pack_id" uuid NOT NULL,
	"question_id" text NOT NULL,
	"value" jsonb,
	"status" "answer_status" DEFAULT 'confirmed' NOT NULL,
	"ai_note" text DEFAULT '' NOT NULL,
	"ai_value" jsonb,
	"updated_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "pack_answers_pack_id_question_id_pk" PRIMARY KEY("pack_id","question_id")
);
--> statement-breakpoint
CREATE TABLE "pack_files" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"pack_id" uuid NOT NULL,
	"kind" "pack_file_kind" NOT NULL,
	"url" text NOT NULL,
	"name" text DEFAULT '' NOT NULL,
	"tag" text DEFAULT '' NOT NULL,
	"note" text DEFAULT '' NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "packs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"brand_id" uuid NOT NULL,
	"category" text NOT NULL,
	"style_no" text NOT NULL,
	"style_name" text NOT NULL,
	"colorways" jsonb DEFAULT '["-A"]'::jsonb NOT NULL,
	"chinese_on" boolean DEFAULT false NOT NULL,
	"ai_analysis" jsonb,
	"sent_by" uuid,
	"created_by" uuid,
	"updated_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "prints" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"brand_id" uuid,
	"motif" text DEFAULT '' NOT NULL,
	"motif_url" text,
	"repeat_type" text DEFAULT '' NOT NULL,
	"tile_w" text DEFAULT '' NOT NULL,
	"tile_h" text DEFAULT '' NOT NULL,
	"tile_unit" text DEFAULT 'cm' NOT NULL,
	"colours" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"application" text DEFAULT '' NOT NULL,
	"base_fabric_id" uuid,
	"base_fabric_text" text DEFAULT '' NOT NULL,
	"source_files" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"name" text NOT NULL,
	"role" "role" DEFAULT 'designer' NOT NULL,
	"password_hash" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "brands" ADD CONSTRAINT "brands_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hardware" ADD CONSTRAINT "hardware_brand_id_brands_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hardware" ADD CONSTRAINT "hardware_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hardware" ADD CONSTRAINT "hardware_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "library_usage" ADD CONSTRAINT "library_usage_pack_id_packs_id_fk" FOREIGN KEY ("pack_id") REFERENCES "public"."packs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "materials" ADD CONSTRAINT "materials_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "materials" ADD CONSTRAINT "materials_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pack_answers" ADD CONSTRAINT "pack_answers_pack_id_packs_id_fk" FOREIGN KEY ("pack_id") REFERENCES "public"."packs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pack_answers" ADD CONSTRAINT "pack_answers_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pack_files" ADD CONSTRAINT "pack_files_pack_id_packs_id_fk" FOREIGN KEY ("pack_id") REFERENCES "public"."packs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pack_files" ADD CONSTRAINT "pack_files_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "packs" ADD CONSTRAINT "packs_brand_id_brands_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "packs" ADD CONSTRAINT "packs_sent_by_users_id_fk" FOREIGN KEY ("sent_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "packs" ADD CONSTRAINT "packs_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "packs" ADD CONSTRAINT "packs_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prints" ADD CONSTRAINT "prints_brand_id_brands_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prints" ADD CONSTRAINT "prints_base_fabric_id_materials_id_fk" FOREIGN KEY ("base_fabric_id") REFERENCES "public"."materials"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prints" ADD CONSTRAINT "prints_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prints" ADD CONSTRAINT "prints_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_entity_idx" ON "audit_log" USING btree ("entity","entity_id");--> statement-breakpoint
CREATE UNIQUE INDEX "hardware_code_uq" ON "hardware" USING btree ("code");--> statement-breakpoint
CREATE INDEX "library_usage_item_idx" ON "library_usage" USING btree ("item_id");--> statement-breakpoint
CREATE INDEX "materials_supplier_idx" ON "materials" USING btree ("supplier");--> statement-breakpoint
CREATE UNIQUE INDEX "packs_style_uq" ON "packs" USING btree ("style_no");