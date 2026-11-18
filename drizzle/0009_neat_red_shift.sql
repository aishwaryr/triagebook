CREATE TYPE "public"."ai_call_status" AS ENUM('pending', 'ok', 'error', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."ai_feature" AS ENUM('bulk_issues', 'triage');--> statement-breakpoint
CREATE TABLE "ai_calls" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"feature" "ai_feature" NOT NULL,
	"model" varchar(100) NOT NULL,
	"prompt_version" varchar(40) NOT NULL,
	"status" "ai_call_status" DEFAULT 'pending' NOT NULL,
	"error_code" varchar(40),
	"input_tokens" integer,
	"output_tokens" integer,
	"latency_ms" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ai_calls" ADD CONSTRAINT "ai_calls_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ai_calls_user_id_created_at_idx" ON "ai_calls" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "ai_calls_created_at_idx" ON "ai_calls" USING btree ("created_at");