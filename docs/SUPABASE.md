# Chạy web quản lý bằng Supabase thay cho Google Sheets

## Ý tưởng

Mỗi tab của Google Sheet được chép thành **một bảng cùng tên** trong Supabase (Postgres):
tab `Kho_Hang` thành bảng `Kho_Hang`, cột `Giá Bán` vẫn là cột `Giá Bán`. Cột `_row` giữ số dòng như trên Sheet.

Toàn bộ code nghiệp vụ (bán hàng, kho, dòng tiền, check-in…) **không đổi**. Chỉ có `lib/google-sheets.ts`
đổi "động cơ" bên dưới: khi `DATA_BACKEND=postgres`, mọi lệnh đọc/ghi đi vào Supabase (`lib/sheet-store/`).

| | Google Sheets | Supabase |
|---|---|---|
| Một lần đọc dữ liệu | 1 đến 3 giây | 10 đến 50 ms |
| Lỗi quota 429 khi đông người dùng | Có | Không |
| Hai người nhập kho cùng lúc đè dòng nhau | Có thể | Không (có khoá) |
| Sửa tay, lọc, xuất CSV | Có | Có (Table Editor) |

Quay lại Google Sheets: xoá biến `DATA_BACKEND` trên Vercel rồi Redeploy (xem mục 6).

---

## 1. Tạo Supabase (làm 1 lần)

1. Vào https://supabase.com, đăng nhập Google, chọn **New project**.
2. Region: **Southeast Asia (Singapore)**. Đặt **Database password** và lưu lại.
3. Vào **Project Settings, Database, Connection string**. Copy 2 chuỗi, thay `[YOUR-PASSWORD]`:
   - **Transaction pooler** (cổng 6543) là `DATABASE_URL`
   - **Session pooler** (cổng 5432) là `DIRECT_URL`
4. Dán vào `.env.local` ở máy:
   ```
   DATABASE_URL="postgresql://postgres.xxxx:MATKHAU@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres"
   DIRECT_URL="postgresql://postgres.xxxx:MATKHAU@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres"
   ```

## 2. Chép dữ liệu thử (không ảnh hưởng web đang chạy)

```bash
pnpm install
pnpm db:import        # chép 30 tab, cuối cùng in bảng "khớp: OK" cho từng tab
```
Chạy lại bao nhiêu lần cũng được: mỗi lần chạy, bảng cũ bị xoá và chép lại từ Sheet.
`pnpm db:check` chỉ so sánh Sheet với Supabase, không ghi gì.

Chạy thử app ở máy với Supabase:
```bash
DATA_BACKEND=postgres pnpm dev
```

## 3. Chuyển hẳn sang Supabase (nên làm buổi tối, sau giờ bán)

1. Báo nhân viên ngừng thao tác trên web khoảng 10 phút.
2. `pnpm db:import` để chép dữ liệu mới nhất. Đợi đủ 30 tab **OK**.
3. Vercel, chọn **Settings, Environment Variables** (môi trường Production) và thêm:
   - `DATA_BACKEND` = `postgres`
   - `DATABASE_URL` = chuỗi cổng 6543
4. **Deployments**, chọn bản mới nhất, bấm **Redeploy**.
5. Mở web, kiểm tra kho, bán hàng, dòng tiền.

Từ lúc này **đừng sửa Google Sheet nữa**: Sheet chỉ còn là bản sao lưu, mỗi đêm bị ghi đè (mục 5).

## 4. Sửa dữ liệu bằng tay

Supabase, mục **Table Editor**, chọn bảng (vd `Kho_Hang`):
- Bấm vào ô để sửa, Enter để lưu. Có lọc (Filter), sắp xếp (Sort), tìm kiếm.
- **Insert row** để thêm dòng; để trống `_row`, hệ thống tự đánh số cuối bảng.
- **Export to CSV** để tải về mở bằng Excel. **Import data from CSV** để nhập hàng loạt.
- Đừng đổi tên/xoá cột hoặc bảng trong Supabase: app đọc theo tên cột như trên Sheet.
- Xoá dòng ở giữa bảng chỉ để lại một dòng trống (giống xoá nội dung dòng trên Sheet), không sao.

