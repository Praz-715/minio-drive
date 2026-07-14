CREATE TABLE "app_settings" (
	"id" text PRIMARY KEY NOT NULL,
	"app_name" text,
	"logo" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
