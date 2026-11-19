-- El formulario de las categorías del canal que no están en la lista fija de la app.
CREATE TABLE "channel_categories" (
    "kind" "ChannelKind" NOT NULL,
    "categoryId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "path" TEXT,
    "fields" JSONB NOT NULL,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "channel_categories_pkey" PRIMARY KEY ("kind","categoryId")
);