Muốn xem bằng câu lệnh: **SQL Editor**, ví dụ
```sql
select "Tên Sản Phẩm", count(*) from "Kho_Hang" where "Trạng Thái" ilike 'còn hàng' group by 1 order by 2 desc;
```

## 5. Sao lưu

- **Tự động mỗi đêm (00:00 giờ VN)**: cron `/api/cron/sao-luu-sheet` chép toàn bộ Supabase về Google Sheet cũ.
  Sheet luôn có bản sao mới nhất để xem hoặc tải Excel. Chỉ chạy khi `DATA_BACKEND=postgres`.
- **Sao lưu tay** bất kỳ lúc nào: `pnpm db:export --yes` (ghi đè Google Sheet bằng dữ liệu Supabase).
- Gói **Supabase Pro** có thêm backup tự động hằng ngày, giữ 7 ngày, khôi phục bằng 1 nút.

## 6. Quay lại Google Sheets (nếu có sự cố)

1. `pnpm db:export --yes` để đưa dữ liệu mới nhất từ Supabase về Sheet (nếu Supabase còn truy cập được).
2. Vercel: xoá biến `DATA_BACKEND`, rồi Redeploy. App chạy lại bằng Google Sheets như cũ.

## 7. Chi phí và theo dõi

| Dịch vụ | Gói | Giá | Ghi chú |
|---|---|---|---|
| Supabase | Free | 0đ | 500 MB (dữ liệu hiện ~ vài MB), không có backup tự động, **tạm dừng nếu 7 ngày không ai dùng** |
| Supabase | Pro | 25 USD/tháng (~650k) | Backup hằng ngày 7 ngày, không bao giờ tạm dừng, 8 GB |
| Vercel | giữ gói hiện tại | | Máy chủ đặt ở Singapore (`vercel.json` > `regions: sin1`) để gần Supabase |

Khuyên dùng: bắt đầu **Free** (đã có sao lưu về Sheet mỗi đêm), lên **Pro** khi chạy 2 cửa hàng.

Theo dõi: Supabase, mục **Project Settings, Usage** (dung lượng, băng thông);
**Organization, Billing** để đặt/giữ **Spend cap** (bật sẵn trên Pro, không bao giờ bị tính vượt 25 USD).
Vercel: mục **Usage**.

## Kỹ thuật (cho người sửa code)

- `lib/sheet-store/pg.ts`: đọc/ghi Postgres theo "hình dạng" Sheets (tiêu đề + dòng, địa chỉ ô `P5`, append, clear, xoá dòng).
  Bảng `_sheet_meta` lưu thứ tự cột. Tên tab không phân biệt hoa/thường như Sheets.
- `lib/google-sheets.ts`: mỗi hàm có nhánh `if (USE_POSTGRES)`. Code mới cứ gọi các hàm này như cũ.
  Hàm mới `deleteSheetRows()` thay cho `deleteDimension` gọi trực tiếp.
- Mọi bảng bật RLS, không có policy: chặn truy cập qua API công khai của Supabase; app kết nối bằng user `postgres` nên không bị ảnh hưởng.
- Kiểm thử: `DATABASE_URL=postgres://postgres@localhost:5432/postgres pnpm exec tsx scripts/dev-tools/test-sheet-store.ts`
- Nhánh cũ `dev/migrate` (Prisma, viết lại toàn bộ) không dùng nữa. Về sau có thể chuyển dần từng phần sang bảng có kiểu dữ liệu rõ ràng (vd thêm cột "Cửa hàng" cho chi nhánh 2) mà không phải viết lại một lần.
