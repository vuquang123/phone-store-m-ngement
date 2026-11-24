// lib/kho/thu-may.ts
// Máy THU CŨ trong đơn bán (thanh toán "Thu máy") -> tự nhập vào Kho_Hang ngay khi xuất đơn.
// Chỉ có tên máy, loại máy, IMEI và giá thu; các thông tin khác (dung lượng, màu, pin...) chủ shop điền tay sau.
import { readFromGoogleSheets, updateRangeValues, colIndex } from "@/lib/google-sheets"
import { getDeviceId, last5FromDeviceId } from "@/lib/device-id"
import { parseVietnameseNumber } from "@/lib/number"

export type MayThu = { ten: string; loai: string; imei: string; gia: number }

/** Đọc từ body.thu_may (FE mới) hoặc từ ghi chú "[Thu máy cũ] Tên - Loại | IMEI: x | Giá thu: ₫n". */
export function docMayThu(body: any): MayThu | null {
  const t = body?.thu_may
  if (t && (t.imei || t.ten)) {
    return {
      ten: String(t.ten || "").trim(),
      loai: String(t.loai || "").trim(),
      imei: String(t.imei || "").replace(/\s+/g, "").trim(),
      gia: Math.max(0, Math.round(Number(t.gia) || 0)),
    }
  }
  const note = String(body?.ghi_chu || body?.["Ghi Chú"] || "")
  const m = note.match(/\[Thu máy cũ\]\s*([^|]*?)\s*\|\s*IMEI:\s*([A-Za-z0-9]+)\s*\|\s*Giá thu:\s*₫?\s*([\d.,]+)/i)
  if (!m) return null
  const tenLoai = m[1].trim()
  const cat = tenLoai.lastIndexOf(" - ")
  return {
    ten: cat === -1 ? tenLoai : tenLoai.slice(0, cat).trim(),
    loai: cat === -1 ? "" : tenLoai.slice(cat + 3).trim(),
    imei: m[2].trim(),
    gia: parseVietnameseNumber(m[3]),
  }
}

/**
 * Thêm máy thu vào Kho_Hang (Kho trong, Còn hàng). Bỏ qua nếu không có IMEI hoặc IMEI đã có trong kho.
 * Trả về "added" | "exists" | "skip".
 */
export async function nhapKhoMayThu(may: MayThu, opts: { maDon: string; chiNhanh: string | null }) {
  const imei = may.imei.trim()
  if (!imei) return "skip" as const
  const { header: KH, rows: KR } = await readFromGoogleSheets("Kho_Hang", undefined, { force: true })
  const k = {
    idMay: colIndex(KH, "ID Máy"),
    ngayNhap: colIndex(KH, "Ngày Nhập"),
    tenSP: colIndex(KH, "Tên Sản Phẩm"),
    loaiMay: colIndex(KH, "Loại Máy"),
    imei: colIndex(KH, "IMEI"),
    giaNhap: colIndex(KH, "Giá Nhập", "Giá nhập"),
    trangThai: colIndex(KH, "Trạng Thái"),
    trangThaiKho: colIndex(KH, "Trạng Thái Kho", "Trạng thái kho"),
    dangXuLy: colIndex(KH, "Đang xử lý", "Đang Xử Lý"),
    ghiChu: colIndex(KH, "Ghi Chú"),
    chiNhanh: colIndex(KH, "Chi Nhánh"),
  }
  if (k.imei === -1) return "skip" as const
  const da = KR.some((r) => String(r[k.imei] || "").replace(/\s+/g, "").trim() === imei)
  if (da) return "exists" as const
  const deviceId = getDeviceId({ IMEI: imei, Serial: "" })
  const ngay = new Date().toLocaleDateString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" })
  const row = KH.map((_h, ci) => {
    if (ci === k.idMay) return deviceId ? last5FromDeviceId(deviceId) : imei.slice(-5)
    if (ci === k.ngayNhap) return ngay
    if (ci === k.tenSP) return may.ten
    if (ci === k.loaiMay) return may.loai
    if (ci === k.imei) return imei
    if (ci === k.giaNhap) return may.gia || ""
    if (ci === k.trangThai) return "Còn hàng"
    if (ci === k.trangThaiKho) return "Kho trong"
    if (ci === k.dangXuLy) return "No"
    if (ci === k.ghiChu) return `Thu máy cũ từ đơn ${opts.maDon}, cần bổ sung dung lượng, màu, pin`
    if (ci === k.chiNhanh) return opts.chiNhanh || ""
    return ""
  })
  // Ghi đúng dòng kế tiếp, neo cột A (không dùng append vì có thể neo lệch cột)
  await updateRangeValues(`Kho_Hang!A${KR.length + 2}`, [row])
  return "added" as const
}
