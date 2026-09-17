CREATE TYPE "public"."restriction" AS ENUM('citizenship', 'permanent_residency', 'right_to_work', 'clearance');--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "eligibility" "restriction";--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "eligibility_country" text;--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "eligibility_evidence" text;