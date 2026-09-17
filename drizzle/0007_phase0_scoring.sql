CREATE TYPE "public"."match_status" AS ENUM('pending', 'scored', 'failed');--> statement-breakpoint
CREATE TABLE "matches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"job_id" uuid NOT NULL,
	"status" "match_status" DEFAULT 'pending' NOT NULL,
	"attempts" integer DEFAULT 1 NOT NULL,
	"score" integer,
	"band" text,
	"reasons" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"unknowns" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"prefs_hash" text NOT NULL,
	"facts_hash" text NOT NULL,
	"content_hash" text NOT NULL,
	"claimed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"scored_at" timestamp with time zone,
	"model" text,
	"tokens_in" integer DEFAULT 0 NOT NULL,
	"tokens_out" integer DEFAULT 0 NOT NULL,
	"usd" real DEFAULT 0 NOT NULL,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "cost_events" ADD COLUMN "tokens_cached" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "cost_events" ADD COLUMN "run" text;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "matches_user_job" ON "matches" USING btree ("user_id","job_id");--> statement-breakpoint
CREATE INDEX "matches_user_status" ON "matches" USING btree ("user_id","status","claimed_at");