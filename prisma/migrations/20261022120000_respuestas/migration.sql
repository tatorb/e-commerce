-- CreateEnum
CREATE TYPE "AnswerSource" AS ENUM ('CHANNEL', 'APP');

-- CreateEnum
CREATE TYPE "DraftOutcome" AS ENUM ('SENT_AS_IS', 'SENT_EDITED', 'DISCARDED', 'ANSWERED_IN_CHANNEL');

-- AlterEnum
ALTER TYPE "SyncChangeKind" ADD VALUE 'ANSWERED';
ALTER TYPE "SyncChangeKind" ADD VALUE 'ANSWER_FAILED';

-- AlterTable
ALTER TABLE "buyer_questions" ADD COLUMN     "answeredById" TEXT,
ADD COLUMN     "answeredFrom" "AnswerSource";

-- CreateTable
CREATE TABLE "question_drafts" (
    "id" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "usedData" JSONB NOT NULL DEFAULT '[]',
    "missing" JSONB NOT NULL DEFAULT '[]',
    "needsPerson" BOOLEAN NOT NULL DEFAULT false,
    "reason" TEXT,
    "model" TEXT NOT NULL,
    "usage" JSONB NOT NULL,
    "costUsd" DOUBLE PRECISION NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 1,
    "outcome" "DraftOutcome",
    "sentText" TEXT,
    "decidedAt" TIMESTAMP(3),
    "decidedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "question_drafts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "question_settings" (
    "accountId" TEXT NOT NULL,
    "greeting" TEXT,
    "signature" TEXT,
    "tone" TEXT,
    "notes" TEXT,
    "autoDraft" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "question_settings_pkey" PRIMARY KEY ("accountId")
);

-- CreateIndex
CREATE UNIQUE INDEX "question_drafts_questionId_key" ON "question_drafts"("questionId");

-- CreateIndex
CREATE INDEX "question_drafts_outcome_createdAt_idx" ON "question_drafts"("outcome", "createdAt");

-- AddForeignKey
ALTER TABLE "buyer_questions" ADD CONSTRAINT "buyer_questions_answeredById_fkey" FOREIGN KEY ("answeredById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "question_drafts" ADD CONSTRAINT "question_drafts_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "buyer_questions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "question_drafts" ADD CONSTRAINT "question_drafts_decidedById_fkey" FOREIGN KEY ("decidedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "question_settings" ADD CONSTRAINT "question_settings_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

