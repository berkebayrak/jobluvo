ALTER TABLE "packets" ADD COLUMN "change_set" jsonb;--> statement-breakpoint
ALTER TABLE "packets" ADD COLUMN "attempt" integer;--> statement-breakpoint
ALTER TABLE "packets" ADD COLUMN "validator_rev" text;