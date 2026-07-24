CREATE TABLE "agent_run_steps" (
	"id" serial PRIMARY KEY NOT NULL,
	"run_id" integer NOT NULL,
	"seq" integer NOT NULL,
	"at" timestamp with time zone NOT NULL,
	"channel" text NOT NULL,
	"label" text NOT NULL,
	"status" text,
	"chars" integer,
	"duration_ms" integer,
	"body" text,
	"stats" jsonb,
	"jobs" jsonb
);
--> statement-breakpoint
CREATE TABLE "agent_runs" (
	"id" serial PRIMARY KEY NOT NULL,
	"started_at" timestamp with time zone NOT NULL,
	"finished_at" timestamp with time zone,
	"status" text NOT NULL,
	"trigger" text NOT NULL,
	"emails_total" integer DEFAULT 0 NOT NULL,
	"emails_processed" integer DEFAULT 0 NOT NULL,
	"jobs_kept" integer DEFAULT 0 NOT NULL,
	"error" text
);
--> statement-breakpoint
ALTER TABLE "agent_run_steps" ADD CONSTRAINT "agent_run_steps_run_id_agent_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."agent_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "agent_run_steps_run_id_idx" ON "agent_run_steps" USING btree ("run_id","seq");--> statement-breakpoint
CREATE INDEX "agent_runs_started_at_idx" ON "agent_runs" USING btree ("started_at" DESC NULLS LAST);