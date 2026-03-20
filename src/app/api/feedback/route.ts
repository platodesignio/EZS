import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { FeedbackSchema } from "@/types/api";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = FeedbackSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: "Invalid input", details: parsed.error.issues },
        { status: 400 }
      );
    }

    const { runId: publicRunId, comment, rating } = parsed.data;

    // Look up the database run record by public run ID
    const run = await prisma.simulationRun.findUnique({
      where: { runId: publicRunId },
      select: { id: true },
    });

    if (!run) {
      return NextResponse.json(
        { ok: false, error: "Run not found. Feedback not saved." },
        { status: 404 }
      );
    }

    const feedback = await prisma.runFeedback.create({
      data: {
        runId: run.id,
        publicRunId,
        comment,
        rating: rating ?? null,
      },
    });

    return NextResponse.json(
      { ok: true, data: { id: feedback.id } },
      { status: 201 }
    );
  } catch (err) {
    console.error("[POST /api/feedback]", err);
    return NextResponse.json(
      { ok: false, error: "Failed to save feedback" },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  const runId = req.nextUrl.searchParams.get("runId");
  try {
    const feedback = await prisma.runFeedback.findMany({
      where: runId ? { publicRunId: runId } : undefined,
      orderBy: { createdAt: "desc" },
      take: 50,
    });
    return NextResponse.json({ ok: true, data: feedback });
  } catch (err) {
    console.error("[GET /api/feedback]", err);
    return NextResponse.json(
      { ok: false, error: "Failed to load feedback" },
      { status: 500 }
    );
  }
}
