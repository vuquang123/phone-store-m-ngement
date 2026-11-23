// lib/tai-chinh/bang.ts
// Các bảng của phần Tài chính. Mỗi bảng là một "tab" như mọi bảng khác của app:
// nằm trong Supabase, tự chép sang Google Sheet sau mỗi lần ghi, sửa được trong
// "Quản trị dữ liệu". Chỉ THÊM bảng/cột, không đổi tên hay xoá gì của dữ liệu cũ.
import {
  readFromGoogleSheets,
  appendMultipleToGoogleSheets,
  batchUpdateRangeValues,
  ensureSheetExists,
  updateRangeValues,
  colIndex,
} from "@/lib/google-sheets"

export const BANG = {
  DAU_HANG: "Dau_Hang",
  LO_NHAP: "Lo_Nhap",
  CHI_TIET_LO: "Chi_Tiet_Lo",
  TRA_NO: "Tra_No_Dau_Hang",
  CTV: "CTV",
  CAI_DAT: "Cai_Dat_Tai_Chinh",
  LICH_SU_GIA: "Lich_Su_Gia",
  BAO_CAO_21H: "Bao_Cao_21h",
  CHI_PHI: "Chi_Phi_Ngoai",
} as const

export const COT: Record<string, string[]> = {
  [BANG.DAU_HANG]: ["ID", "Tên", "SĐT", "Số Ngày Nợ", "Ngân Hàng", "Số Tài Khoản", "Loại Hàng Hay Nhập", "Ghi Chú", "Trạng Thái", "Ngày Tạo"],
  [BANG.LO_NHAP]: [
    "Mã Lô", "ID Đầu Hàng", "Tên Đầu Hàng", "Ngày Nhập", "Chi Phí Lô", "Chi Phí Trả Đầu Hàng",
    "Đã Trả Lúc Nhập", "Hạn Trả Nợ", "Tổng Hoá Đơn", "Ghi Chú", "Trạng Thái", "Người Tạo", "Ngày Tạo", "Chi Nhánh",
  ],
  // Sổ lô: mỗi máy nhập 1 dòng, KHÔNG BAO GIỜ XOÁ. Phần "tình trạng" do app tự cập nhật.
  [BANG.CHI_TIET_LO]: [
    "Mã Lô", "ID Máy", "IMEI", "Serial", "Tên Sản Phẩm", "Loại Máy", "Dung Lượng", "Màu Sắc", "Pin (%)",
    "Tình Trạng Máy", "Dạng Sim", "Giá Nhập", "Giá Bán Lúc Nhập", "Ngày Nhập",
    "Giá Sàn", "CTV Đang Giữ", "Ngày Giao CTV",
    "Trạng Thái", "Mã Đơn", "Ngày Bán", "Giá Bán Thực", "Người Bán", "Lãi Máy",
    "CTV Bán", "Hoa Hồng CTV", "Phí Trả Góp", "Phí Khác", "Đã Thu Đủ",
    "Ghi Chú", "Cập Nhật Lúc", "Chi Nhánh",
  ],
  [BANG.TRA_NO]: ["ID", "ID Đầu Hàng", "Tên Đầu Hàng", "Ngày Trả", "Số Tiền", "Mã Lô Chọn", "Phân Bổ", "Nguồn Tiền", "Ghi Chú", "Người Ghi", "Ngày Tạo"],
  [BANG.CTV]: ["ID", "Tên", "SĐT", "Hoa Hồng Mặc Định", "Ghi Chú", "Trạng Thái", "Ngày Tạo"],
  [BANG.CAI_DAT]: ["Khoá", "Giá Trị", "Mô Tả"],
  [BANG.LICH_SU_GIA]: ["Thời Gian", "ID Máy", "IMEI/Serial", "Tên Sản Phẩm", "Giá Cũ", "Giá Mới", "Lý Do", "Người Duyệt", "Chi Nhánh"],
  [BANG.BAO_CAO_21H]: ["Ngày", "Chi Nhánh", "Tạo Lúc", "Nội Dung", "Bài Đăng", "Đã Gửi Telegram", "Ghi Chú"],
  // Chi phí ngoài: quảng cáo, phụ kiện lẻ, ship đơn ngoài... Trừ vào lãi tháng; gắn lô thì trừ vào lãi lô.
  [BANG.CHI_PHI]: ["ID", "Ngày", "Loại", "Số Tiền", "Mã Đơn", "Mã Lô", "Nguồn Tiền", "ID Nguồn Tiền", "Ghi Chú", "Trạng Thái", "Người Ghi", "Ngày Tạo", "Chi Nhánh"],
}

