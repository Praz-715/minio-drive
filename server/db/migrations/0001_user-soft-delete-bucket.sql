ALTER TABLE "user" ALTER COLUMN "storage_quota" SET DEFAULT 5368709120;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "bucket" text;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "deleted_at" timestamp with time zone;