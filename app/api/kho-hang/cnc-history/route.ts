import { NextResponse } from "next/server"
import { readFromGoogleSheets } from "@/lib/google-sheets"

export const dynamic = "force-dynamic"

const CNC_SHEET = "CNC"

function findIndex(header: any[], candidates: string[], fallback: number) {
  const norm = (s: any) =>
    String(s || "")
      .trim()
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "")
      .toLowerCase()
  for (const name of candidates) {
    const idx = header.findIndex((h) => norm(h) === norm(name))
    if (idx !== -1) return idx
  }
  return fallback
}

export async function GET() {
  try {
    // Lấy trực tiếp từ sheet CNC hiện tại
    const { header, rows } = await readFromGoogleSheets(CNC_SHEET)
    const idxId = findIndex(header, ["id may", "id_may", "id máy", "id"], 0)
    const idxImei = findIndex(header, ["imei", "imei"], 0)
    const idxTen = findIndex(header, ["tên sản phẩm", "ten san pham"], 1)
    const idxTrangThai = findIndex(header, ["trạng thái", "trang thai"], 2)
    const idxNgayGui = findIndex(header, ["ngày gửi", "ngay gui"], 3)
    const idxDiaChi = findIndex(header, ["địa chỉ cnc", "dia chi cnc"], 4)
    const idxNguon = findIndex(header, ["nguon", "nguồn"], 5)

    // Dữ liệu hiển thị: dùng ngày gửi làm mốc thời gian
    const items = rows.map((r) => {
      const id_may = String(r[idxId] || "").trim()
      const imei = String(r[idxImei] || "").trim()
      return {
        id_may,
        imei: imei || id_may,
        ten_san_pham: String(r[idxTen] || "").trim(),
        trang_thai_cu: "",
        trang_thai_moi: String(r[idxTrangThai] || "").trim(),
        thoi_gian: String(r[idxNgayGui] || "").trim(),
        nguoi_thay_doi: String(r[idxNguon] || "").trim(),
        dia_chi_cnc: String(r[idxDiaChi] || "").trim(),
      }
    })

    // Sắp xếp mới nhất lên đầu (nếu ngày gửi có giá trị date-like)
    const sorted = [...items].sort((a, b) => {
      const ta = new Date(a.thoi_gian || "").getTime()
      const tb = new Date(b.thoi_gian || "").getTime()
      if (Number.isNaN(ta) || Number.isNaN(tb)) return 0
      return tb - ta
    })

    return NextResponse.json({ data: sorted })
  } catch (error) {
    console.error("[CNC_HISTORY]", error)
    return NextResponse.json({ error: "Lỗi lấy lịch sử CNC" }, { status: 500 })
  }
}
