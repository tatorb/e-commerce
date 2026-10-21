
-- CreateEnum
CREATE TYPE "QuestionStatus" AS ENUM ('UNANSWERED', 'ANSWERED', 'CLOSED', 'REMOVED');

-- CreateTable
CREATE TABLE "buyer_questions" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "publicationId" TEXT,
    "text" TEXT NOT NULL,
    "status" "QuestionStatus" NOT NULL,
    "askedAt" TIMESTAMP(3) NOT NULL,
    "buyerId" TEXT,
    "answer" TEXT,
    "answeredAt" TIMESTAMP(3),
    "readAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "buyer_questions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "question_readers" (
    "storeId" TEXT NOT NULL,
    "leaseUntil" TIMESTAMP(3),
    "newestAt" TIMESTAMP(3),
    "historyOffset" INTEGER DEFAULT 0,
    "historyTotal" INTEGER,
    "historyLimited" BOOLEAN NOT NULL DEFAULT false,
    "readAt" TIMESTAMP(3),
    "lastError" TEXT,
    "noticeAt" TIMESTAMP(3),

    CONSTRAINT "question_readers_pkey" PRIMARY KEY ("storeId")
);

-- CreateIndex
CREATE INDEX "buyer_questions_storeId_status_askedAt_idx" ON "buyer_questions"("storeId", "status", "askedAt");

-- CreateIndex
CREATE INDEX "buyer_questions_publicationId_askedAt_idx" ON "buyer_questions"("publicationId", "askedAt");

-- CreateIndex
CREATE INDEX "buyer_questions_storeId_listingId_idx" ON "buyer_questions"("storeId", "listingId");

-- CreateIndex
CREATE UNIQUE INDEX "buyer_questions_storeId_externalId_key" ON "buyer_questions"("storeId", "externalId");

-- AddForeignKey
ALTER TABLE "buyer_questions" ADD CONSTRAINT "buyer_questions_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "buyer_questions" ADD CONSTRAINT "buyer_questions_publicationId_fkey" FOREIGN KEY ("publicationId") REFERENCES "publications"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "question_readers" ADD CONSTRAINT "question_readers_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

