ALTER TYPE "public"."comp_period" ADD VALUE 'month' BEFORE 'hour';--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "comp_raw" text;--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "eligibility_options" jsonb;