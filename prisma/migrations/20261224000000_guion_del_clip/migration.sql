-- El guión de la voz en off de los clips de cada producto. Solo agrega.
-- CreateTable
CREATE TABLE "video_scripts" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "lines" JSONB NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'persona',
    "updatedById" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "video_scripts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "video_scripts_productId_key" ON "video_scripts"("productId");

-- AddForeignKey
ALTER TABLE "video_scripts" ADD CONSTRAINT "video_scripts_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

