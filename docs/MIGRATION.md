# Migrate Google Sheets → Supabase (Postgres) + Prisma

Nhánh: `dev/migrate`. Chiến lược: **Hybrid theo nhóm** — giữ `lib/google-sheets.ts` cho phần
chưa chuyển; chuyển từng nhóm sang Prisma, sau mỗi nhóm app vẫn chạy được.

## Quyết định kỹ thuật (Prisma 7)
- **Driver adapter**: Prisma 7 không còn engine đọc URL trực tiếp → dùng `@prisma/adapter-pg`
  (`lib/prisma.ts`) kết nối chuỗi **POOLED** (Supavisor 6543, transaction mode).
- **Connection URLs nằm ở `prisma.config.ts`** (Prisma 7 bỏ `url`/`directUrl` trong schema):
  - Runtime → `DATABASE_URL` (pooled) qua adapter.
  - CLI `prisma migrate` → `DIRECT_URL` (5432), set trong `prisma.config.ts > datasource.url`.
- `prisma.config.ts` nạp `.env.local` trước rồi `.env` (app dùng `.env.local`).
- Tiền = `Int` (VND). Ngày = `@db.Timestamptz(3)` (parse zone Asia/Ho_Chi_Minh).
- Tên cột tiếng Anh snake_case (`@map`/`@@map`), giữ ý nghĩa cũ để đối chiếu.

## Bước chạy (sau khi tạo project Supabase, region Singapore)
1. Lấy 2 chuỗi ở **Supabase → Project Settings → Database → Connection string**, điền vào `.env.local`:
   ```
   DATABASE_URL="postgresql://postgres.<ref>:<pwd>@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1"
   DIRECT_URL="postgresql://postgres.<ref>:<pwd>@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres"
   ```
2. Tạo bảng (chạy migration đầu tiên):
   ```
   pnpm db:migrate      # prisma migrate dev  (dùng DIRECT_URL)
   ```
3. Nạp dữ liệu cũ từ Sheets → Postgres (idempotent, in bảng đối chiếu số dòng):
   ```
   pnpm db:migrate-data # tsx scripts/migrate-sheets-to-pg.ts
   ```
   Cảnh báo (mã trùng/thiếu khóa) ghi ra `scripts/migrate-issues.log`.
4. Kiểm tra dữ liệu:
   ```
   pnpm db:studio
   ```
5. Deploy production: `pnpm db:deploy` (prisma migrate deploy).

## Lệnh hữu ích
| Lệnh | Việc |
|---|---|
| `pnpm db:generate` | Sinh Prisma Client (`lib/generated/prisma`) |
| `pnpm db:migrate` | Tạo + áp migration (dev) |
| `pnpm db:deploy` | Áp migration (prod) |
| `pnpm db:studio` | GUI xem/sửa dữ liệu |
| `pnpm db:migrate-data` | Nạp dữ liệu Sheets → PG |

## Thứ tự chuyển lớp đọc/ghi (mỗi nhóm xong app vẫn chạy)
1. **users + auth** — `login`, `auth/me`, `nhan-vien`, `nhan-vien/[id]`
2. **products (kho)** — `kho-hang/*`, `update-product-status`, `lich-su-trang-thai-may`
3. **customers** — `khach-hang`
4. **orders / bán hàng** — `ban-hang` (dùng `prisma.$transaction` chống bán trùng), `ban-hang/[orderId]`, `hoan-tra`
5. **còn lại** — `dat-coc`, `phu-kien`, `cnc/doi-tac`, `tien-mat`, `thong-bao`, `warranties`, `check-in/out`, `dashboard`, `public/*`

> Flow bán hàng: thay Saga journal/idempotency bằng **1 giao dịch Postgres** — trong cùng
> `prisma.$transaction`, `updateMany` máy `where trangThai='Còn hàng'` (kiểm tra `count===1`) rồi
> tạo Order/OrderItem/WarrantyContract. 2 nhân viên không thể bán trùng 1 máy.

## Trạng thái hiện tại
- [x] Schema đầy đủ (`prisma/schema.prisma`) — valid.
- [x] `lib/prisma.ts` singleton + adapter.
- [x] Script migrate dữ liệu (`scripts/migrate-sheets-to-pg.ts`) — typecheck sạch.
- [ ] Tạo Supabase + chạy `db:migrate` + `db:migrate-data` (cần bạn cấp URL).
- [ ] Chuyển lớp đọc/ghi theo 5 nhóm ở trên.