/* ------------------------------------------------------------ tiện ích */
export function cotChu(n: number): string {
  // 1 -> A, 27 -> AA
  let s = ""
  while (n > 0) {
    const m = (n - 1) % 26
    s = String.fromCharCode(65 + m) + s
    n = Math.floor((n - m) / 26)
  }
  return s || "A"
}
const q = (t: string) => `'${t.replace(/'/g, "''")}'`

export type Dong = Record<string, string> & { _dong: number }

/** Tạo bảng (nếu chưa có) và bổ sung các cột còn thiếu vào cuối, không đụng cột cũ. */
export async function damBaoBang(ten: string, cot: string[] = COT[ten]) {
  await ensureSheetExists(ten)
  const { header } = await readFromGoogleSheets(ten, "A1:ZZ1", { silent: true, force: true })
  const h = (header || []).map((x) => String(x ?? "").trim())
  if (!h.some(Boolean)) {
    await updateRangeValues(`${q(ten)}!A1:${cotChu(cot.length)}1`, [cot])
    return
  }
  const thieu = cot.filter((c) => colIndex(h, c) === -1)
  if (!thieu.length) return
  await updateRangeValues(`${q(ten)}!${cotChu(h.length + 1)}1:${cotChu(h.length + thieu.length)}1`, [thieu])
}

/** Đọc bảng thành mảng object theo tên cột. Bảng chưa có -> []. */
export async function docBang(ten: string): Promise<{ header: string[]; dong: Dong[] }> {
  let data
  try {
    data = await readFromGoogleSheets(ten, undefined, { silent: true, force: true })
  } catch {
    return { header: [], dong: [] }
  }
  const header = (data.header || []).map((x: any) => String(x ?? "").trim())
  const dong: Dong[] = []
  ;(data.rows || []).forEach((r: any[], i: number) => {
    if (!r || !r.some((v) => String(v ?? "").trim() !== "")) return
    const o: any = { _dong: i + 2 }
    header.forEach((h, j) => {
      if (h) o[h] = String(r[j] ?? "").trim()
    })
    dong.push(o)
  })
  return { header, dong }
}

/** Thêm các dòng (object theo tên cột) vào cuối bảng. */
export async function themDong(ten: string, ds: Record<string, any>[]) {
  if (!ds.length) return
  await damBaoBang(ten)
  const { header } = await readFromGoogleSheets(ten, "A1:ZZ1", { silent: true, force: true })
  const h = (header || []).map((x: any) => String(x ?? "").trim())
  const rows = ds.map((o) => h.map((c) => (o[c] === undefined || o[c] === null ? "" : o[c])))
  const r = await appendMultipleToGoogleSheets(ten, rows)
  if (!r.success) throw new Error((r as any).error || `Không ghi được bảng ${ten}`)
}

/** Sửa một số ô của các dòng đã có (theo số dòng). */
export async function suaDong(ten: string, header: string[], sua: { dong: number; giaTri: Record<string, any> }[]) {
  const items: { range: string; values: any[][] }[] = []
  for (const s of sua) {
    for (const [c, v] of Object.entries(s.giaTri)) {
      const j = colIndex(header, c)
      if (j === -1) throw new Error(`Bảng ${ten} thiếu cột "${c}"`)
      items.push({ range: `${q(ten)}!${cotChu(j + 1)}${s.dong}`, values: [[v === undefined || v === null ? "" : v]] })
    }
  }
  if (!items.length) return
  const r: any = await batchUpdateRangeValues(items)
  if (r && r.success === false) throw new Error(r.error || `Không sửa được bảng ${ten}`)
}

export const so = (v: unknown) => {
  const s = String(v ?? "").replace(/[^\d-]/g, "")
  const n = Number(s)
  return Number.isFinite(n) ? n : 0
}
export const coKhong = (v: unknown) => /^(có|co|true|x|yes|1)$/i.test(String(v ?? "").trim())
