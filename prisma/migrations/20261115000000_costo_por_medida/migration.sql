-- El costo de reposición sin IVA de cada medida del producto.
CREATE TABLE "product_costs" (
    "productId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "cost" DECIMAL(14,2) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_costs_pkey" PRIMARY KEY ("productId","key")
);

ALTER TABLE "product_costs" ADD CONSTRAINT "product_costs_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
