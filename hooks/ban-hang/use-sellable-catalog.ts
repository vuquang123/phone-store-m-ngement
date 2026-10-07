"use client"
// Catalog dùng cho trang Bán hàng, dựng trên CHÍNH các React Query key mà trang Kho hàng
// đang dùng ("inventory" / "accessories-inventory" / "partner-inventory").
//
// Trước đây trang Bán hàng tự fetch 3 endpoint này bằng useEffect riêng, nên mở cả 2 trang
// là 6 lượt đọc Google Sheets thay vì 3 (góp phần làm chạm quota). Dùng chung query key thì
// React Query tự dedupe, và nút "Làm mới" / pull-to-refresh ở trang Kho hàng cũng làm mới
// luôn dữ liệu cho trang Bán hàng.
import { useMemo } from "react"
import { useInventoryData, useAccessoriesData, usePartnerData } from "@/hooks/use-inventory-data"
import {
  normalizeKhoProducts,
  normalizePartnerProducts,
  normalizeAccessories,
  type CatalogProduct,
  type CatalogAccessory,
} from "@/lib/catalog/normalize"

export interface SellableCatalog {
  /** Máy kho shop, đã lọc theo trạng thái được phép bán. */
  khoHangProducts: CatalogProduct[]
  /** Máy của kho đối tác ("Kho ngoài"). */
  partnerProducts: CatalogProduct[]
  /** Phụ kiện còn tồn > 0 — danh sách được phép bán. */
  accessoryProducts: CatalogAccessory[]
  /** Toàn bộ phụ kiện, kể cả đã hết tồn — dùng để tra cứu trong giỏ. */
  allAccessoryProducts: CatalogAccessory[]
  isLoading: boolean
}

export function useSellableCatalog(): SellableCatalog {
  const inventory = useInventoryData()
  const accessories = useAccessoriesData()
  const partner = usePartnerData()

  // Lỗi thì trả mảng rỗng (giữ đúng hành vi cũ: catch -> set [] ), không để UI vỡ.
  const khoHangProducts = useMemo(
    () => (inventory.data ? normalizeKhoProducts(inventory.data) : []),
    [inventory.data],
  )
  const partnerProducts = useMemo(
    () => (partner.data ? normalizePartnerProducts(partner.data) : []),
    [partner.data],
  )
  const { all: allAccessoryProducts, inStock: accessoryProducts } = useMemo(
    () => (accessories.data ? normalizeAccessories(accessories.data) : { all: [], inStock: [] }),
    [accessories.data],
  )

  return {
    khoHangProducts,
    partnerProducts,
    accessoryProducts,
    allAccessoryProducts,
    isLoading: inventory.isLoading || accessories.isLoading || partner.isLoading,
  }
}
