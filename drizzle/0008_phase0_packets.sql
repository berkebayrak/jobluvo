CREATE TYPE "public"."packet_status" AS ENUM('ready', 'invalid', 'failed');--> statement-breakpoint
CREATE TABLE "packets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"job_id" uuid NOT NULL,
	"status" "packet_status" NOT NULL,
	"mode" text NOT NULL,
	"model" text NOT NULL,
	"attempts" integer DEFAULT 1 NOT NULL,
	"resume" jsonb,
	"changes" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"findings" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"facts_hash" text NOT NULL,
	"content_hash" text NOT NULL,
	"resume_hash" text,
	"tokens_in" integer DEFAULT 0 NOT NULL,
	"tokens_cached" integer DEFAULT 0 NOT NULL,
	"tokens_out" integer DEFAULT 0 NOT NULL,
	"usd" real DEFAULT 0 NOT NULL,
	"ms" integer DEFAULT 0 NOT NULL,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "packets" ADD CONSTRAINT "packets_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "packets" ADD CONSTRAINT "packets_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "packets_user_job" ON "packets" USING btree ("user_id","job_id");