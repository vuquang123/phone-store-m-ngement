// lib/check-in.ts
// Kiểu dữ liệu + hàm dựng message báo cáo check-in đầu ca (gửi Telegram, parse_mode HTML).

import { DateTime } from "luxon"
import { readFromGoogleSheets, appendToGoogleSheets, updateRangeValues } from "@/lib/google-sheets"

export type Ca = "1" | "2" | "3"
export type TrangThai = "khop" | "khong_khop"

export interface KhoCounts {
  website: number
  thucTe: number
  s17: number
  s16: number
  s15: number
  ipad: number
  khac: number
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

// Escape ký tự đặc biệt cho parse_mode HTML của Telegram.
function esc(s: any): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
}

export function buildCheckinMessage(input: CheckinInput): string {
  const { ca, khoNgoai, khoTrong, trangThai, lyDo, tienMat, nhanVien } = input

  const tongThucTe = (khoNgoai.thucTe || 0) + (khoTrong.thucTe || 0)
  const tongWebsite = (khoNgoai.website || 0) + (khoTrong.website || 0)

  const statusLine =
    trangThai === "khop"
      ? `KHỚP WEB ${tongThucTe}/${tongWebsite}`
      : `KHÔNG KHỚP - ${esc(lyDo || "")}`

  const lines: string[] = [
    `Báo cáo check in ca ${esc(ca)}`,
    `  - KHO NGOÀI: Tổng máy ${khoNgoai.thucTe}/${khoNgoai.website}`,
    `17 Series: [${khoNgoai.s17}]`,
    `16 Series: [${khoNgoai.s16}]`,
    `15 Series: [${khoNgoai.s15}]`,
    `Ipad: [${khoNgoai.ipad}]`,
    `Khác (14/13/12/Lẻ): [${khoNgoai.khac}]`,
    `- KHO TRONG: Tổng ${khoTrong.thucTe}/${khoTrong.website}`,
    `17 Series: [${khoTrong.s17}]`,
    `16 Series: [${khoTrong.s16}]`,
    `15 Series: [${khoTrong.s15}]`,
    `Ipad: [${khoTrong.ipad}]`,
    `Khác (14/13/12/Lẻ): [${khoTrong.khac}]`,
    `TRẠNG THÁI : ${statusLine}`,
    `Tiền mặt đầu ca: [${tienMat ? `${Math.round(tienMat / 1000)}k` : "0"}]`,
  ]

  if (nhanVien) {
    lines.push(`Nhân viên: ${esc(nhanVien)}`)
    lines.push(`Thời gian: ${DateTime.now().setZone("Asia/Ho_Chi_Minh").toFormat("dd/MM/yyyy HH:mm")}`)
  }

  return lines.join("\n")
}

// ===================== LƯU LỊCH SỬ CHECK-IN VÀO SHEET "Check_in" =====================

const SHEET = "Check_in"
// 24 cột (A:X). KN = Kho Ngoài, KT = Kho Trong.
const HEADER = [
  "ID", "Thời Gian", "Nhân Viên", "Ca", "Trạng Thái", "Lý Do",
  "KN Website", "KN Thực Tế", "KN 17", "KN 16", "KN 15", "KN Ipad", "KN Khác",
  "KT Website", "KT Thực Tế", "KT 17", "KT 16", "KT 15", "KT Ipad", "KT Khác",
  "Tổng Web", "Tổng Thực Tế", "Số Ảnh", "Tiền Mặt",
]
const HEADER_RANGE = `'${SHEET}'!A1:X1`

function genId(): string {
  try {
    const c = (globalThis as any).crypto
    if (c?.randomUUID) return c.randomUUID()
  } catch {}
  return `CI_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`
}

const toNum = (v: any): number => {
  const n = Number(String(v ?? "").replace(/[^\d.-]/g, ""))
  return Number.isFinite(n) ? n : 0
}

async function ensureHeader() {
  try {
    const { header } = await readFromGoogleSheets(SHEET)
    if (!header || header.length === 0) {
      await updateRangeValues(HEADER_RANGE, [HEADER])
      return
    }
    const lower = header.map((h) => (h || "").trim().toLowerCase())
    if (HEADER.some((h) => !lower.includes(h.trim().toLowerCase()))) {
      await updateRangeValues(HEADER_RANGE, [HEADER])
    }
  } catch {
    try { await updateRangeValues(HEADER_RANGE, [HEADER]) } catch {}
  }
}

