ALTER TABLE "sources" ADD COLUMN "last_attempt_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "sources" ADD COLUMN "last_success_at" timestamp with time zone;--> statement-breakpoint
-- Carry the old poll stamp across: every attempt so far finished, so a success that was recorded as ok or not_modified keeps its time.
UPDATE "sources" SET "last_attempt_at" = "last_polled_at", "last_success_at" = CASE WHEN "last_status" IN ('ok', 'not_modified') THEN "last_polled_at" END;