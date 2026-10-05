CREATE TABLE "archive_imports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"url" text NOT NULL,
	"hash" text NOT NULL,
	"pages" integer DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'QUEUED' NOT NULL,
	"pack_id" uuid,
	"result" jsonb,
	"error" text,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "packs" ADD COLUMN "import_status" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "archive_imports" ADD CONSTRAINT "archive_imports_pack_id_packs_id_fk" FOREIGN KEY ("pack_id") REFERENCES "public"."packs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "archive_imports" ADD CONSTRAINT "archive_imports_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "archive_imports_hash_uq" ON "archive_imports" USING btree ("hash");