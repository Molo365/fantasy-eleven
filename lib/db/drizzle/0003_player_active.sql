-- Preserve player rows and squad references while removing departed PL players
-- from new-player acquisition surfaces.
BEGIN;
ALTER TABLE "players"
  ADD COLUMN IF NOT EXISTS "active" boolean NOT NULL DEFAULT true;
COMMIT;