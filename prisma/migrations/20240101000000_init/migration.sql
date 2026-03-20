-- CreateEnum
CREATE TYPE "RunStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "UploadType" AS ENUM ('GEOJSON_BUILDINGS', 'CSV_ENVIRONMENT');

-- CreateEnum
CREATE TYPE "ConversionLayerType" AS ENUM ('PHOTOVOLTAIC', 'PIEZOELECTRIC', 'THERMOELECTRIC', 'HYBRID');

-- CreateEnum
CREATE TYPE "SolarConditionProfile" AS ENUM ('CLEAR', 'PARTLY_CLOUDY', 'OVERCAST');

-- CreateEnum
CREATE TYPE "RoofOrientationClass" AS ENUM ('FLAT', 'PITCHED_NS', 'PITCHED_EW', 'MIXED');

-- CreateEnum
CREATE TYPE "SurfaceExposureClass" AS ENUM ('STANDARD', 'HIGH_ALBEDO', 'GREEN_ROOF', 'PV_PANEL');

-- CreateTable
CREATE TABLE "Project" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "siteExtent" JSONB,
    "centroid" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Scenario" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isBaseline" BOOLEAN NOT NULL DEFAULT false,
    "buildingsGeoJson" JSONB,
    "envParams" JSONB,
    "simParams" JSONB,
    "boundaryConditions" JSONB,
    "attractorNodes" JSONB,
    "storageNodes" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Scenario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SimulationRun" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "scenarioId" TEXT NOT NULL,
    "status" "RunStatus" NOT NULL DEFAULT 'PENDING',
    "cells" JSONB,
    "summary" JSONB,
    "bcUpdateVector" JSONB,
    "bcUpdateMagnitude" DOUBLE PRECISION,
    "durationMs" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "SimulationRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Upload" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "type" "UploadType" NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Upload_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RunFeedback" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "publicRunId" TEXT NOT NULL,
    "comment" TEXT NOT NULL,
    "rating" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RunFeedback_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SimParamsPreset" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "params" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SimParamsPreset_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Project_createdAt_idx" ON "Project"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "SimulationRun_runId_key" ON "SimulationRun"("runId");

-- CreateIndex
CREATE INDEX "SimulationRun_scenarioId_idx" ON "SimulationRun"("scenarioId");

-- CreateIndex
CREATE INDEX "SimulationRun_runId_idx" ON "SimulationRun"("runId");

-- CreateIndex
CREATE INDEX "SimulationRun_status_idx" ON "SimulationRun"("status");

-- CreateIndex
CREATE INDEX "SimulationRun_createdAt_idx" ON "SimulationRun"("createdAt");

-- CreateIndex
CREATE INDEX "Scenario_projectId_idx" ON "Scenario"("projectId");

-- CreateIndex
CREATE INDEX "Scenario_projectId_isBaseline_idx" ON "Scenario"("projectId", "isBaseline");

-- CreateIndex
CREATE INDEX "Upload_projectId_idx" ON "Upload"("projectId");

-- CreateIndex
CREATE INDEX "RunFeedback_runId_idx" ON "RunFeedback"("runId");

-- CreateIndex
CREATE INDEX "RunFeedback_publicRunId_idx" ON "RunFeedback"("publicRunId");

-- AddForeignKey
ALTER TABLE "Scenario" ADD CONSTRAINT "Scenario_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SimulationRun" ADD CONSTRAINT "SimulationRun_scenarioId_fkey" FOREIGN KEY ("scenarioId") REFERENCES "Scenario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Upload" ADD CONSTRAINT "Upload_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RunFeedback" ADD CONSTRAINT "RunFeedback_runId_fkey" FOREIGN KEY ("runId") REFERENCES "SimulationRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;
