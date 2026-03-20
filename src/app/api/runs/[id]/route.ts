import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Accept either the public runId or the database id
    const run = await prisma.simulationRun.findFirst({
      where: {
        OR: [{ id: params.id }, { runId: params.id }],
      },
      select: {
        id: true,
        runId: true,
        scenarioId: true,
        status: true,
        cells: true,
        summary: true,
        bcUpdateVector: true,
        bcUpdateMagnitude: true,
        durationMs: true,
        createdAt: true,
        completedAt: true,
      },
    });

    if (!run) {
      return NextResponse.json(
        { ok: false, error: "Run not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ ok: true, data: run });
  } catch (err) {
    console.error("[GET /api/runs/[id]]", err);
    return NextResponse.json(
      { ok: false, error: "Failed to load run" },
      { status: 500 }
    );
  }
}
