DROP INDEX "swipe_decisions_user_job";--> statement-breakpoint
-- A double tap wrote two rows per (user, job) before the route upserted. Keep the newest
-- decision per pair so the unique index can be created at deploy time.
DELETE FROM "swipe_decisions" d USING "swipe_decisions" n
WHERE d."user_id" = n."user_id" AND d."job_id" = n."job_id"
  AND (d."created_at" < n."created_at" OR (d."created_at" = n."created_at" AND d."id" < n."id"));--> statement-breakpoint
CREATE UNIQUE INDEX "swipe_decisions_user_job" ON "swipe_decisions" USING btree ("user_id","job_id");