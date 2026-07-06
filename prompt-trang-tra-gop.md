# Prompt: Xây trang /cong-cu-mua-iphone (mục #tra-gop)

Dán prompt dưới đây cho Claude Code (hoặc agent code khác) đang mở project
`phone-store-m-ngement` (Next.js 15 App Router, TypeScript, Tailwind, shadcn/ui,
lucide-react) để triển khai.

---

## Yêu cầu

Tạo trang public (không cần đăng nhập, không nằm trong `/dashboard`) tại
route `/cong-cu-mua-iphone`, có một section với `id="tra-gop"` để có thể
truy cập trực tiếp qua `/cong-cu-mua-iphone#tra-gop`. Mục đích: khách hàng
tự xem sơ bộ các hình thức trả góp khi mua iPhone, chọn khoản vay + kỳ hạn
và thấy ngay lãi ước tính + tổng tiền phải trả. Đây là **công cụ tham khảo**,
không phải báo giá chính thức — luôn hiển thị disclaimer "chỉ mang tính tham
khảo, số tiền thực tế tùy chính sách từng đối tác tại thời điểm mua".

### Cấu trúc file

- `app/cong-cu-mua-iphone/page.tsx` — server component, render metadata + client component.
- `components/cong-cu-mua-iphone/tra-gop-section.tsx` — `"use client"`, chứa toàn bộ UI + logic tính toán.
- `lib/tra-gop-data.ts` — export các hằng số/hàm tính lãi cho 3 hình thức bên dưới, để tách data khỏi UI.

### 3 hình thức trả góp cần hiển thị (dùng Tabs hoặc Accordion từ `components/ui/tabs` hoặc `components/ui/accordion` đã có sẵn trong repo)

**1. Trả góp qua HD Saison / Mirae Asset**
Lãi suất cơ bản theo kỳ hạn (áp dụng trên tổng khoản vay, không cần bảng tra cứu chi tiết — dùng % làm tròn):
- 6 tháng: 20%
- 8 tháng: 16%
- 12 tháng: 11.5%

Công thức:
```
Tiền lãi  = Khoản vay × Lãi suất(%) theo kỳ hạn
Tổng tiền = Khoản vay + Tiền lãi
```

**2. Trả góp qua iCloud**
Lãi 8%/tháng trên nợ gốc, kỳ hạn chọn từ 1–6 tháng.
```
Lãi/tháng = Khoản vay × 8%
Tổng lãi  = Lãi/tháng × Số tháng
Tổng tiền = Khoản vay + Tổng lãi
```

**3. Trả góp qua thẻ tín dụng ngân hàng**
Đây là bảng **tham khảo tĩnh** (không cần tính toán chính xác theo khoản vay cụ thể — chỉ hiển thị để khách xem qua), hiển thị dạng bảng hoặc card list:

| Ngân hàng | Mô hình | Phí/lãi ước tính | Kỳ hạn |
|---|---|---|---|
| Sacombank | 0% lãi + phí chuyển đổi | ~1.99% (3 tháng), tăng dần theo kỳ hạn | 3–24 tháng |
| Techcombank | 0% lãi + phí chuyển đổi | ~1.1%/tháng × số tháng | 3–12 (48 ở vài đối tác) |
| ACB | 0% lãi + phí chuyển đổi | 3th: 0% / 6th: 3.99% / 9th: 5.99% / 12th: 7.99% | 3–12 tháng |
| VPBank | 0% lãi + phí, hoặc không phí + lãi tháng | Phí 2–3% hoặc lãi 0.5–1%/tháng | 3–36 tháng |
| TPBank | 0% lãi + phí chuyển đổi | Phí cố định thấp (~55,000đ) | 3/6/9/12 tháng |
| VIB | 0% lãi ban đầu + phí | Phí dao động theo kỳ hạn (xác nhận tại quầy) | 3–36 tháng |
| HSBC | Phí chuyển đổi (một số đối tác 0%) | ~2–4.5% | 3–36 tháng |
| Shinhan Bank | 0% lãi, không phí (theo đối tác) | 0% | đến 12 tháng |
| MB Bank | 0% lãi, phí quản lý | ~0.8%/tháng | 3/6/9/12/18/24 tháng |
| SHB | 0% tại đối tác SHB | Phí áp dụng ngoài đối tác | — |
| BIDV | 0% lãi (nếu thanh toán đúng hạn) | Phí ~2.99% (6 tháng) | theo kỳ hạn |
| HDBank | 0% lãi + phí | ~3.5% (3–6 tháng) | 3–36 tháng |
| Eximbank | 0% lãi, miễn phí tại đối tác; hoặc lãi ưu đãi | Lãi giảm dần: 3th 1.13%/th → 12th 0.92%/th | 3–12 tháng |

Ghi chú kèm theo bảng: "Ưu đãi thay đổi theo thời gian và chính sách từng ngân hàng/đối tác, khách vui lòng xác nhận lại tại quầy hoặc với ngân hàng phát hành thẻ."

### UI/UX

- Input chung: ô nhập/slider "Số tiền cần trả góp" (mặc định ví dụ 20,000,000đ), dropdown chọn hình thức (1 trong 3), dropdown chọn kỳ hạn (options thay đổi theo hình thức đã chọn: HD Saison/Mirae → 6/8/12; iCloud → 1–6; thẻ tín dụng → không tính, chỉ xem bảng).
- Kết quả hiển thị bằng `Card`: "Tiền lãi ước tính" và "Tổng tiền phải trả", format tiền VNĐ (dùng `toLocaleString("vi-VN")`).
- Responsive, dùng Tailwind + các component sẵn có trong `components/ui` (Card, Tabs/Accordion, Select, Input, Badge).
- Không cần gọi API hay lưu DB — toàn bộ tính toán client-side.

### Việc cần làm

1. Tạo `lib/tra-gop-data.ts` export: `hdSaisonMiraeRates`, hàm `calcICloud(loanAmount, months)`, và mảng `bankCreditCardOptions`.
2. Tạo `components/cong-cu-mua-iphone/tra-gop-section.tsx` implement UI + logic trên, đảm bảo section có `id="tra-gop"`.
3. Tạo `app/cong-cu-mua-iphone/page.tsx` import và render section (thêm heading giới thiệu công cụ ở trên nếu muốn mở rộng thêm mục khác sau này).
4. Test: `npm run dev`, mở `/cong-cu-mua-iphone#tra-gop`, thử với vài mức tiền để đảm bảo công thức đúng như trên.
