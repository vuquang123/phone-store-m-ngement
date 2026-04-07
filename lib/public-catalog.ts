import { colIndex } from "@/lib/google-sheets"

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

function norm(v: unknown): string {
  return String(v ?? "").trim().toLowerCase()
}

export type PublicProduct = {
  type: "product"
  id: string
  ten_san_pham: string
  loai_may: string
  dung_luong: string
  mau_sac: string
  pin: string
  imei: string
  tinh_trang: string
  gia_nhap: number
  gia_ban: number
  trang_thai: string
  nguon: string
  ghi_chu: string
}

export type PublicAccessory = {
  type: "accessory"
  id: string
  ten_phu_kien: string
  loai_phu_kien: string
  so_luong_ton: number
  gia_nhap: number
  gia_ban: number
  ghi_chu: string
}

export function buildPublicProducts(header: string[], rows: string[][]): PublicProduct[] {
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

  return rows
    .filter((row) => {
      if (idxStatus === -1) return true
      const st = norm(row[idxStatus])
      return !st || st === "còn hàng" || st === "con hang"
    })
    .map((row) => ({
      type: "product" as const,
      id: idxId !== -1 ? row[idxId] || "" : "",
      ten_san_pham: idxName !== -1 ? row[idxName] || "" : "",
      loai_may: idxType !== -1 ? row[idxType] || "" : "",
      dung_luong: idxStorage !== -1 ? row[idxStorage] || "" : "",
      mau_sac: idxColor !== -1 ? row[idxColor] || "" : "",
      pin: idxBattery !== -1 ? row[idxBattery] || "" : "",
      imei: idxImei !== -1 ? row[idxImei] || "" : "",
      tinh_trang: idxCondition !== -1 ? row[idxCondition] || "" : "",
      gia_nhap: idxGiaNhap !== -1 ? toNumber(row[idxGiaNhap]) : 0,
      gia_ban: idxGiaBan !== -1 ? toNumber(row[idxGiaBan]) : 0,
      trang_thai: idxStatus !== -1 ? row[idxStatus] || "" : "",
      nguon: idxSource !== -1 ? row[idxSource] || "" : "",
      ghi_chu: idxNote !== -1 ? row[idxNote] || "" : "",
    }))
}

export function buildPublicAccessories(header: string[], rows: string[][]): PublicAccessory[] {
  const idxId = colIndex(header, "ID")
  const idxName = colIndex(header, "Ten San Pham", "Tên Sản Phẩm")
  const idxType = colIndex(header, "Loai", "Loại")
  const idxQty = colIndex(header, "So Luong", "Số Lượng")
  const idxGiaNhap = colIndex(header, "Gia Nhap", "Giá Nhập")
  const idxGiaBan = colIndex(header, "Gia Ban", "Giá Bán")
  const idxNote = colIndex(header, "Ghi Chu", "Ghi Chú")

  return rows
    .filter((row) => {
      if (idxQty === -1) return true
      return toNumber(row[idxQty]) > 0
    })
    .map((row) => ({
      type: "accessory" as const,
      id: idxId !== -1 ? row[idxId] || "" : "",
      ten_phu_kien: idxName !== -1 ? row[idxName] || "" : "",
      loai_phu_kien: idxType !== -1 ? row[idxType] || "" : "",
      so_luong_ton: idxQty !== -1 ? toNumber(row[idxQty]) : 0,
      gia_nhap: idxGiaNhap !== -1 ? toNumber(row[idxGiaNhap]) : 0,
      gia_ban: idxGiaBan !== -1 ? toNumber(row[idxGiaBan]) : 0,
      ghi_chu: idxNote !== -1 ? row[idxNote] || "" : "",
    }))
}

export function filterPublicSearch(
  products: PublicProduct[],
  accessories: PublicAccessory[],
  search: string,
  limit: number,
): Array<PublicProduct | PublicAccessory> {
  const q = norm(search)
  if (!q) return [...products, ...accessories].slice(0, limit)

  const productHits = products.filter((item) => {
    return (
      norm(item.ten_san_pham).includes(q) ||
      norm(item.loai_may).includes(q) ||
      norm(item.imei).includes(q)
    )
  })

  const accessoryHits = accessories.filter((item) => {
    return norm(item.ten_phu_kien).includes(q) || norm(item.loai_phu_kien).includes(q)
  })

  return [...productHits, ...accessoryHits].slice(0, limit)
}
