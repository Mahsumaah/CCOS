-- Idempotent: some environments already had adoptedDocumentName from an earlier deploy.
ALTER TABLE "Minutes" ADD COLUMN IF NOT EXISTS "adoptedDocumentName" TEXT;
