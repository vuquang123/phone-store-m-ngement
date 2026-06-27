// lib/check-out.ts
// Báo cáo cuối ca (checkout): types, dựng message Telegram (HTML) + lưu/đọc sheet "Check_Out".

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

export interface TaiChinh {
  banRa: number
  banRaOff: string
  banRaOnl: string
  thuVao: string
  tienMatBanGiao: number // lưu VNĐ; render dạng "k"
  ghiChuCaSau: string
}

export interface CheckoutInput {
  ca: Ca
  khoNgoai: KhoCounts
  khoTrong: KhoCounts
  trangThai: TrangThai
  lyDo?: string
  taiChinh: TaiChinh
  nhanVien?: string
}

export interface CheckoutRecord extends CheckoutInput {
  id: string
  created_at: string
  so_anh: number
}

// Escape ký tự đặc biệt cho parse_mode HTML.
function esc(s: any): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
}

export function buildCheckoutMessage(input: CheckoutInput): string {
  const { ca, khoNgoai: kn, khoTrong: kt, trangThai, lyDo, taiChinh: tc, nhanVien } = input

  const tongThucTe = (kn.thucTe || 0) + (kt.thucTe || 0)
  const tongWebsite = (kn.website || 0) + (kt.website || 0)
  const statusLine =
    trangThai === "khop"
      ? `KHỚP WEB ${tongThucTe}/${tongWebsite}`
      : `KHÔNG KHỚP - ${esc(lyDo || "")}`

  const tienMatK = tc.tienMatBanGiao ? `${Math.round(tc.tienMatBanGiao / 1000)}k` : ""

  const lines: string[] = [
    `Báo cáo check out ca ${esc(ca)}`,
    `  - KHO NGOÀI: Tổng máy ${kn.thucTe}/${kn.website}`,
    `17 Series: [${kn.s17}]`,
    `16 Series: [${kn.s16}]`,
    `15 Series: [${kn.s15}]`,
    `Ipad: [${kn.ipad}]`,
    `Khác (14/13/12/Lẻ): [${kn.khac}]`,
    `- KHO TRONG: Tổng ${kt.thucTe}/${kt.website}`,
    `17 Series: [${kt.s17}]`,
    `16 Series: [${kt.s16}]`,
    `15 Series: [${kt.s15}]`,
    `Ipad: [${kt.ipad}]`,
    `Khác (14/13/12/Lẻ): [${kt.khac}]`,
    `TRẠNG THÁI : ${statusLine}`,
    ``,
    `3️⃣ TÀI CHÍNH & ĐƠN HÀNG`,
    `- Bán ra: ${tc.banRa}`,
    `Off: ${esc(tc.banRaOff)}`,
    `Onl: ${esc(tc.banRaOnl)}`,
    `- Thu vào: ${esc(tc.thuVao)}`,
    `- Tiền mặt bàn giao: [${tienMatK}]`,
    `📝 GHI CHÚ CA SAU (Khách hẹn, máy lỗi...): ${esc(tc.ghiChuCaSau)}`,
  ]

  if (nhanVien) {
    lines.push(`Nhân viên: ${esc(nhanVien)}`)
    lines.push(`Thời gian: ${DateTime.now().setZone("Asia/Ho_Chi_Minh").toFormat("dd/MM/yyyy HH:mm")}`)
  }

  return lines.join("\n")
}

// ===================== SHEET "Check_Out" =====================

const SHEET = "Check_out" // tên tab đúng trên Google Sheet (phân biệt hoa/thường)
// 27 cột -> A1:AA1
const HEADER = [
  "ID", "Ca", "Created At", "Nhân Viên", "Trạng Thái", "Lý Do", "Số Ảnh",
  "Ngoài Website", "Ngoài Thực Tế", "Ngoài 17", "Ngoài 16", "Ngoài 15", "Ngoài Ipad", "Ngoài Khác",
  "Trong Website", "Trong Thực Tế", "Trong 17", "Trong 16", "Trong 15", "Trong Ipad", "Trong Khác",
  "Bán Ra", "Bán Ra Off", "Bán Ra Onl", "Thu Vào", "Tiền Mặt Bàn Giao", "Ghi Chú Ca Sau",
]
const HEADER_RANGE = `'${SHEET}'!A1:AA1`

