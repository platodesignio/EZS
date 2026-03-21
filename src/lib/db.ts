// =============================================================================
// Prisma database client — singleton pattern for Next.js
// Supports both DATABASE_URL and Vercel Postgres integration (POSTGRES_PRISMA_URL)
// =============================================================================

import { PrismaClient } from "@prisma/client";

// Support Vercel Postgres integration which sets POSTGRES_PRISMA_URL instead of DATABASE_URL
if (!process.env.DATABASE_URL && process.env.POSTGRES_PRISMA_URL) {
  process.env.DATABASE_URL = process.env.POSTGRES_PRISMA_URL;
}

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log:
      process.env.NODE_ENV === "development"
        ? ["query", "error", "warn"]
        : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
