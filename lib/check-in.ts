// lib/check-in.ts
// Kiểu dữ liệu + hàm dựng message báo cáo check-in đầu ca (gửi Telegram, parse_mode HTML).

import { DateTime } from "luxon"
import { readFromGoogleSheets, appendToGoogleSheets, updateRangeValues, colIndex, khoColIndex } from "@/lib/google-sheets"
import { parseVietnameseNumber } from "@/lib/number"
import {
  SERIES_KEYS,
  SERIES_LABELS,
  classifySeries,
  emptySeries,
  stripVi,
  type CheckinInput,
  type KhoCounts,
  type WebStock,
} from "@/lib/check-in-shared"

export * from "@/lib/check-in-shared"

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

  // Mỗi dòng máy hiển thị "thực tế/web"; đơn nào chưa có số web (dữ liệu cũ) thì chỉ hiện thực tế.
  const seriesLines = (k: KhoCounts) =>
    SERIES_KEYS.map((key) => {
      const thucTe = Number(k[key]) || 0
      const web = k.web ? Number(k.web[key]) || 0 : null
      return `${SERIES_LABELS[key]}: [${web === null ? thucTe : `${thucTe}/${web}`}]`
    })

  const lines: string[] = [
    `Báo cáo check in ca ${esc(ca)}`,
    `  - KHO NGOÀI: Tổng máy ${khoNgoai.thucTe}/${khoNgoai.website}`,
    ...seriesLines(khoNgoai),
    `- KHO TRONG: Tổng ${khoTrong.thucTe}/${khoTrong.website}`,
    ...seriesLines(khoTrong),
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
// 34 cột (A:AH). KN = Kho Ngoài, KT = Kho Trong.
// "KN 17"... là số ĐẾM THỰC TẾ theo dòng máy (giữ nguyên vị trí cũ để không vỡ lịch sử);
// 10 cột "… Web …" được thêm ở CUỐI nên các dòng cũ vẫn đọc đúng.
const HEADER = [
  "ID", "Thời Gian", "Nhân Viên", "Ca", "Trạng Thái", "Lý Do",
  "KN Website", "KN Thực Tế", "KN 17", "KN 16", "KN 15", "KN Ipad", "KN Khác",
  "KT Website", "KT Thực Tế", "KT 17", "KT 16", "KT 15", "KT Ipad", "KT Khác",
  "Tổng Web", "Tổng Thực Tế", "Số Ảnh", "Tiền Mặt",
  "KN Web 17", "KN Web 16", "KN Web 15", "KN Web Ipad", "KN Web Khác",
  "KT Web 17", "KT Web 16", "KT Web 15", "KT Web Ipad", "KT Web Khác",
]
const HEADER_RANGE = `'${SHEET}'!A1:AH1`

function genId(): string {
  try {
    const c = (globalThis as any).crypto
    if (c?.randomUUID) return c.randomUUID()
  } catch {}
  return `CI_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`
}

const toNum = (v: any): number => {
  return parseVietnameseNumber(v)
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
    ...SERIES_KEYS.map((k) => Number(kn.web?.[k]) || 0),
    ...SERIES_KEYS.map((k) => Number(kt.web?.[k]) || 0),
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
        web: {
          s17: toNum(g(r, "KN Web 17")), s16: toNum(g(r, "KN Web 16")), s15: toNum(g(r, "KN Web 15")),
          ipad: toNum(g(r, "KN Web Ipad")), khac: toNum(g(r, "KN Web Khác")),
        },
      },
      khoTrong: {
        website: toNum(g(r, "KT Website")), thucTe: toNum(g(r, "KT Thực Tế")),
        s17: toNum(g(r, "KT 17")), s16: toNum(g(r, "KT 16")), s15: toNum(g(r, "KT 15")),
        ipad: toNum(g(r, "KT Ipad")), khac: toNum(g(r, "KT Khác")),
        web: {
          s17: toNum(g(r, "KT Web 17")), s16: toNum(g(r, "KT Web 16")), s15: toNum(g(r, "KT Web 15")),
          ipad: toNum(g(r, "KT Web Ipad")), khac: toNum(g(r, "KT Web Khác")),
        },
      },
    }))

  const ts = (s: string) => {
    const m = String(s).match(/(\d{1,2}):(\d{2}):(\d{2})\s+(\d{1,2})\/(\d{1,2})\/(\d{4})/)
    return m ? new Date(+m[6], +m[5] - 1, +m[4], +m[1], +m[2], +m[3]).getTime() : 0
  }
  return list.sort((a, b) => ts(b.thoi_gian) - ts(a.thoi_gian))
}

// ===================== SỐ MÁY TỒN TRÊN WEBSITE (sheet "Kho_Hang") =====================

const KHO_HANG_SHEET = "Kho_Hang"

/**
 * Đếm máy đang tồn trên website theo cột "Trạng Thái Kho" của sheet Kho_Hang
 * ("Kho trong" / "Kho ngoài"), tách theo từng dòng máy.
 */
export async function getWebStockCounts(force = false): Promise<WebStock> {
  const { header, rows } = await readFromGoogleSheets(KHO_HANG_SHEET, undefined, { force })
  const iTen = colIndex(header, "Tên Sản Phẩm")
  const iKho = khoColIndex(header)
  const iId = colIndex(header, "ID Máy")
  const iImei = colIndex(header, "IMEI")
  const iSerial = colIndex(header, "Serial")

  const khoNgoai = { ...emptySeries(), total: 0 }
  const khoTrong = { ...emptySeries(), total: 0 }

  if (iKho !== -1) {
    for (const row of rows || []) {
      if (!row || !row.length) continue
      // Bỏ dòng trống: phải có ít nhất 1 định danh máy.
      const hasDevice = [iId, iImei, iSerial].some((i) => i !== -1 && String(row[i] || "").trim())
      if (!hasDevice) continue

      const kho = stripVi(row[iKho])
      if (!kho) continue
      const bucket = kho.includes("ngoai")
        ? khoNgoai
        : (kho.includes("trong") || kho.includes("co san") ? khoTrong : null)
      if (!bucket) continue

      bucket[classifySeries(iTen !== -1 ? String(row[iTen] || "") : "")] += 1
      bucket.total += 1
    }
  }

  return {
    khoNgoai,
    khoTrong,
    capturedAt: DateTime.now().setZone("Asia/Ho_Chi_Minh").toFormat("HH:mm:ss dd/MM/yyyy"),
  }
}
