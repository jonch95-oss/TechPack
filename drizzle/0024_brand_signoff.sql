ALTER TABLE "brands" ADD COLUMN "signoff_proto" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "brands" ADD COLUMN "signoff_production" boolean DEFAULT true NOT NULL;