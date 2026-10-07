"use client"
// Nhớ bộ lọc giữa các lần vào trang, bằng localStorage.
//
// Nạp SAU khi mount (không dùng zustand/persist) để tránh lệch hydrate giữa HTML prerender
// và state đọc từ localStorage. Giữ nguyên các key "bh_*" cũ của trang Bán hàng để nhân viên
// không bị mất bộ lọc đang dùng sau khi deploy.
import { useEffect, useRef } from "react"
import {
  useInventoryStore,
  MAX_PRICE,
  type FilterType,
  type LoaiMayFilter,
  type PinFilter,
  type SourceFilter,
} from "@/lib/store/inventory-store"

const KEYS = {
  searchTerm: "bh_search_query",
  sourceFilter: "bh_filter_source",
  filterType: "bh_filter_type",
  productNameFilter: "bh_filter_name",
  loaiMayFilter: "bh_filter_loai_may",
  colorFilter: "bh_filter_color",
  capacityFilter: "bh_filter_capacity",
  pinFilter: "bh_filter_pin",
  priceRange: "bh_filter_price",
} as const

const PIN_VALUES: PinFilter[] = ["all", "100", "9x", "8x", "7x", "lt70"]
const LOAI_MAY_VALUES: LoaiMayFilter[] = ["all", "Lock", "Qte"]
const TYPE_VALUES: FilterType[] = ["all", "iphone", "ipad", "phu_kien", "sim_ghep"]

/** Giá trị "nguồn" cũ của trang Bán hàng trước khi gộp về domain của store. */
function readSourceFilter(raw: string | null): SourceFilter | undefined {
  if (raw === "all" || raw === "kho" || raw === "doi_tac") return raw
  if (raw === "inhouse") return "kho"
  if (raw === "partner") return "doi_tac"
  return undefined
}

export function useFilterPersistence() {
  const setFilters = useInventoryStore((s) => s.setFilters)
  const hydrated = useRef(false)

  // Nạp 1 lần khi mount
  useEffect(() => {
    try {
      const get = (k: string) => localStorage.getItem(k)
      const patch: Record<string, any> = {}

      const q = get(KEYS.searchTerm)
      if (q !== null) patch.searchTerm = q

      const src = readSourceFilter(get(KEYS.sourceFilter))
      if (src) patch.sourceFilter = src

      const rawType = get(KEYS.filterType)
      // "accessory" là tên nhóm cũ, nay là "phu_kien".
      const type = rawType === "accessory" ? "phu_kien" : rawType
      if (type && TYPE_VALUES.includes(type as FilterType)) patch.filterType = type

      const name = get(KEYS.productNameFilter)
      if (name) patch.productNameFilter = name

      const loai = get(KEYS.loaiMayFilter)
      if (loai && LOAI_MAY_VALUES.includes(loai as LoaiMayFilter)) patch.loaiMayFilter = loai

      const color = get(KEYS.colorFilter)
      if (color) patch.colorFilter = color

      const cap = get(KEYS.capacityFilter)
      if (cap) patch.capacityFilter = cap

      const pin = get(KEYS.pinFilter)
      if (pin && PIN_VALUES.includes(pin as PinFilter)) patch.pinFilter = pin

      const price = get(KEYS.priceRange)
      if (price) {
        const parsed = JSON.parse(price)
        if (Array.isArray(parsed) && parsed.length === 2) {
          patch.priceRange = [Number(parsed[0]) || 0, Number(parsed[1]) || MAX_PRICE]
        }
      }

      if (Object.keys(patch).length > 0) setFilters(patch)
    } catch {}
    hydrated.current = true
  }, [setFilters])

  // Ghi lại mỗi khi bộ lọc đổi. Chỉ ghi sau khi đã hydrate để lần nạp đầu không
  // đè giá trị đã lưu bằng giá trị mặc định.
  useEffect(() => {
    return useInventoryStore.subscribe((state) => {
      if (!hydrated.current) return
      try {
        localStorage.setItem(KEYS.searchTerm, state.searchTerm)
        localStorage.setItem(KEYS.sourceFilter, state.sourceFilter)
        localStorage.setItem(KEYS.filterType, state.filterType)
        localStorage.setItem(KEYS.productNameFilter, state.productNameFilter)
        localStorage.setItem(KEYS.loaiMayFilter, state.loaiMayFilter)
        localStorage.setItem(KEYS.colorFilter, state.colorFilter)
        localStorage.setItem(KEYS.capacityFilter, state.capacityFilter)
        localStorage.setItem(KEYS.pinFilter, state.pinFilter)
        localStorage.setItem(KEYS.priceRange, JSON.stringify(state.priceRange))
      } catch {}
    })
  }, [])
}
