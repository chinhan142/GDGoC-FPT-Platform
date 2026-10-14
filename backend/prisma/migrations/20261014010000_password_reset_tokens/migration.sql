-- Local development previously added these nullable fields outside migration history.
-- Preserve any existing tokens; make the same schema available on cloud deployments.
ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "resetPasswordToken" TEXT,
  ADD COLUMN IF NOT EXISTS "resetPasswordExpires" TIMESTAMP(3);
