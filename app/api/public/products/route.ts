import { type NextRequest, NextResponse } from "next/server"

import { readFromGoogleSheets, colIndex } from "@/lib/google-sheets"
import { withCors, isValidApiKey, resolveAllowedOrigin } from "@/lib/public-api"

export const dynamic = "force-dynamic"

const SHEET = "Kho_Hang"

function toNumber(v: unknown): number {
  if (v === null || v === undefined) return 0
  const s = String(v)
    .replace(/\./g, "")
    .replace(/đ/g, "")
    .replace(/,/g, "")
    .replace(/\s+/g, "")
    .replace(/[^\d]/g, "")
  const n = Number(s)
  return Number.isFinite(n) ? n : 0
}

function buildProducts(header: string[], rows: string[][]) {
  const idxId = colIndex(header, "ID May", "ID Máy")
  const idxName = colIndex(header, "Ten San Pham", "Tên Sản Phẩm")
  const idxType = colIndex(header, "Loai May", "Loại Máy")
  const idxStorage = colIndex(header, "Dung Luong", "Dung Lượng")
  const idxColor = colIndex(header, "Mau Sac", "Màu Sắc")
  const idxBattery = colIndex(header, "Pin (%)")
  const idxImei = colIndex(header, "IMEI")
  const idxCondition = colIndex(header, "Tinh Trang May", "Tình Trạng Máy")
  const idxGiaNhap = colIndex(header, "Gia Nhap", "Giá Nhập")
  const idxGiaBan = colIndex(header, "Gia Ban", "Giá Bán")
  const idxStatus = colIndex(header, "Trang Thai", "Trạng Thái")
  const idxSource = colIndex(header, "Nguon", "Nguồn", "Nguon Hang", "Nguồn Hàng")
  const idxNote = colIndex(header, "Ghi Chu", "Ghi Chú")

  return rows.map((row) => ({
    id: idxId !== -1 ? row[idxId] : "",
    ten_san_pham: idxName !== -1 ? row[idxName] : "",
    loai_may: idxType !== -1 ? row[idxType] : "",
    dung_luong: idxStorage !== -1 ? row[idxStorage] : "",
    mau_sac: idxColor !== -1 ? row[idxColor] : "",
    pin: idxBattery !== -1 ? row[idxBattery] : "",
    imei: idxImei !== -1 ? row[idxImei] : "",
    tinh_trang: idxCondition !== -1 ? row[idxCondition] : "",
    gia_nhap: idxGiaNhap !== -1 ? toNumber(row[idxGiaNhap]) : 0,
    gia_ban: idxGiaBan !== -1 ? toNumber(row[idxGiaBan]) : 0,
    trang_thai: idxStatus !== -1 ? row[idxStatus] : "",
    nguon: idxSource !== -1 ? row[idxSource] : "",
    ghi_chu: idxNote !== -1 ? row[idxNote] : "",
  }))
}

export async function OPTIONS(request: NextRequest) {
  const origin = request.headers.get("origin")
  const response = new NextResponse(null, { status: 204 })
  return withCors(response, origin)
}

export async function GET(request: NextRequest) {
  const origin = request.headers.get("origin")
  const allowedOrigin = resolveAllowedOrigin(origin)

  if (origin && !allowedOrigin) {
    return withCors(
      NextResponse.json({ error: "Origin is not allowed" }, { status: 403 }),
      origin,
    )
  }

  const apiKey = request.headers.get("x-api-key")
  if (!isValidApiKey(apiKey)) {
    return withCors(
      NextResponse.json({ error: "Invalid API key" }, { status: 401 }),
      origin,
    )
  }

  try {
    const { header, rows } = await readFromGoogleSheets(SHEET)
    const data = buildProducts(header, rows)

    return withCors(
      NextResponse.json({ data, total: data.length }, { status: 200 }),
      origin,
    )
  } catch (error) {
    console.error("[public/products] GET error:", error)
    return withCors(
      NextResponse.json({ error: "Internal server error" }, { status: 500 }),
      origin,
    )
  }
}