/** Ghi 1 dòng lịch sử check-in. soAnh = số ảnh đính kèm. */
export async function saveCheckin(input: CheckinInput, soAnh = 0): Promise<{ id: string }> {
  await ensureHeader()
  const kn = input.khoNgoai
  const kt = input.khoTrong
  const id = genId()
  const thoiGian = DateTime.now().setZone("Asia/Ho_Chi_Minh").toFormat("HH:mm:ss dd/MM/yyyy")
  const row = [
    id, thoiGian, input.nhanVien || "", input.ca,
    input.trangThai === "khop" ? "Khớp" : "Không khớp", input.lyDo || "",
    kn.website, kn.thucTe, kn.s17, kn.s16, kn.s15, kn.ipad, kn.khac,
    kt.website, kt.thucTe, kt.s17, kt.s16, kt.s15, kt.ipad, kt.khac,
    (kn.website || 0) + (kt.website || 0),
    (kn.thucTe || 0) + (kt.thucTe || 0),
    soAnh,
    Number(input.tienMat) || 0,
  ]
  await appendToGoogleSheets(SHEET, row)
  return { id }
}

export interface CheckinRecord {
  id: string
  thoi_gian: string
  nhan_vien: string
  ca: string
  trang_thai: string
  ly_do: string
  tong_web: number
  tong_thuc_te: number
  so_anh: number
  tien_mat: number
  khoNgoai: KhoCounts
  khoTrong: KhoCounts
}

/** Đọc lịch sử check-in (mới nhất trước). */
export async function getCheckins(force = false): Promise<CheckinRecord[]> {
  await ensureHeader()
  const { header, rows } = await readFromGoogleSheets(SHEET, undefined, { force })
  const lower = header.map((h) => (h || "").trim().toLowerCase())
  const idx = (name: string) => lower.indexOf(name.trim().toLowerCase())
  const g = (r: any[], name: string) => r[idx(name)]

  const list = (rows || [])
    .filter((r) => r && r.length && (idx("ID") === -1 || r[idx("ID")]))
    .map((r) => ({
      id: String(g(r, "ID") || ""),
      thoi_gian: String(g(r, "Thời Gian") || ""),
      nhan_vien: String(g(r, "Nhân Viên") || ""),
      ca: String(g(r, "Ca") || ""),
      trang_thai: String(g(r, "Trạng Thái") || ""),
      ly_do: String(g(r, "Lý Do") || ""),
      tong_web: toNum(g(r, "Tổng Web")),
      tong_thuc_te: toNum(g(r, "Tổng Thực Tế")),
      so_anh: toNum(g(r, "Số Ảnh")),
      tien_mat: toNum(g(r, "Tiền Mặt")),
      khoNgoai: {
        website: toNum(g(r, "KN Website")), thucTe: toNum(g(r, "KN Thực Tế")),
        s17: toNum(g(r, "KN 17")), s16: toNum(g(r, "KN 16")), s15: toNum(g(r, "KN 15")),
        ipad: toNum(g(r, "KN Ipad")), khac: toNum(g(r, "KN Khác")),
      },
      khoTrong: {
        website: toNum(g(r, "KT Website")), thucTe: toNum(g(r, "KT Thực Tế")),
        s17: toNum(g(r, "KT 17")), s16: toNum(g(r, "KT 16")), s15: toNum(g(r, "KT 15")),
        ipad: toNum(g(r, "KT Ipad")), khac: toNum(g(r, "KT Khác")),
      },
    }))

  const ts = (s: string) => {
    const m = String(s).match(/(\d{1,2}):(\d{2}):(\d{2})\s+(\d{1,2})\/(\d{1,2})\/(\d{4})/)
    return m ? new Date(+m[6], +m[5] - 1, +m[4], +m[1], +m[2], +m[3]).getTime() : 0
  }
  return list.sort((a, b) => ts(b.thoi_gian) - ts(a.thoi_gian))
}
