CREATE TYPE "public"."profile_status" AS ENUM('DRAFT', 'PENDING_REVIEW', 'CONFIRMED', 'NEEDS_UPDATE');--> statement-breakpoint
CREATE TYPE "public"."recommendation_status" AS ENUM('NEW', 'SEEN', 'ACCEPTED', 'REJECTED', 'EXPIRED');--> statement-breakpoint
CREATE TYPE "public"."recommendation_type" AS ENUM('JOB_TO_CANDIDATE', 'TALENT_TO_COMPANY');--> statement-breakpoint
CREATE TABLE "recommendations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"type" "recommendation_type" NOT NULL,
	"candidate_user_id" uuid NOT NULL,
	"recruiter_user_id" uuid,
	"job_id" uuid,
	"match_score" integer DEFAULT 0 NOT NULL,
	"confidence" numeric(3, 2),
	"reasons" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"missing_requirements" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"risk_flags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"recommended_action" text NOT NULL,
	"status" "recommendation_status" DEFAULT 'NEW' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "recommendations" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "candidate_profiles" ADD COLUMN "profile_status" "profile_status" DEFAULT 'DRAFT' NOT NULL;--> statement-breakpoint
ALTER TABLE "candidate_profiles" ADD COLUMN "embedding_text" text;--> statement-breakpoint
ALTER TABLE "candidate_profiles" ADD COLUMN "embedding" "bytea";--> statement-breakpoint
ALTER TABLE "recommendations" ADD CONSTRAINT "recommendations_candidate_user_id_app_users_id_fk" FOREIGN KEY ("candidate_user_id") REFERENCES "public"."app_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recommendations" ADD CONSTRAINT "recommendations_recruiter_user_id_app_users_id_fk" FOREIGN KEY ("recruiter_user_id") REFERENCES "public"."app_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recommendations" ADD CONSTRAINT "recommendations_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "recommendations_candidate_job_type_unique" ON "recommendations" USING btree ("candidate_user_id","job_id","type");