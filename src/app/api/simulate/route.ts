import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { SimulateRequestSchema } from "@/types/api";
import { runSimulation } from "@/lib/simulation/engine";
import { parseBuildingGeoJson } from "@/lib/utils/geojson";
import type {
  SimParams,
  EnvParams,
  BoundaryConditions,
  AttractorNode,
  StorageNode,
  SimCell,
} from "@/types/simulation";
import {
  DEFAULT_SIM_PARAMS,
  DEFAULT_ENV_PARAMS,
  DEFAULT_BOUNDARY_CONDITIONS,
} from "@/types/simulation";

export const dynamic = "force-dynamic";
// Simulation can take a few seconds; extend the timeout to 30s
export const maxDuration = 30;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = SimulateRequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: "Invalid input", details: parsed.error.issues },
        { status: 400 }
      );
    }

    const { scenarioId, baselineRunId } = parsed.data;

    // Load scenario
    const scenario = await prisma.scenario.findUnique({
      where: { id: scenarioId },
      include: { project: true },
    });

    if (!scenario) {
      return NextResponse.json(
        { ok: false, error: "Scenario not found" },
        { status: 404 }
      );
    }

    // Load baseline run if provided
    let baselineCells: SimCell[] | null = null;
    let baselineBoundaryConditions: BoundaryConditions | null = null;

    if (baselineRunId) {
      const baselineRun = await prisma.simulationRun.findUnique({
        where: { id: baselineRunId },
        include: {
          scenario: { select: { boundaryConditions: true } },
        },
      });

      if (baselineRun?.cells) {
        baselineCells = baselineRun.cells as unknown as SimCell[];
      }
      if (baselineRun?.scenario?.boundaryConditions) {
        baselineBoundaryConditions =
          baselineRun.scenario.boundaryConditions as unknown as BoundaryConditions;
      }
    }

    // Extract parameters with fallbacks to defaults
    const simParams: SimParams = {
      ...DEFAULT_SIM_PARAMS,
      ...((scenario.simParams as unknown as Partial<SimParams> | null) ?? {}),
    };
    const envParams: EnvParams = {
      ...DEFAULT_ENV_PARAMS,
      ...((scenario.envParams as unknown as Partial<EnvParams> | null) ?? {}),
    };
    const boundaryConditions: BoundaryConditions = {
      ...DEFAULT_BOUNDARY_CONDITIONS,
      ...((scenario.boundaryConditions as unknown as Partial<BoundaryConditions> | null) ?? {}),
    };
    const attractorNodes: AttractorNode[] =
      (scenario.attractorNodes as unknown as AttractorNode[] | null) ?? [];
    const storageNodes: StorageNode[] =
      (scenario.storageNodes as unknown as StorageNode[] | null) ?? [];

    // Parse buildings — fall back to project-level or scenario buildings
    const buildings = parseBuildingGeoJson(scenario.buildingsGeoJson);
    if (buildings.length === 0) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "No valid building geometry found in scenario. " +
            "Upload a GeoJSON file or use the demo district.",
        },
        { status: 422 }
      );
    }

    // Create pending run record
    const runRecord = await prisma.simulationRun.create({
      data: {
        runId: `RUN-PENDING-${Date.now()}`,
        scenarioId,
        status: "RUNNING",
      },
    });

    // Run simulation
    let result;
    try {
      result = await runSimulation({
        scenarioId,
        buildings,
        envParams,
        simParams,
        boundaryConditions,
        attractorNodes,
        storageNodes,
        baselineCells,
        baselineBcUpdate: null,
        baselineBoundaryConditions,
      });
    } catch (simErr) {
      await prisma.simulationRun.update({
        where: { id: runRecord.id },
        data: { status: "FAILED" },
      });
      throw simErr;
    }

    // Persist completed run
    const completedRun = await prisma.simulationRun.update({
      where: { id: runRecord.id },
      data: {
        runId: result.runId,
        status: "COMPLETED",
        cells: result.cells as unknown as Parameters<typeof prisma.simulationRun.update>[0]["data"]["cells"],
        summary: result.summary as unknown as Parameters<typeof prisma.simulationRun.update>[0]["data"]["summary"],
        bcUpdateVector: result.bcUpdateVector as unknown as Parameters<typeof prisma.simulationRun.update>[0]["data"]["bcUpdateVector"],
        bcUpdateMagnitude: result.bcUpdateMagnitude,
        durationMs: result.durationMs,
        completedAt: new Date(),
      },
    });

    return NextResponse.json({
      ok: true,
      data: {
        runId: result.runId,
        runDbId: completedRun.id,
        summary: result.summary,
        durationMs: result.durationMs,
      },
    });
  } catch (err) {
    console.error("[POST /api/simulate]", err);
    return NextResponse.json(
      {
        ok: false,
        error: "Simulation failed",
        details: err instanceof Error ? err.message : String(err),
      },
      { status: 500 }
    );
  }
}
