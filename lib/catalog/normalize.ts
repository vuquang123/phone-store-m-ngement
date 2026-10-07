// Chuẩn hoá dữ liệu catalog (máy kho trong / máy kho ngoài / phụ kiện) về MỘT shape
// dùng chung cho cả trang Bán hàng và trang Kho hàng.
//
// Trước đây mỗi trang tự fetch + tự map một kiểu, nên cùng một chiếc máy lại có 2 shape
// khác nhau và mọi bộ lọc phải viết 2 lần với fallback field khác nhau. Toàn bộ phần map
// được gom về đây để chỉ còn 1 nguồn sự thật.
import { isSellableStatus } from "@/lib/utils/inventory-helpers"

/** Máy (kho trong hoặc kho ngoài) đã chuẩn hoá cho luồng bán hàng. */
export interface CatalogProduct {
  id: string
  type: "product"
  ten_san_pham: string
  loai_may?: string
  dung_luong?: string
  mau_sac?: string
  pin?: string | number
  imei?: string
  serial?: string
  tinh_trang?: string
  tinh_trang_may?: string
  trang_thai?: string
  gia_ban?: number | string
  gia_nhap?: number | string
  giam_gia?: number | string
  ghi_chu?: string
  nguon?: string
  source?: string
  nguon_nhap?: string
  so_luong?: number
  max_quantity?: number
  // Chỉ có ở máy kho ngoài — API bán hàng cần để xoá đúng dòng ở sheet đối tác.
  partner_sheet?: string
  partner_row_index?: number | string
  ten_doi_tac?: string
  sdt_doi_tac?: string
  [key: string]: any
}

/** Phụ kiện đã chuẩn hoá. */
export interface CatalogAccessory {
  id: string
  type: "accessory"
  ten_san_pham: string
  ten_phu_kien?: string
  loai_phu_kien?: string
  so_luong_ton?: number | string
  gia_ban: number
  gia_nhap?: number | string
  [key: string]: any
}

/** API trả về `[...]` hoặc `{ data: [...] }` tuỳ endpoint. */
function rowsOf(payload: any): any[] {
  if (Array.isArray(payload)) return payload
  if (Array.isArray(payload?.data)) return payload.data
  return []
}

/**
 * Máy trong kho của shop, CHỈ những máy được phép bán ("Còn hàng" / "Đang CNC").
 *
 * Lưu ý: bản đồ key tiếng Việt ('Tên Sản Phẩm', 'Pin (%)'…) là nợ kỹ thuật — giỏ hàng
 * spread nguyên item rồi dựng payload đơn hàng từ các key đó. Giữ nguyên ở giai đoạn này
 * để không đổi hành vi; sẽ bỏ khi payload checkout được dựng tường minh.
 */
export function normalizeKhoProducts(payload: any): CatalogProduct[] {
  return rowsOf(payload)
    .filter((p: any) => isSellableStatus(p.trang_thai))
    .map((p: any) => ({
      ...p,
      id: p["ID Máy"] || p.id_may || p.id,
      type: "product" as const,
      gia_nhap: p.gia_nhap ?? p["Giá Nhập"] ?? "",
      nguon_nhap: p.nguon_nhap ?? p["Nguồn nhập"] ?? p["Nguồn Nhập"] ?? "",
      "Tên Sản Phẩm": p.ten_san_pham,
      "Loại Máy": p.loai_may,
      "Dung Lượng": p.dung_luong,
      IMEI: p.imei,
      serial: p.serial || p["Serial"] || "",
      "Màu Sắc": p.mau_sac,
      "Pin (%)": p.pin,
      "Tình Trạng Máy": p.tinh_trang_may,
      giam_gia: p.giam_gia ?? 0,
      ghi_chu: p.ghi_chu ?? p["Ghi Chú"] ?? "",
    }))
}

/** Máy của kho đối tác (`/api/doi-tac/hang-order` trả `{ items: [...] }`). */
export function normalizePartnerProducts(payload: any): CatalogProduct[] {
  const items = Array.isArray(payload?.items) ? payload.items : []
  return items.map((p: any) => ({
    id: p.imei || p.serial || p.id,
    type: "product" as const,
    ten_san_pham: p.model || "",
    gia_ban: typeof p.gia_goi_y_ban === "number" ? p.gia_goi_y_ban : 0,
    gia_nhap: typeof p.gia_chuyen === "number" ? p.gia_chuyen : 0,
    so_luong: 1,
    max_quantity: 1,
    imei: p.imei || "",
    serial: p.serial || "",
    trang_thai: "Còn hàng",
    loai_may: p.loai_may || "",
    dung_luong: p.bo_nho || "",
    mau_sac: p.mau || "",
    pin: p.pin_pct || "",
    tinh_trang: p.tinh_trang || "",
    source: "Kho ngoài",
    nguon: "Kho ngoài",
    partner_sheet: p.sheet,
    partner_row_index: p.row_index,
    ten_doi_tac: p.ten_doi_tac || "",
    sdt_doi_tac: p.sdt_doi_tac || "",
  }))
}

/** Giá phụ kiện trong sheet là chuỗi có dấu phân cách ("50.000 đ") -> ép về số. */
function accessoryPrice(raw: any): number {
  if (typeof raw === "number") return raw
  if (typeof raw === "string") {
    const cleaned = raw.replace(/[^\d]/g, "")
    return cleaned ? parseInt(cleaned, 10) : 0
  }
  return 0
}

/**
 * Phụ kiện. Trả cả 2 danh sách vì chúng phục vụ 2 việc khác nhau:
 * - `all`: dùng để tra cứu/hiển thị trong giỏ (kể cả hàng đã hết tồn).
 * - `inStock`: danh sách được phép bán/tìm kiếm (tồn > 0).
 */
export function normalizeAccessories(payload: any): {
  all: CatalogAccessory[]
  inStock: CatalogAccessory[]
} {
  const all = rowsOf(payload).map((a: any) => ({
    ...a,
    type: "accessory" as const,
    ten_san_pham: a.ten_san_pham || a.ten_phu_kien || "",
    gia_ban: accessoryPrice(a.gia_ban),
  }))
  return { all, inStock: all.filter((a) => Number(a.so_luong_ton) > 0) }
}

/** Nhận diện phụ kiện trong danh sách trộn máy + phụ kiện. */
export function isAccessoryItem(p: any): boolean {
  return p?.type === "accessory" || (!!p?.loai_phu_kien && !p?.imei && !p?.serial)
}
