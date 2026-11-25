// Cột "Để Ở Shop" của Kho_Hang.
// Máy lô mới về được nhập vào danh sách trước khi chốt giá/điền đủ thông tin: lúc đó "Để Ở Shop" = No
// và chỉ chủ shop + quản lý thấy. Nhân viên, website và đếm check-in chỉ tính máy "Để Ở Shop" khác No.
// Ô trống (máy cũ, máy nhập tay) = đang ở shop.
import { isManagerRole } from "@/lib/roles"
import { batchUpdateRangeValues, colIndex, ensureColumn, readFromGoogleSheets } from "@/lib/google-sheets"

export const COT_DE_O_SHOP = "Để Ở Shop"
const SHEET = "Kho_Hang"

export function deOShopIndex(header: unknown[]): number {
  return colIndex((header || []) as string[], COT_DE_O_SHOP, "De O Shop", "Để ở shop")
}

/** "No"/"Không"/"0"/"false" = chưa để ở shop. Ô trống hoặc giá trị khác = đang ở shop. */
export function laChuaDeOShop(v: unknown): boolean {
  const s = String(v ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim()
    .toLowerCase()
  return s === "no" || s === "khong" || s === "0" || s === "false" || s === "n"
}

export function giaTriDeOShop(header: unknown[], row: unknown[]): "Yes" | "No" {
  const i = deOShopIndex(header)
  return i !== -1 && laChuaDeOShop(row?.[i]) ? "No" : "Yes"
}

/** Bỏ máy chưa để ở shop. `role` là quản lý/chủ shop thì giữ nguyên; truyền null để luôn bỏ (website, check-in). */
export function locMayDeOShop<T extends unknown[]>(header: unknown[], rows: T[], role: unknown | null): T[] {
  if (role !== null && isManagerRole(role)) return rows
  const i = deOShopIndex(header)
  if (i === -1) return rows
  return rows.filter((r) => !laChuaDeOShop(r?.[i]))
}

/** Đặt "Để Ở Shop" = Yes/No cho các máy theo ID Máy (hoặc IMEI/Serial). Tự thêm cột nếu chưa có. */
export async function datDeOShop(ids: string[], value: "Yes" | "No") {
  const can = new Set(ids.map((x) => String(x || "").trim().toUpperCase()).filter(Boolean))
  if (!can.size) return { capNhat: 0 }
  const idxCot = await ensureColumn(SHEET, COT_DE_O_SHOP)
  const { header, rows } = await readFromGoogleSheets(SHEET, undefined, { force: true })
  const iId = colIndex(header, "ID Máy")
  const iIm = colIndex(header, "IMEI")
  const iSe = colIndex(header, "Serial")
  const chu = cotChu(idxCot + 1)
  const items: { range: string; values: any[][] }[] = []
  rows.forEach((r, k) => {
    const khop = [iId, iIm, iSe].some((j) => j !== -1 && can.has(String(r[j] || "").trim().toUpperCase()))
    if (khop) items.push({ range: `'${SHEET}'!${chu}${k + 2}`, values: [[value]] })
  })
  if (items.length) await batchUpdateRangeValues(items)
  return { capNhat: items.length }
}

function cotChu(n: number) {
  let s = ""
  while (n > 0) {
    const m = (n - 1) % 26
    s = String.fromCharCode(65 + m) + s
    n = Math.floor((n - 1) / 26)
  }
  return s
}
