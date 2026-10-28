-- Registro de productos: pasos sin registro, como preparar o limpiar el lugar,
-- que se marcan Listo por producto y medida.
ALTER TYPE "ShootKind" ADD VALUE 'CHECK';

CREATE TABLE "shoot_checks" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "shootStepId" TEXT NOT NULL,
    "variantKey" TEXT,
    "variantLabel" TEXT,
    "doneById" TEXT,
    "doneAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "shoot_checks_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "shoot_checks_productId_shootStepId_idx" ON "shoot_checks"("productId", "shootStepId");
ALTER TABLE "shoot_checks" ADD CONSTRAINT "shoot_checks_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "shoot_checks" ADD CONSTRAINT "shoot_checks_shootStepId_fkey" FOREIGN KEY ("shootStepId") REFERENCES "shoot_steps"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "shoot_checks" ADD CONSTRAINT "shoot_checks_doneById_fkey" FOREIGN KEY ("doneById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
