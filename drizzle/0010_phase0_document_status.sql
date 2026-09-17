CREATE TYPE "public"."document_status" AS ENUM('processing', 'ready', 'failed');--> statement-breakpoint
ALTER TABLE "profile_documents" ADD COLUMN "status" "document_status" DEFAULT 'processing' NOT NULL;--> statement-breakpoint
ALTER TABLE "profile_documents" ADD COLUMN "error" text;--> statement-breakpoint
-- Documents that exist before this migration were extracted and their facts stored, so they are ready, not processing.
UPDATE "profile_documents" SET "status" = 'ready';
