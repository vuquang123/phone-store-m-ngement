// lib/lech-ca.ts
// Yêu cầu duyệt khi check-in lệch số máy so với báo cáo cuối ca trước (bảng "Yeu_Cau_Lech_Ca").
// Luồng: nhân viên đếm lệch -> ghi chú + gửi yêu cầu -> chủ shop/quản lý duyệt/từ chối ->
// được duyệt thì nhân viên gửi check-in với ĐÚNG bộ số đã duyệt (yêu cầu chuyển "da_dung").

import { DateTime } from "luxon"
import { readFromGoogleSheets, appendToGoogleSheets, updateRangeValues } from "@/lib/google-sheets"
import { branchColumnIndex } from "@/lib/branch-context"
import { branchName, rowBranchId, type BranchId } from "@/lib/branches"
import {
  actualKey,
  normalizeActual,
  type ShiftActual,
  type YeuCauLechCa,
  type YeuCauTrangThai,
} from "@/lib/check-in-shared"

const SHEET = "Yeu_Cau_Lech_Ca"
// 18 cột A:R. Các cột trạng thái (M..Q) liền nhau để cập nhật 1 lần.
const HEADER = [
  "ID", "Thời Gian", "Created At", "Ca", "Nhân Viên", "Email", "Ghi Chú", "Chi Tiết Lệch", "Số Đếm", "Khoá",
  "Mốc ID", "Mốc Thời Gian",
  "Trạng Thái", "Người Duyệt", "Thời Gian Duyệt", "Ghi Chú Duyệt", "Check-in ID",
  "Chi Nhánh",
]
const HEADER_RANGE = `'${SHEET}'!A1:R1`
const STATUS_COL_FROM = "M"
const STATUS_COL_TO = "Q"

/** Yêu cầu đã duyệt dùng được trong bao lâu (giờ). */
export const APPROVAL_VALID_HOURS = 12

async function ensureHeader() {
  try {
    const { header } = await readFromGoogleSheets(SHEET, undefined, { force: true, silent: true })
    const lower = (header || []).map((h) => (h || "").trim().toLowerCase())
    if (!header?.length || HEADER.some((h) => !lower.includes(h.toLowerCase()))) {
      await updateRangeValues(HEADER_RANGE, [HEADER])
    }
  } catch {
    await updateRangeValues(HEADER_RANGE, [HEADER])
  }
}

const vnNow = () => DateTime.now().setZone("Asia/Ho_Chi_Minh")

type Stored = YeuCauLechCa & { rowNumber: number; branchId: BranchId }

async function readAll(): Promise<Stored[]> {
  await ensureHeader()
  const { header, rows } = await readFromGoogleSheets(SHEET, undefined, { force: true })
  const lower = header.map((h) => (h || "").trim().toLowerCase())
  const idx = (name: string) => lower.indexOf(name.toLowerCase())
  const g = (r: any[], name: string) => String(r[idx(name)] ?? "")
  const bi = branchColumnIndex(header)
  const out: Stored[] = []
  ;(rows || []).forEach((r, i) => {
    if (!r || !g(r, "ID").trim()) return
    let soDem: ShiftActual
    try {
      soDem = normalizeActual(JSON.parse(g(r, "Số Đếm") || "{}"))
    } catch {
      soDem = normalizeActual({})
    }
    const branchId = rowBranchId(bi === -1 ? "" : r[bi])
    out.push({
      rowNumber: i + 2,
      branchId,
      id: g(r, "ID"),
      thoi_gian: g(r, "Thời Gian"),
      created_at: g(r, "Created At"),
      ca: g(r, "Ca"),
      nhanVien: g(r, "Nhân Viên"),
      email: g(r, "Email"),
      ghiChu: g(r, "Ghi Chú"),
      chiTiet: g(r, "Chi Tiết Lệch"),
      soDem,
      key: g(r, "Khoá") || actualKey(soDem),
      mocId: g(r, "Mốc ID"),
      mocThoiGian: g(r, "Mốc Thời Gian"),
      trangThai: (g(r, "Trạng Thái") || "cho_duyet") as YeuCauTrangThai,
      nguoiDuyet: g(r, "Người Duyệt"),
      thoiGianDuyet: g(r, "Thời Gian Duyệt"),
      ghiChuDuyet: g(r, "Ghi Chú Duyệt"),
      checkinId: g(r, "Check-in ID"),
      chiNhanh: branchName(branchId),
    })
  })
  out.sort((a, b) => (Date.parse(b.created_at) || 0) - (Date.parse(a.created_at) || 0))
  return out
}

