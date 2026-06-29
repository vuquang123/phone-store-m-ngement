// prisma.config.ts
// Cấu hình Prisma CLI. App dùng .env.local cho secret (gitignored) nên nạp .env.local TRƯỚC,
// sau đó .env (fallback). dotenv không ghi đè biến đã có => .env.local được ưu tiên.
// url/directUrl được khai báo trong schema.prisma qua env() nên ở đây không set datasource.
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });
loadEnv(); // .env

import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    // CLI (migrate/db push) dùng chuỗi DIRECT (5432). Runtime dùng POOLED qua adapter ở lib/prisma.ts.
    url: process.env.DIRECT_URL || process.env.DATABASE_URL,
  },
});
