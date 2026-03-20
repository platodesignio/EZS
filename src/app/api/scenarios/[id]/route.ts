import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { UpdateScenarioSchema } from "@/types/api";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const scenario = await prisma.scenario.findUnique({
      where: { id: params.id },
      include: {
        runs: {
          orderBy: { createdAt: "desc" },
          take: 5,
          select: {
            id: true,
            runId: true,
            status: true,
            summary: true,
            bcUpdateMagnitude: true,
            createdAt: true,
            completedAt: true,
            durationMs: true,
          },
        },
      },
    });

    if (!scenario) {
      return NextResponse.json(
        { ok: false, error: "Scenario not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ ok: true, data: scenario });
  } catch (err) {
    console.error("[GET /api/scenarios/[id]]", err);
    return NextResponse.json(
      { ok: false, error: "Failed to load scenario" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await req.json();
    const parsed = UpdateScenarioSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: "Invalid input", details: parsed.error.issues },
        { status: 400 }
      );
    }

    const scenario = await prisma.scenario.update({
      where: { id: params.id },
      data: parsed.data,
    });

    return NextResponse.json({ ok: true, data: scenario });
  } catch (err) {
    console.error("[PATCH /api/scenarios/[id]]", err);
    return NextResponse.json(
      { ok: false, error: "Failed to update scenario" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await prisma.scenario.delete({ where: { id: params.id } });
    return NextResponse.json({ ok: true, data: { id: params.id } });
  } catch (err) {
    console.error("[DELETE /api/scenarios/[id]]", err);
    return NextResponse.json(
      { ok: false, error: "Failed to delete scenario" },
      { status: 500 }
    );
  }
}
