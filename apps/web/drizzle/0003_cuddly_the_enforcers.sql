CREATE TYPE "public"."matching_evaluation_status" AS ENUM('PENDING', 'RUNNING', 'COMPLETED', 'FAILED');--> statement-breakpoint
CREATE TABLE "matching_evaluations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"candidate_user_id" uuid NOT NULL,
	"job_id" uuid NOT NULL,
	"input_hash" text NOT NULL,
	"scoring_version" text NOT NULL,
	"status" "matching_evaluation_status" NOT NULL,
	"rule_score" integer,
	"match_score" integer,
	"confidence" numeric(3, 2),
	"recommended_action" text,
	"reasons" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"missing_requirements" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"risk_flags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"failure_code" text,
	"attempt_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "matching_evaluations_confidence_range_check" CHECK ("matching_evaluations"."confidence" is null or "matching_evaluations"."confidence" between 0 and 1),
	CONSTRAINT "matching_evaluations_rule_score_range_check" CHECK ("matching_evaluations"."rule_score" is null or "matching_evaluations"."rule_score" between 0 and 100),
	CONSTRAINT "matching_evaluations_match_score_range_check" CHECK ("matching_evaluations"."match_score" is null or "matching_evaluations"."match_score" between 0 and 100),
	CONSTRAINT "matching_evaluations_attempt_count_nonnegative_check" CHECK ("matching_evaluations"."attempt_count" >= 0)
);
--> statement-breakpoint
ALTER TABLE "matching_evaluations" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "matching_evaluations" ADD CONSTRAINT "matching_evaluations_candidate_user_id_app_users_id_fk" FOREIGN KEY ("candidate_user_id") REFERENCES "public"."app_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matching_evaluations" ADD CONSTRAINT "matching_evaluations_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "matching_evaluations_candidate_job_unique" ON "matching_evaluations" USING btree ("candidate_user_id","job_id");--> statement-breakpoint
CREATE INDEX "matching_evaluations_status_idx" ON "matching_evaluations" USING btree ("status");--> statement-breakpoint
CREATE INDEX "matching_evaluations_updated_at_idx" ON "matching_evaluations" USING btree ("updated_at");--> statement-breakpoint
CREATE TRIGGER set_matching_evaluations_updated_at
BEFORE UPDATE ON public.matching_evaluations
FOR EACH ROW EXECUTE FUNCTION public.shire_set_updated_at();--> statement-breakpoint
DO $$
BEGIN
	IF EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = 'anon') THEN
		EXECUTE 'REVOKE ALL ON TABLE public.matching_evaluations FROM anon';
	END IF;
	IF EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = 'authenticated') THEN
		EXECUTE 'REVOKE ALL ON TABLE public.matching_evaluations FROM authenticated';
	END IF;
END;
$$;
