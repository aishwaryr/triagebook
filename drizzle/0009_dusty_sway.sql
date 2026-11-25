CREATE TABLE "demo_visits" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"city" varchar(120),
	"country" varchar(2),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "demo_visits_created_at_idx" ON "demo_visits" USING btree ("created_at");