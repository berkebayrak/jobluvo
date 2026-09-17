CREATE TYPE "public"."fact_kind" AS ENUM('contact', 'link', 'employment', 'education', 'project', 'skill', 'authorization', 'sponsorship', 'preference', 'answer');--> statement-breakpoint
CREATE TYPE "public"."fact_origin" AS ENUM('upload', 'user', 'edit');--> statement-breakpoint
CREATE TYPE "public"."fact_status" AS ENUM('extracted', 'confirmed', 'rejected');--> statement-breakpoint
CREATE TABLE "profile_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"filename" text NOT NULL,
	"bytes_phase0" "bytea" NOT NULL,
	"text" text NOT NULL,
	"page_count" integer DEFAULT 0 NOT NULL,
	"uploaded_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "profile_facts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"document_id" uuid,
	"kind" "fact_kind" NOT NULL,
	"data" jsonb NOT NULL,
	"evidence" text,
	"origin" "fact_origin" NOT NULL,
	"status" "fact_status" DEFAULT 'extracted' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "profile_documents" ADD CONSTRAINT "profile_documents_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profile_facts" ADD CONSTRAINT "profile_facts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profile_facts" ADD CONSTRAINT "profile_facts_document_id_profile_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."profile_documents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "profile_facts_user_kind" ON "profile_facts" USING btree ("user_id","kind","status");