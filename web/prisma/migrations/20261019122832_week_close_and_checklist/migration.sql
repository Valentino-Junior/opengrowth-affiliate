-- AlterTable
ALTER TABLE "weeks" ADD COLUMN     "checklist" JSONB NOT NULL DEFAULT '{}',
ADD COLUMN     "closed_at" TIMESTAMPTZ,
ADD COLUMN     "closed_by" UUID;
