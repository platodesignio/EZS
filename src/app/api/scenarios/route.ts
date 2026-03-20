import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { CreateScenarioSchema } from "@/types/api";
import { parseBuildingGeoJson, computeCentroid, computeSiteExtent } from "@/lib/utils/geojson";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const projectId = req.nextUrl.searchParams.get("projectId");
  if (!projectId) {
    return NextResponse.json(
      { ok: false, error: "projectId required" },
      { status: 400 }
    );
  }

  try {
    const scenarios = await prisma.scenario.findMany({
      where: { projectId },
      orderBy: [{ isBaseline: "desc" }, { createdAt: "asc" }],
      include: {
        runs: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: {
            id: true,
            runId: true,
            status: true,
            summary: true,
            createdAt: true,
          },
        },
      },
    });
    return NextResponse.json({ ok: true, data: scenarios });
  } catch (err) {
    console.error("[GET /api/scenarios]", err);
    return NextResponse.json(
      { ok: false, error: "Failed to load scenarios" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = CreateScenarioSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: "Invalid input", details: parsed.error.issues },
        { status: 400 }
      );
    }

    const { projectId, buildingsGeoJson, ...rest } = parsed.data;

    // Verify project exists
    const project = await prisma.project.findUnique({ where: { id: projectId } });
    if (!project) {
      return NextResponse.json(
        { ok: false, error: "Project not found" },
        { status: 404 }
      );
    }

    // Update project extent if buildings provided
    if (buildingsGeoJson) {
      const buildings = parseBuildingGeoJson(buildingsGeoJson);
      const centroid = computeCentroid(buildings);
      const extent = computeSiteExtent(buildings);
      if (centroid && extent) {
        await prisma.project.update({
          where: { id: projectId },
          data: { centroid, siteExtent: extent },
        });
      }
    }

    const scenario = await prisma.scenario.create({
      data: {
        projectId,
        buildingsGeoJson: buildingsGeoJson ?? undefined,
        ...rest,
      },
    });

    return NextResponse.json({ ok: true, data: scenario }, { status: 201 });
  } catch (err) {
    console.error("[POST /api/scenarios]", err);
    return NextResponse.json(
      { ok: false, error: "Failed to create scenario" },
      { status: 500 }
    );
  }
}
