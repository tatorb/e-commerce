-- Usuarios: administrador, permisos por sección, baja y contraseña temporal.
ALTER TABLE "users" ADD COLUMN "isAdmin" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "permissions" JSONB NOT NULL DEFAULT '{}',
ADD COLUMN "disabledAt" TIMESTAMP(3),
ADD COLUMN "mustChangePassword" BOOLEAN NOT NULL DEFAULT false;

-- Los que ya estaban pasan a ser administradores: nadie pierde acceso.
UPDATE "users" SET "isAdmin" = true;

-- Las cuentas que ve cada usuario que no es administrador.
CREATE TABLE "user_accounts" (
    "userId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_accounts_pkey" PRIMARY KEY ("userId","accountId")
);
CREATE INDEX "user_accounts_accountId_idx" ON "user_accounts"("accountId");
ALTER TABLE "user_accounts" ADD CONSTRAINT "user_accounts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "user_accounts" ADD CONSTRAINT "user_accounts_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Lo que hace cada persona.
CREATE TYPE "ActivityKind" AS ENUM ('CHANGE', 'SIGN_IN', 'SIGN_IN_FAILED', 'SIGN_OUT');
CREATE TYPE "ActivitySource" AS ENUM ('APP', 'CLAUDE');
CREATE TABLE "activity_logs" (
    "id" SERIAL NOT NULL,
    "userId" TEXT,
    "email" TEXT,
    "accountId" TEXT,
    "kind" "ActivityKind" NOT NULL,
    "section" TEXT,
    "summary" TEXT NOT NULL,
    "publicationId" TEXT,
    "productId" TEXT,
    "targetLabel" TEXT,
    "detail" TEXT,
    "via" "ActivitySource" NOT NULL DEFAULT 'APP',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "activity_logs_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "activity_logs_createdAt_idx" ON "activity_logs"("createdAt");
CREATE INDEX "activity_logs_userId_createdAt_idx" ON "activity_logs"("userId", "createdAt");
CREATE INDEX "activity_logs_accountId_createdAt_idx" ON "activity_logs"("accountId", "createdAt");
ALTER TABLE "activity_logs" ADD CONSTRAINT "activity_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "activity_logs" ADD CONSTRAINT "activity_logs_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
