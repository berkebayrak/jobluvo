CREATE EXTENSION IF NOT EXISTS pg_trgm;--> statement-breakpoint
CREATE TYPE "public"."comp_period" AS ENUM('year', 'hour', 'unknown');--> statement-breakpoint
CREATE TYPE "public"."cost_kind" AS ENUM('ingest', 'extract', 'score', 'tailor');--> statement-breakpoint
CREATE TYPE "public"."decision" AS ENUM('apply', 'save', 'skip');--> statement-breakpoint
CREATE TYPE "public"."family" AS ENUM('greenhouse', 'lever', 'ashby', 'smartrecruiters', 'workable', 'gem');--> statement-breakpoint
CREATE TYPE "public"."link_reason" AS ENUM('native', 'url', 'requisition', 'similar');--> statement-breakpoint
CREATE TYPE "public"."sponsorship" AS ENUM('offered', 'not_offered', 'unknown');--> statement-breakpoint
CREATE TYPE "public"."workplace" AS ENUM('remote', 'hybrid', 'onsite', 'unknown');--> statement-breakpoint
CREATE TABLE "cost_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kind" "cost_kind" NOT NULL,
	"model" text,
	"user_id" uuid,
	"ref_id" text,
	"tokens_in" integer DEFAULT 0 NOT NULL,
	"tokens_out" integer DEFAULT 0 NOT NULL,
	"usd" real DEFAULT 0 NOT NULL,
	"ms" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "job_group_links" (
	"group_id" uuid NOT NULL,
	"job_id" uuid NOT NULL,
	"reason" "link_reason" NOT NULL,
	"score" real,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "job_groups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"canonical_job_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_id" uuid NOT NULL,
	"family" "family" NOT NULL,
	"native_id" text NOT NULL,
	"requisition_id" text,
	"title" text NOT NULL,
	"title_norm" text NOT NULL,
	"company_name" text NOT NULL,
	"company_domain" text,
	"locations" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"workplace" "workplace" DEFAULT 'unknown' NOT NULL,
	"employment_type" text,
	"comp_min" integer,
	"comp_max" integer,
	"comp_currency" text,
	"comp_period" "comp_period" DEFAULT 'unknown' NOT NULL,
	"seniority" text,
	"sponsorship" "sponsorship" DEFAULT 'unknown' NOT NULL,
	"sponsorship_evidence" text,
	"description_text" text DEFAULT '' NOT NULL,
	"description_html" text DEFAULT '' NOT NULL,
	"description_core" text DEFAULT '' NOT NULL,
	"content_hash" text NOT NULL,
	"boilerplate_version" integer DEFAULT 0 NOT NULL,
	"apply_url" text NOT NULL,
	"apply_url_norm" text NOT NULL,
	"posted_at" timestamp with time zone,
	"first_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_checked_at" timestamp with time zone DEFAULT now() NOT NULL,
	"missed_polls" integer DEFAULT 0 NOT NULL,
	"closed_at" timestamp with time zone,
	"detail_pending" boolean DEFAULT false NOT NULL,
	"list_hash" text
);
--> statement-breakpoint
CREATE TABLE "similarity_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_a" uuid NOT NULL,
	"job_b" uuid NOT NULL,
	"score" real NOT NULL,
	"merged" boolean NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"family" "family" NOT NULL,
	"tenant" text NOT NULL,
	"company_name" text NOT NULL,
	"company_domain" text,
	"active" boolean DEFAULT true NOT NULL,
	"etag" text,
	"last_polled_at" timestamp with time zone,
	"last_status" text,
	"last_error" text,
	"consecutive_failures" integer DEFAULT 0 NOT NULL,
	"job_count" integer DEFAULT 0 NOT NULL,
	"boilerplate_version" integer DEFAULT 0 NOT NULL,
	"boilerplate" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "swipe_decisions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"job_id" uuid NOT NULL,
	"decision" "decision" NOT NULL,
	"reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"jobluvo_address" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email"),
	CONSTRAINT "users_jobluvo_address_unique" UNIQUE("jobluvo_address")
);
--> statement-breakpoint
ALTER TABLE "cost_events" ADD CONSTRAINT "cost_events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_group_links" ADD CONSTRAINT "job_group_links_group_id_job_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."job_groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_group_links" ADD CONSTRAINT "job_group_links_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_groups" ADD CONSTRAINT "job_groups_canonical_job_id_jobs_id_fk" FOREIGN KEY ("canonical_job_id") REFERENCES "public"."jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_source_id_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."sources"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "similarity_log" ADD CONSTRAINT "similarity_log_job_a_jobs_id_fk" FOREIGN KEY ("job_a") REFERENCES "public"."jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "similarity_log" ADD CONSTRAINT "similarity_log_job_b_jobs_id_fk" FOREIGN KEY ("job_b") REFERENCES "public"."jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "swipe_decisions" ADD CONSTRAINT "swipe_decisions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "swipe_decisions" ADD CONSTRAINT "swipe_decisions_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "cost_events_kind_created" ON "cost_events" USING btree ("kind","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "job_group_links_job" ON "job_group_links" USING btree ("job_id");--> statement-breakpoint
CREATE INDEX "job_group_links_group" ON "job_group_links" USING btree ("group_id");--> statement-breakpoint
CREATE UNIQUE INDEX "jobs_family_source_native" ON "jobs" USING btree ("family","source_id","native_id");--> statement-breakpoint
CREATE INDEX "jobs_apply_url_norm" ON "jobs" USING btree ("apply_url_norm");--> statement-breakpoint
CREATE INDEX "jobs_company_domain" ON "jobs" USING btree ("company_domain");--> statement-breakpoint
CREATE INDEX "jobs_title_norm" ON "jobs" USING btree ("title_norm");--> statement-breakpoint
CREATE INDEX "jobs_source_open" ON "jobs" USING btree ("source_id","closed_at");--> statement-breakpoint
CREATE UNIQUE INDEX "sources_family_tenant" ON "sources" USING btree ("family","tenant");--> statement-breakpoint
CREATE INDEX "swipe_decisions_user_job" ON "swipe_decisions" USING btree ("user_id","job_id");