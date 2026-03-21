import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { cellsToCSV } from "@/lib/utils/export";
import type { SimCell } from "@/types/simulation";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const run = await prisma.simulationRun.findFirst({
      where: {
        OR: [{ id }, { runId: id }],
      },
      select: {
        runId: true,
        status: true,
        cells: true,
      },
    });

    if (!run) {
      return NextResponse.json(
        { ok: false, error: "Run not found" },
        { status: 404 }
      );
    }

    if (run.status !== "COMPLETED" || !run.cells) {
      return NextResponse.json(
        { ok: false, error: "Run not yet completed or has no cell data" },
        { status: 422 }
      );
    }

    const cells = run.cells as unknown as SimCell[];
    const csv = cellsToCSV(cells, run.runId);

    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="gpse_${run.runId}.csv"`,
      },
    });
  } catch (err) {
    console.error("[GET /api/runs/[id]/export]", err);
    return NextResponse.json(
      { ok: false, error: "Export failed" },
      { status: 500 }
    );
  }
}
