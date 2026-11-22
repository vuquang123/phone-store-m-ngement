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
  /** Tên chi nhánh (chỉ để hiện trong tin Telegram; cột Chi Nhánh tự ghi khi lưu) */
  chiNhanh?: string
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

// ===================== ĐỐI CHIẾU VỚI CA TRƯỚC =====================
// Check-in ca sau phải khớp số máy ĐẾM THỰC TẾ của báo cáo cuối ca gần nhất (cùng chi nhánh).
// Lệch thì không cho check-in: nhân viên ghi chú + gửi yêu cầu, chủ shop/quản lý duyệt mới được gửi.

/** Số đếm thực tế của 1 kho: tổng + từng dòng máy. */
export interface KhoActual extends SeriesCounts {
  thucTe: number
}

export interface ShiftActual {
  khoNgoai: KhoActual
  khoTrong: KhoActual
}

/** Báo cáo cuối ca dùng làm mốc so sánh. */
export interface PrevCheckout extends ShiftActual {
  id: string
  created_at: string
  /** "HH:mm dd/MM/yyyy" giờ VN */
  thoi_gian: string
  ca: string
  nhanVien: string
}

export interface ShiftDiff {
  kho: "khoNgoai" | "khoTrong"
  khoLabel: string
  /** SeriesKey hoặc "tong" khi ca trước chỉ có tổng (không tách dòng máy) */
  dong: SeriesKey | "tong"
  dongLabel: string
  truoc: number
  nay: number
}

export const KHO_LABELS = { khoNgoai: "Kho ngoài", khoTrong: "Kho trong" } as const

const toActual = (k: Partial<KhoActual> | undefined): KhoActual => {
  const s = {
    s17: Number(k?.s17) || 0,
    s16: Number(k?.s16) || 0,
    s15: Number(k?.s15) || 0,
    ipad: Number(k?.ipad) || 0,
    khac: Number(k?.khac) || 0,
  }
  return { ...s, thucTe: sumSeries(s) }
}

/** Chuẩn hoá số đếm (thực tế = cộng các dòng máy). */
export function normalizeActual(a: { khoNgoai?: Partial<KhoActual>; khoTrong?: Partial<KhoActual> }): ShiftActual {
  return { khoNgoai: toActual(a?.khoNgoai), khoTrong: toActual(a?.khoTrong) }
}

/**
 * So số đếm hiện tại với báo cáo cuối ca trước. Ca trước tách đủ dòng máy -> so từng dòng;
 * dữ liệu cũ chỉ có tổng -> so tổng của kho đó. Không có ca trước -> không lệch.
 */
export function diffWithPrev(prev: ShiftActual | null | undefined, cur: ShiftActual): ShiftDiff[] {
  if (!prev) return []
  const out: ShiftDiff[] = []
  for (const kho of ["khoNgoai", "khoTrong"] as const) {
    const p = prev[kho]
    const c = cur[kho]
    const pSum = sumSeries(p)
    if (pSum === (Number(p.thucTe) || 0)) {
      for (const k of SERIES_KEYS) {
        const truoc = Number(p[k]) || 0
        const nay = Number(c[k]) || 0
        if (truoc !== nay) out.push({ kho, khoLabel: KHO_LABELS[kho], dong: k, dongLabel: SERIES_LABELS[k], truoc, nay })
      }
    } else {
      const truoc = Number(p.thucTe) || 0
      const nay = sumSeries(c)
      if (truoc !== nay) out.push({ kho, khoLabel: KHO_LABELS[kho], dong: "tong", dongLabel: "Tổng", truoc, nay })
    }
  }
  return out
}

/** Khoá so sánh số đếm: yêu cầu đã duyệt chỉ dùng được cho đúng bộ số này. */
export function actualKey(a: ShiftActual): string {
  const n = normalizeActual(a)
  return (["khoNgoai", "khoTrong"] as const).map((k) => SERIES_KEYS.map((s) => n[k][s]).join(",")).join("|")
}

export function formatDiffLine(d: ShiftDiff): string {
  const delta = d.nay - d.truoc
  return `${d.khoLabel} · ${d.dongLabel}: ${d.truoc} → ${d.nay} (${delta > 0 ? "+" : ""}${delta})`
}

export type YeuCauTrangThai = "cho_duyet" | "da_duyet" | "tu_choi" | "da_dung" | "huy"

export const YEU_CAU_LABEL: Record<YeuCauTrangThai, string> = {
  cho_duyet: "Chờ duyệt",
  da_duyet: "Đã duyệt",
  tu_choi: "Từ chối",
  da_dung: "Đã check-in",
  huy: "Đã thay bằng yêu cầu mới",
}

/** Yêu cầu duyệt lệch ca (bảng Yeu_Cau_Lech_Ca). */
export interface YeuCauLechCa {
  id: string
  thoi_gian: string
  created_at: string
  ca: string
  nhanVien: string
  email: string
  ghiChu: string
  chiTiet: string
  soDem: ShiftActual
  key: string
  mocId: string
  mocThoiGian: string
  trangThai: YeuCauTrangThai
  nguoiDuyet: string
  thoiGianDuyet: string
  ghiChuDuyet: string
  checkinId: string
  chiNhanh: string
}
