CREATE TABLE "jobs" (
	"id" text PRIMARY KEY NOT NULL,
	"source_id" text NOT NULL,
	"url" text NOT NULL,
	"apply_url" text,
	"title" text NOT NULL,
	"company" text NOT NULL,
	"location_raw" text NOT NULL,
	"city" text,
	"country" text,
	"work_mode" text NOT NULL,
	"remote_scope" text,
	"salary_min" real,
	"salary_max" real,
	"salary_currency" text,
	"salary_period" text,
	"salary_is_estimated" boolean DEFAULT false NOT NULL,
	"salary_raw" text,
	"posted_at" timestamp with time zone,
	"description_html" text,
	"tags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"dedupe_key" text NOT NULL,
	"first_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"fetched_at" timestamp with time zone DEFAULT now() NOT NULL,
	"status" text,
	"status_updated_at" timestamp with time zone,
	"notes" text,
	"hidden" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "provider_state" (
	"source_id" text PRIMARY KEY NOT NULL,
	"enabled" boolean NOT NULL,
	"last_sync_at" timestamp with time zone,
	"config_json" text
);
--> statement-breakpoint
CREATE TABLE "sync_runs" (
	"id" serial PRIMARY KEY NOT NULL,
	"source_id" text NOT NULL,
	"started_at" timestamp with time zone NOT NULL,
	"finished_at" timestamp with time zone,
	"ok" boolean,
	"error" text,
	"inserted" integer DEFAULT 0 NOT NULL,
	"updated" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE INDEX "jobs_posted_at_idx" ON "jobs" USING btree ("posted_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "jobs_dedupe_key_idx" ON "jobs" USING btree ("dedupe_key");--> statement-breakpoint
CREATE INDEX "jobs_source_id_idx" ON "jobs" USING btree ("source_id");--> statement-breakpoint
CREATE INDEX "jobs_status_idx" ON "jobs" USING btree ("status");