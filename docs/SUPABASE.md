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

## 4b. Trang "Quản trị dữ liệu" trong web (khuyên dùng thay Table Editor)

Menu **Quản lý > Quản trị dữ liệu** (chỉ tài khoản quản lý) có 2 tab.

**Tab Tổng quan** (xem mỗi ngày, số liệu tính trực tiếp từ dữ liệu, không cần nhập):
- Bán hàng hôm nay / 7 ngày / 30 ngày: số đơn, doanh thu, lãi.
- Dòng tiền và công nợ: tổng còn phải trả, quá hạn, phải trả trong 7 ngày, khách còn nợ, tiền trong các nguồn;
  nợ theo chủ nợ; danh sách khoản nợ (hạn trả, đã trả/gốc, còn lại). Nút **Thêm khoản nợ**, **Trả** (ghi một lần trả,
  trừ tiền ở nguồn đã chọn) và **Sửa** (đổi hạn trả, số tiền). Dữ liệu nằm ở bảng `DongTien_PhaiTra`, dùng chung với module Dòng tiền.
- Kho hàng: tổng máy tồn, vốn tồn, lãi dự kiến, tuổi kho, vốn tồn theo mã, tồn kho theo mã với tốc độ bán 30 ngày,
  danh sách "Cần kiểm tra lại" (trống trạng thái, trùng ID/IMEI, đã bán mà vẫn trong kho, giá bán thấp hơn giá nhập), chi tiết từng máy.

**Tab Sửa dữ liệu**: chọn bảng: Kho hàng, Phụ kiện, Khách hàng,
Đơn bán, Đặt cọc, Gói/Hợp đồng bảo hành, Máy gửi bảo hành, CNC, Hoàn trả, Hàng đối tác.

- **Sửa ô**: bấm vào ô, gõ, Enter (xuống dòng dưới) hoặc Tab (sang phải). Ô đã sửa tô vàng.
  Bấm **Lưu** để ghi tất cả một lần, **Huỷ thay đổi** để bỏ.
- **Chống ghi đè**: nếu trong lúc anh sửa mà nhân viên vừa bán/đổi đúng ô đó, ô đó không bị ghi và web báo "xung đột".
- **Tìm** theo IMEI, tên máy, khách (gõ không dấu cũng được). **Lọc** theo Trạng Thái. Bấm tiêu đề cột để **sắp xếp**.
- **Sửa hàng loạt**: tick nhiều dòng, chọn **Sửa hàng loạt**, chọn cột + giá trị (vd đổi Giá Bán, Trạng Thái Kho).
- **Thêm dòng / Xoá dòng** đã chọn.
- **Xuất Excel (CSV)**: tải các dòng đang lọc. **Nhập file**: sửa file đó trong Excel rồi nhập lại; dòng trùng
  mã (ID Máy, ID, SĐT, Mã đơn…) được cập nhật, dòng mới được thêm. Web cho xem trước số dòng sẽ sửa/thêm rồi mới ghi.
- Đổi Trạng Thái máy ở Kho hàng được ghi vào Lịch sử trạng thái máy như các màn hình khác.
- Không mở bảng USERS (mật khẩu) và Dòng tiền ở đây; hai phần đó có màn hình riêng.

## Kiểm thử tự động

`scripts/dev-tools/e2e-test.ts` chạy 231 kiểm tra trên server + database thử ở máy (localhost):
thêm/xem/sửa/xung đột/nhập file/xoá cho 11 bảng, phân quyền, và các luồng nhập kho, sửa máy, CNC, bảo hành,
phụ kiện, khách hàng, đặt cọc, bán hàng, hoàn trả, tiền mặt, ghi chú, ghi đồng thời.

## 5. Sao lưu

- **Tự động mỗi 6 tiếng** (0h, 6h, 12h, 18h giờ VN): GitHub Actions (`.github/workflows/sao-luu-sheet.yml`) gọi
  `/api/cron/sao-luu-sheet`, chép **toàn bộ** Supabase về Google Sheet cũ. Chỉ chạy khi `DATA_BACKEND=postgres`.
  Cần thêm 2 secret ở GitHub repo: **Settings > Secrets and variables > Actions > New repository secret**:
  `APP_URL` (địa chỉ web, vd `https://ten-app.vercel.app`) và `CRON_SECRET` (giống biến trên Vercel).
  Xem lịch sử chạy ở tab **Actions** của repo; bấm **Run workflow** để chạy ngay.
  (Vercel gói Hobby chỉ cho cron 1 lần/ngày nên không đặt lịch này trong `vercel.json`.)
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

Khuyên dùng: bắt đầu **Free** (đã có sao lưu về Sheet mỗi 6 tiếng), lên **Pro** khi chạy 2 cửa hàng.

### Xem thông số ở đâu
- **Dung lượng, băng thông, số kết nối**: supabase.com/dashboard, chọn Organization, mục **Usage**
  (có biểu đồ theo ngày và vạch giới hạn của gói Free).
- **Dữ liệu từng bảng**: chọn project, **Table Editor**; dung lượng từng bảng: **Database > Tables** (cột Size).
- **Tốc độ, truy vấn chậm**: project, **Reports** (API, Database) và **Advisors > Performance**.
- **Tiền**: Organization, **Billing** (gói hiện tại, hoá đơn, Spend cap).

### Khi nào cần trả phí (lên Pro 25 USD/tháng)
Gói Free đủ dùng khi chưa chạm các mốc sau. Nên nâng cấp khi gặp **một trong các trường hợp**:
1. **Database size** ở trang Usage vượt khoảng **400 MB** (giới hạn 500 MB; hiện chỉ vài MB, 2 cửa hàng vẫn còn rất xa).
2. **Egress** (dữ liệu tải ra) gần **5 GB/tháng**.
3. Muốn có **backup tự động hằng ngày** do Supabase giữ (gói Free không có, mình đang bù bằng sao lưu về Sheet mỗi 6 tiếng).
4. Cần chắc chắn không bị **tạm dừng**: gói Free tạm dừng project nếu 7 ngày không có truy cập. Web dùng hằng ngày và
   sao lưu 6 tiếng/lần đều chạm database nên thực tế sẽ không bị dừng.
Supabase gửi email cảnh báo khi gần chạm giới hạn. Trên Pro, giữ **Spend cap** bật thì không bao giờ bị tính quá 25 USD/tháng.

Vercel: mục **Usage** của team.

## Kỹ thuật (cho người sửa code)

- `lib/sheet-store/pg.ts`: đọc/ghi Postgres theo "hình dạng" Sheets (tiêu đề + dòng, địa chỉ ô `P5`, append, clear, xoá dòng).
  Bảng `_sheet_meta` lưu thứ tự cột. Tên tab không phân biệt hoa/thường như Sheets.
- `lib/google-sheets.ts`: mỗi hàm có nhánh `if (USE_POSTGRES)`. Code mới cứ gọi các hàm này như cũ.
  Hàm mới `deleteSheetRows()` thay cho `deleteDimension` gọi trực tiếp.
- Mọi bảng bật RLS, không có policy: chặn truy cập qua API công khai của Supabase; app kết nối bằng user `postgres` nên không bị ảnh hưởng.
- Kiểm thử: `DATABASE_URL=postgres://postgres@localhost:5432/postgres pnpm exec tsx scripts/dev-tools/test-sheet-store.ts`
- Nhánh cũ `dev/migrate` (Prisma, viết lại toàn bộ) không dùng nữa. Về sau có thể chuyển dần từng phần sang bảng có kiểu dữ liệu rõ ràng (vd thêm cột "Cửa hàng" cho chi nhánh 2) mà không phải viết lại một lần.
