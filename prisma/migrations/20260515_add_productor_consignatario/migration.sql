-- CreateEnum
CREATE TYPE "TipoProductor" AS ENUM ('PRODUCTOR', 'CONSIGNATARIO', 'AMBOS');

-- CreateTable
CREATE TABLE "ProductorConsignatario" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "cuit" TEXT,
    "direccion" TEXT,
    "telefono" TEXT,
    "email" TEXT,
    "tipo" "TipoProductor" NOT NULL DEFAULT 'PRODUCTOR',
    "numeroRenspa" TEXT,
    "numeroEstablecimiento" TEXT,
    "localidad" TEXT,
    "provincia" TEXT,
    "observaciones" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductorConsignatario_pkey" PRIMARY KEY ("id")
);
