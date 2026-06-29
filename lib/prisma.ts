// lib/prisma.ts
// PrismaClient singleton (server-only). Prisma 7 dùng driver adapter (@prisma/adapter-pg)
// kết nối tới chuỗi POOLED của Supabase (Supavisor 6543, transaction mode).
// Dùng globalThis để tái sử dụng instance qua HMR/dev, tránh cạn connection pool.
// TUYỆT ĐỐI không import file này ở client component.
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "./generated/prisma/client";

const globalForPrisma = globalThis as unknown as { __prisma?: PrismaClient };

function createClient() {
  // Adapter đọc chuỗi POOLED. connection_limit=1 / pool nhỏ phù hợp serverless.
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL, max: 1 });
  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });
}

export const prisma = globalForPrisma.__prisma ?? createClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.__prisma = prisma;
}
