CREATE TABLE "team_bucket_members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"bucket_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"permission" "share_permission" DEFAULT 'editor' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "team_buckets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"bucket" text NOT NULL,
	"quota" bigint DEFAULT 10737418240 NOT NULL,
	"created_by_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "team_buckets_bucket_unique" UNIQUE("bucket")
);
--> statement-breakpoint
ALTER TABLE "files" ADD COLUMN "team_bucket_id" uuid;--> statement-breakpoint
ALTER TABLE "team_bucket_members" ADD CONSTRAINT "team_bucket_members_bucket_id_team_buckets_id_fk" FOREIGN KEY ("bucket_id") REFERENCES "public"."team_buckets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_bucket_members" ADD CONSTRAINT "team_bucket_members_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_buckets" ADD CONSTRAINT "team_buckets_created_by_id_user_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "team_members_bucket_user_uq" ON "team_bucket_members" USING btree ("bucket_id","user_id");--> statement-breakpoint
CREATE INDEX "team_members_user_idx" ON "team_bucket_members" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "team_members_bucket_idx" ON "team_bucket_members" USING btree ("bucket_id");--> statement-breakpoint
CREATE INDEX "files_team_bucket_idx" ON "files" USING btree ("team_bucket_id","parent_id");