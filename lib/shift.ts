// ---------------------------------------------------------------------------
// Ca làm việc trong ngày — dùng chung cho trang tổng kết ca.
//
// Khớp với cột "Ca" sẵn có trong sheet Check_in (nhân viên đã check-in theo
// ca 1/2/3 từ trước), để hai nơi không nói hai kiểu.
//
// LƯU Ý QUAN TRỌNG VỀ DỮ LIỆU:
// Sheet Ban_Hang chỉ có cột "Ngày bán" (d/M/yyyy, KHÔNG có giờ). Vì vậy đơn
// tạo trước khi cột "Giờ bán" ra đời sẽ không xếp được vào ca nào — chúng rơi
// vào nhóm `unknown` và LUÔN được hiển thị riêng, không im lặng bỏ đi, để tổng
// tiền trên dashboard vẫn khớp với sheet.
// ---------------------------------------------------------------------------

import { DateTime } from "luxon"

export const TIMEZONE = "Asia/Ho_Chi_Minh"

/** Tên cột giờ bán trong sheet Ban_Hang (API tạo đơn tự thêm nếu thiếu). */
export const GIO_BAN_COL = "Giờ bán"

export type ShiftKey = "ca1" | "ca2" | "ca3" | "all"

export type ShiftDef = {
  key: ShiftKey
  /** Nhãn ngắn hiện trên dropdown. */
  label: string
  /** Số ca như trong cột "Ca" của Check_in; `all` không có. */
  caNumber?: "1" | "2" | "3"
  /** Giờ bắt đầu (bao gồm) và kết thúc (KHÔNG bao gồm), 0-23. */
  startHour: number
  endHour: number
}

export const SHIFTS: ShiftDef[] = [
  { key: "ca1", label: "Ca 1 · 9h–13h", caNumber: "1", startHour: 9, endHour: 13 },
  { key: "ca2", label: "Ca 2 · 13h–17h", caNumber: "2", startHour: 13, endHour: 17 },
  { key: "ca3", label: "Ca 3 · 17h–21h", caNumber: "3", startHour: 17, endHour: 21 },
  { key: "all", label: "Cả ngày · 9h–21h", startHour: 9, endHour: 21 },
]

export function getShift(key: string | null | undefined): ShiftDef {
  return SHIFTS.find((s) => s.key === key) || SHIFTS[SHIFTS.length - 1]
}

/** Ca đang diễn ra tại thời điểm `now` (mặc định: bây giờ). `null` nếu ngoài giờ mở cửa. */
export function currentShift(now?: DateTime): ShiftDef | null {
  const t = (now || DateTime.now().setZone(TIMEZONE)).setZone(TIMEZONE)
  const h = t.hour + t.minute / 60
  return SHIFTS.find((s) => s.key !== "all" && h >= s.startHour && h < s.endHour) || null
}

// --- Phân tích các định dạng thời gian đang tồn tại trong sheet ---------------
// Mỗi tab lại ghi một kiểu khác nhau (nợ kỹ thuật có sẵn), nên gom hết về đây.

/** "HH:mm:ss dd/MM/yyyy" hoặc "HH:mm dd/MM/yyyy" — Check_in, Hoan_Tra, CNC, Bao_Hanh. */
function parseVNDateTime(raw: string): DateTime | null {
  for (const fmt of ["HH:mm:ss dd/MM/yyyy", "HH:mm dd/MM/yyyy", "H:m:s d/M/yyyy", "H:m d/M/yyyy"]) {
    const dt = DateTime.fromFormat(raw, fmt, { zone: TIMEZONE })
    if (dt.isValid) return dt
  }
  return null
}

/** "d/M/yyyy" hoặc "dd/MM/yyyy" — cột ngày không kèm giờ. */
export function parseVNDate(raw: any): DateTime | null {
  const s = String(raw ?? "").trim()
  if (!s) return null
  for (const fmt of ["d/M/yyyy", "dd/MM/yyyy", "d/M/yy", "yyyy-MM-dd"]) {
    const dt = DateTime.fromFormat(s, fmt, { zone: TIMEZONE })
    if (dt.isValid) return dt.startOf("day")
  }
  return null
}

/** ISO UTC ("2026-10-29T04:21:31.844Z") — Tien_mat, Ghi_chu, Thong_Bao. */
function parseISO(raw: string): DateTime | null {
  const dt = DateTime.fromISO(raw, { zone: "utc" })
  return dt.isValid ? dt.setZone(TIMEZONE) : null
}

/**
 * Đọc một ô thời gian bất kỳ trong sheet về giờ Việt Nam.
 * Trả `null` nếu ô trống hoặc chỉ có ngày mà không có giờ.
 */
export function parseSheetDateTime(raw: any): DateTime | null {
  const s = String(raw ?? "").trim()
  if (!s) return null
  if (s.includes("T") && (s.endsWith("Z") || /[+-]\d{2}:\d{2}$/.test(s))) return parseISO(s)
  if (s.includes(":")) return parseVNDateTime(s)
  return null
}

/**
 * Ghép cột ngày (d/M/yyyy) với cột giờ ("HH:mm:ss") thành một mốc đầy đủ.
 * Thiếu giờ -> null, nghĩa là "không biết đơn này thuộc ca nào".
 */
export function combineDateAndTime(ngay: any, gio: any): DateTime | null {
  const d = parseVNDate(ngay)
  const t = String(gio ?? "").trim()
  if (!d || !t) return null
  const m = t.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/)
  if (!m) return null
  return d.set({
    hour: Number(m[1]),
    minute: Number(m[2]),
    second: Number(m[3] || 0),
  })
}

export type ShiftBucket = ShiftKey | "ngoai_ca" | "unknown"

/**
 * Xếp một mốc thời gian vào ca.
 * - `null`        -> "unknown" (đơn cũ chưa ghi giờ)
 * - ngoài 9h–21h  -> "ngoai_ca" (bán ngoài giờ mở cửa, vẫn phải hiện ra)
 */
export function bucketOf(dt: DateTime | null): ShiftBucket {
  if (!dt) return "unknown"
  const h = dt.hour + dt.minute / 60
  const s = SHIFTS.find((x) => x.key !== "all" && h >= x.startHour && h < x.endHour)
  return s ? s.key : "ngoai_ca"
}

/** Mốc này có nằm trong ca đang xem không? "Cả ngày" = 9h–21h. */
export function inShift(dt: DateTime | null, shift: ShiftDef): boolean {
  if (!dt) return false
  const h = dt.hour + dt.minute / 60
  return h >= shift.startHour && h < shift.endHour
}

export const BUCKET_LABEL: Record<ShiftBucket, string> = {
  ca1: "Ca 1 (9h–13h)",
  ca2: "Ca 2 (13h–17h)",
  ca3: "Ca 3 (17h–21h)",
  all: "Cả ngày",
  ngoai_ca: "Ngoài giờ mở cửa",
  unknown: "Chưa ghi giờ",
}
