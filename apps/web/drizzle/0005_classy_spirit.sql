ALTER TABLE "jobs" ALTER COLUMN "stake_token" SET DEFAULT 'XLM';--> statement-breakpoint
ALTER TABLE "applications" ADD COLUMN "onchain_application_id" bigint;