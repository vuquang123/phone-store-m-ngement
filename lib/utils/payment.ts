// ---------------------------------------------------------------------------
// Tách chuỗi "Hình Thức Thanh Toán" trong sheet Ban_Hang thành từng khoản.
//
// Sheet lưu dạng chuỗi gộp chứ không phải số, với rất nhiều biến thể do gõ tay
// qua nhiều năm: "Tiền mặt: ₫5.000.000 | Chuyển khoản: ₫10.000.000",
// "CK 15.500.000", "The: 1,000,000đ"...
//
// Trước đây hàm này nằm lọt trong order-detail-dialog.tsx. Tách ra đây để trang
// tổng kết ca dùng lại — hai bản parser riêng chắc chắn sẽ trôi lệch nhau, và
// lệch ở đây nghĩa là tiền trên dashboard không khớp đơn hàng.
// ---------------------------------------------------------------------------

export type PaymentPart = { label: string; amount: number }

function stripDiacritics(t: string) {
  return String(t || "")
    .normalize("NFD")
    // @ts-ignore - lớp ký tự dấu, cần target ES2018+
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
}

/**
 * Khoản shop TRẢ LẠI cho khách (thu máy cũ xuống đời). Chuỗi này cũng chứa
 * "tiền mặt"/"chuyển khoản" nên phải xét TRƯỚC khi nhận diện phương thức,
 * nếu không sẽ bị cộng vào doanh thu thay vì trừ đi.
 */
export function isRefundPart(t: string) {
  return stripDiacritics(t).includes("tra lai khach")
}

function friendlyLabel(t: string) {
  const n = stripDiacritics(t)
  if (isRefundPart(t)) return /(chuyen\s*khoan)/.test(n) ? "Trả lại khách (CK)" : "Trả lại khách (tiền mặt)"
  if (/(chuyen\s*khoan|\bck\b|bank|stk)/.test(n)) return "Chuyển khoản"
  if (/(tien\s*mat|cash)/.test(n)) return "Tiền mặt"
  if (/(\bthe\b|pos|card)/.test(n)) return "Thẻ"
  if (/(tra\s*gop|tragop|installment|credit|gop)/.test(n)) return "Trả góp"
  return (t.includes(":") ? t.split(":")[0] : t).trim()
}

/**
 * Ép một ô tiền trong sheet về số.
 *
 * Sheet trộn hai kiểu ghi trong cùng một cột: "5.390.000 đ" (đã format, dấu
 * chấm là phân cách hàng nghìn) và "4483000" (số trần). Nếu chỉ bỏ ký tự không
 * phải số mà GIỮ dấu chấm thì Number("5.390.000") = NaN -> ra 0, tức là doanh
 * thu biến mất. Phải bỏ dấu phân cách trước.
 */
export function parseMoney(raw: any): number {
  const s = String(raw ?? "").trim()
  if (!s) return 0
  const cleaned = s
    .replace(/[.,](?=\d{3}(\D|$))/g, "") // bỏ phân cách hàng nghìn
    .replace(/[^\d-]/g, "")
  const n = Number(cleaned)
  return Number.isFinite(n) ? n : 0
}

function firstAmount(part: string): number {
  const pick = (s: string) => {
    const m = s.match(/\d[\d.,]*/)
    if (!m) return null
    // Bỏ dấu phân cách hàng nghìn ("12.800.000" / "12,800,000") rồi ép số.
    const n = Number(m[0].replace(/[.,](?=\d{3}\b)/g, "").replace(/[^\d-]/g, ""))
    return Number.isFinite(n) ? n : null
  }

  // Đơn trả góp ghi gộp 2 số: "HDSaison: Trả trước ₫2.500.000 + Góp ₫8.390.000".
  // Khoản tính vào giá trị đơn là phần GÓP, còn "trả trước" đã nằm ở dòng tiền
  // mặt/chuyển khoản khác rồi — lấy số đầu tiên là vừa thiếu vừa trùng.
  // (Đối chiếu DH02037 và DH02043 trên sheet: lấy phần Góp thì tổng khớp
  // chính xác với cột "Tổng Thu", lấy phần trả trước thì lệch.)
  if (part.includes("+")) {
    const last = part.split("+").pop() || ""
    const v = pick(last)
    if (v !== null) return v
  }

  const direct = pick(part)
  if (direct !== null) return direct
  const after = part.match(/:(.*)$/)
  return (after && pick(after[1])) || 0
}

/** Tách chuỗi thanh toán thành các khoản; khoản trả lại khách mang dấu âm. */
export function parsePaymentBreakdown(raw: string): PaymentPart[] {
  const s = String(raw || "").trim()
  if (!s) return []
  return s
    .split(/\|/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => {
      const amount = firstAmount(p)
      return { label: friendlyLabel(p), amount: isRefundPart(p) ? -amount : amount }
    })
    .filter((p) => !!p.label)
}

/** Gộp theo phương thức: { "Tiền mặt": 5000000, "Chuyển khoản": 10000000 }. */
export function sumByMethod(raw: string): Record<string, number> {
  const out: Record<string, number> = {}
  for (const { label, amount } of parsePaymentBreakdown(raw)) {
    out[label] = (out[label] || 0) + amount
  }
  return out
}
