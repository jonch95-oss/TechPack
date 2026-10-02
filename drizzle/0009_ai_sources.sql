ALTER TYPE "public"."answer_status" ADD VALUE 'sourced';--> statement-breakpoint
ALTER TYPE "public"."job_kind" ADD VALUE 'SOURCE';--> statement-breakpoint
ALTER TYPE "public"."job_kind" ADD VALUE 'BOARD';--> statement-breakpoint
ALTER TYPE "public"."pack_file_kind" ADD VALUE 'spec_sheet';--> statement-breakpoint
ALTER TYPE "public"."pack_file_kind" ADD VALUE 'view_photo';--> statement-breakpoint
ALTER TYPE "public"."pack_file_kind" ADD VALUE 'scale_photo';--> statement-breakpoint
ALTER TYPE "public"."pack_file_kind" ADD VALUE 'hardware_sheet';--> statement-breakpoint
ALTER TABLE "pack_answers" ADD COLUMN "source" text DEFAULT '' NOT NULL;