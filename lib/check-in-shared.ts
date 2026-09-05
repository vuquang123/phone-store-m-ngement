// lib/check-in-shared.ts
// Phần dùng chung cho check-in giữa client và server.
// KHÔNG import google-sheets/googleapis ở đây để trang client không kéo SDK server vào bundle.

export type Ca = "1" | "2" | "3"
export type TrangThai = "khop" | "khong_khop"

/** Số máy tách theo dòng máy (dùng chung cho cả cột "website" lẫn "thực tế"). */
export interface SeriesCounts {
  s17: number
  s16: number
  s15: number
  ipad: number
  khac: number
}

export type SeriesKey = keyof SeriesCounts

export const SERIES_KEYS: SeriesKey[] = ["s17", "s16", "s15", "ipad", "khac"]

export const SERIES_LABELS: Record<SeriesKey, string> = {
  s17: "17 Series",
  s16: "16 Series",
  s15: "15 Series",
  ipad: "Ipad",
  khac: "Khác (14/13/12/Lẻ)",
}

export const emptySeries = (): SeriesCounts => ({ s17: 0, s16: 0, s15: 0, ipad: 0, khac: 0 })

export const sumSeries = (c: Partial<SeriesCounts> | undefined): number =>
  SERIES_KEYS.reduce((sum, k) => sum + (Number(c?.[k]) || 0), 0)

// s17..khac giữ nguyên ý nghĩa cũ = số đếm THỰC TẾ theo dòng máy (không đổi cột sheet cũ).
// `web` là phần thêm: số trên website tách theo dòng máy.
export interface KhoCounts extends SeriesCounts {
  website: number
  thucTe: number
  web?: SeriesCounts
}

export interface CheckinInput {
  ca: Ca
  khoNgoai: KhoCounts
  khoTrong: KhoCounts
  trangThai: TrangThai
  lyDo?: string
  tienMat?: number // tiền mặt đầu ca (VNĐ)
  nhanVien?: string
}

export interface KhoWebStock extends SeriesCounts {
  total: number
}

export interface WebStock {
  khoNgoai: KhoWebStock
  khoTrong: KhoWebStock
  capturedAt: string
}

export const stripVi = (s: any) =>
  String(s ?? "")
    .normalize("NFD")
    // @ts-ignore - \p{Diacritic} cần target ES2018+
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim()

/** Xếp 1 máy vào dòng máy: iPad -> ipad, iPhone 17/16/15 -> s17/s16/s15, còn lại -> khac. */
export function classifySeries(tenSanPham: string): SeriesKey {
  const s = stripVi(tenSanPham)
  if (!s) return "khac"
  if (s.includes("ipad")) return "ipad"
  // Bắt "iPhone 16 Pro Max"; dự phòng cho tên nhập tắt kiểu "16 Pro Max".
  const m = s.match(/iphone\s*(\d{1,2})/) || s.match(/^(\d{1,2})\b/)
  switch (m ? Number(m[1]) : 0) {
    case 17: return "s17"
    case 16: return "s16"
    case 15: return "s15"
    default: return "khac"
  }
}