function genId(): string {
  try {
    const c = (globalThis as any).crypto
    if (c?.randomUUID) return c.randomUUID()
  } catch {}
  return `CO_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`
}

const num = (v: any): number => {
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

export async function addCheckout(input: CheckoutInput, soAnh = 0): Promise<CheckoutRecord> {
  await ensureHeader()
  const id = genId()
  const created_at = new Date().toISOString()
  const kn = input.khoNgoai
  const kt = input.khoTrong
  const tc = input.taiChinh

  const row = [
    id, input.ca, created_at, input.nhanVien || "", input.trangThai, input.lyDo || "", soAnh,
    num(kn.website), num(kn.thucTe), num(kn.s17), num(kn.s16), num(kn.s15), num(kn.ipad), num(kn.khac),
    num(kt.website), num(kt.thucTe), num(kt.s17), num(kt.s16), num(kt.s15), num(kt.ipad), num(kt.khac),
    num(tc.banRa), tc.banRaOff || "", tc.banRaOnl || "", tc.thuVao || "", num(tc.tienMatBanGiao), tc.ghiChuCaSau || "",
  ]
  await appendToGoogleSheets(SHEET, row)

  return { ...input, id, created_at, so_anh: soAnh }
}

export async function getCheckouts(limit = 100): Promise<CheckoutRecord[]> {
  await ensureHeader()
  const { header, rows } = await readFromGoogleSheets(SHEET, undefined, { force: true } as any)
  const lower = header.map((h) => (h || "").trim().toLowerCase())
  const idx = (name: string) => lower.indexOf(name.trim().toLowerCase())
  const g = (r: any[], name: string) => r[idx(name)]

  const list: CheckoutRecord[] = (rows || [])
    .filter((r) => r && r.length && (idx("ID") === -1 || r[idx("ID")]))
    .map((r) => ({
      id: String(g(r, "ID") || ""),
      ca: String(g(r, "Ca") || "1") as Ca,
      created_at: String(g(r, "Created At") || ""),
      nhanVien: String(g(r, "Nhân Viên") || ""),
      trangThai: (String(g(r, "Trạng Thái") || "khop") === "khong_khop" ? "khong_khop" : "khop") as TrangThai,
      lyDo: String(g(r, "Lý Do") || ""),
      so_anh: num(g(r, "Số Ảnh")),
      khoNgoai: {
        website: num(g(r, "Ngoài Website")), thucTe: num(g(r, "Ngoài Thực Tế")),
        s17: num(g(r, "Ngoài 17")), s16: num(g(r, "Ngoài 16")), s15: num(g(r, "Ngoài 15")),
        ipad: num(g(r, "Ngoài Ipad")), khac: num(g(r, "Ngoài Khác")),
      },
      khoTrong: {
        website: num(g(r, "Trong Website")), thucTe: num(g(r, "Trong Thực Tế")),
        s17: num(g(r, "Trong 17")), s16: num(g(r, "Trong 16")), s15: num(g(r, "Trong 15")),
        ipad: num(g(r, "Trong Ipad")), khac: num(g(r, "Trong Khác")),
      },
      taiChinh: {
        banRa: num(g(r, "Bán Ra")),
        banRaOff: String(g(r, "Bán Ra Off") || ""),
        banRaOnl: String(g(r, "Bán Ra Onl") || ""),
        thuVao: String(g(r, "Thu Vào") || ""),
        tienMatBanGiao: num(g(r, "Tiền Mặt Bàn Giao")),
        ghiChuCaSau: String(g(r, "Ghi Chú Ca Sau") || ""),
      },
    }))

  list.sort((a, b) => (Date.parse(b.created_at) || 0) - (Date.parse(a.created_at) || 0))
  return list.slice(0, limit)
}