export async function listYeuCau(filter: { branch?: BranchId | "all"; email?: string; sinceHours?: number } = {}) {
  const since = filter.sinceHours ? Date.now() - filter.sinceHours * 3600_000 : 0
  return (await readAll()).filter(
    (y) =>
      (!filter.branch || filter.branch === "all" || y.branchId === filter.branch) &&
      (!filter.email || y.email.toLowerCase() === filter.email.toLowerCase()) &&
      (!since || (Date.parse(y.created_at) || 0) >= since),
  )
}

export async function getYeuCau(id: string) {
  return (await readAll()).find((y) => y.id === id) || null
}

/** Yêu cầu đã duyệt, chưa dùng, còn hạn, đúng người + chi nhánh + bộ số đếm. */
export async function findApproved(branch: BranchId, email: string, soDem: ShiftActual, mocId: string) {
  const key = actualKey(soDem)
  const since = Date.now() - APPROVAL_VALID_HOURS * 3600_000
  return (
    (await readAll()).find(
      (y) =>
        y.trangThai === "da_duyet" &&
        y.branchId === branch &&
        y.email.toLowerCase() === email.toLowerCase() &&
        y.key === key &&
        y.mocId === mocId &&
        (Date.parse(y.created_at) || 0) >= since,
    ) || null
  )
}

export async function createYeuCau(input: {
  ca: string
  nhanVien: string
  email: string
  ghiChu: string
  chiTiet: string
  soDem: ShiftActual
  mocId: string
  mocThoiGian: string
}): Promise<YeuCauLechCa> {
  await ensureHeader()
  const id = globalThis.crypto?.randomUUID?.() || `YC_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`
  const now = vnNow()
  const soDem = normalizeActual(input.soDem)
  const key = actualKey(soDem)
  const row = [
    id, now.toFormat("HH:mm:ss dd/MM/yyyy"), new Date().toISOString(), input.ca, input.nhanVien, input.email,
    input.ghiChu, input.chiTiet, JSON.stringify(soDem), key, input.mocId, input.mocThoiGian,
    "cho_duyet", "", "", "", "",
    // Chi Nhánh: để trống -> hệ thống tự ghi chi nhánh của người gửi
  ]
  await appendToGoogleSheets(SHEET, row)
  return {
    id, thoi_gian: row[1] as string, created_at: row[2] as string, ca: input.ca, nhanVien: input.nhanVien,
    email: input.email, ghiChu: input.ghiChu, chiTiet: input.chiTiet, soDem, key, mocId: input.mocId,
    mocThoiGian: input.mocThoiGian, trangThai: "cho_duyet", nguoiDuyet: "", thoiGianDuyet: "", ghiChuDuyet: "",
    checkinId: "", chiNhanh: "",
  }
}

/** Cập nhật trạng thái (M..Q). Trả null nếu không tìm thấy hoặc trạng thái hiện tại không như mong đợi. */
export async function setYeuCauStatus(
  id: string,
  expect: YeuCauTrangThai[],
  next: { trangThai: YeuCauTrangThai; nguoiDuyet?: string; ghiChuDuyet?: string; checkinId?: string },
) {
  const y = await getYeuCau(id)
  if (!y || !expect.includes(y.trangThai)) return null
  const values = [
    next.trangThai,
    next.nguoiDuyet ?? y.nguoiDuyet,
    next.nguoiDuyet !== undefined ? vnNow().toFormat("HH:mm:ss dd/MM/yyyy") : y.thoiGianDuyet,
    next.ghiChuDuyet ?? y.ghiChuDuyet,
    next.checkinId ?? y.checkinId,
  ]
  await updateRangeValues(`'${SHEET}'!${STATUS_COL_FROM}${y.rowNumber}:${STATUS_COL_TO}${y.rowNumber}`, [values])
  return { ...y, trangThai: next.trangThai, nguoiDuyet: values[1], thoiGianDuyet: values[2], ghiChuDuyet: values[3], checkinId: values[4] }
}

export function publicYeuCau(y: Stored | YeuCauLechCa): YeuCauLechCa {
  const { rowNumber, branchId, ...rest } = y as Stored
  void rowNumber
  void branchId
  return rest
}
