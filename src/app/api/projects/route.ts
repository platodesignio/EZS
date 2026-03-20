import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { CreateProjectSchema } from "@/types/api";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const projects = await prisma.project.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        _count: { select: { scenarios: true } },
      },
    });
    return NextResponse.json({ ok: true, data: projects });
  } catch (err) {
    console.error("[GET /api/projects]", err);
    return NextResponse.json(
      { ok: false, error: "Failed to load projects" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = CreateProjectSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: "Invalid input", details: parsed.error.issues },
        { status: 400 }
      );
    }

    const project = await prisma.project.create({
      data: {
        name: parsed.data.name,
        description: parsed.data.description ?? null,
      },
    });

    return NextResponse.json({ ok: true, data: project }, { status: 201 });
  } catch (err) {
    console.error("[POST /api/projects]", err);
    return NextResponse.json(
      { ok: false, error: "Failed to create project" },
      { status: 500 }
    );
  }
}
