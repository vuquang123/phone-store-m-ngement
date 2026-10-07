import { create } from 'zustand'

// Store bộ lọc dùng CHUNG cho trang Kho hàng và trang Bán hàng.
// Trước đây mỗi trang giữ một bộ state riêng với tên khác nhau cho cùng một bộ lọc
// (trangThai/loaiMayFilter, sourceFilter/filterSource, searchTerm/searchQuery...), nên mọi
// predicate lọc phải viết 2 lần. Gom về đây để 2 trang nhìn cùng một giá trị.

export type SourceFilter = "all" | "kho" | "doi_tac"
export type LoaiMayFilter = "all" | "Lock" | "Qte"
export type PinFilter = "all" | "100" | "9x" | "8x" | "7x" | "lt70"
/** Nhóm hàng đang xem ở trang Bán hàng. */
export type FilterType = "all" | "iphone" | "ipad" | "phu_kien" | "sim_ghep"

export const MAX_PRICE = 50000000

/** Phần state có thể nạp lại từ localStorage theo lô (xem useFilterPersistence). */
export interface InventoryFilters {
  searchTerm: string
  loaiMayFilter: LoaiMayFilter
  sourceFilter: SourceFilter
  filterType: FilterType
  productNameFilter: string
  colorFilter: string
  capacityFilter: string
  pinFilter: PinFilter
  priceRange: [number, number]
}

interface InventoryState extends InventoryFilters {
  // Actions
  setSearchTerm: (term: string) => void
  setLoaiMayFilter: (filter: LoaiMayFilter) => void
  setSourceFilter: (filter: SourceFilter) => void
  setFilterType: (filter: FilterType) => void
  setProductNameFilter: (filter: string) => void
  setColorFilter: (filter: string) => void
  setCapacityFilter: (filter: string) => void
  setPinFilter: (filter: PinFilter) => void
  setPriceRange: (range: [number, number]) => void
  /** Nạp nhiều bộ lọc một lượt (dùng khi hydrate từ localStorage). */
  setFilters: (filters: Partial<InventoryFilters>) => void
  resetFilters: () => void
}

const DEFAULT_FILTERS: InventoryFilters = {
  searchTerm: "",
  loaiMayFilter: "all",
  sourceFilter: "all",
  filterType: "all",
  productNameFilter: "all",
  colorFilter: "all",
  capacityFilter: "all",
  pinFilter: "all",
  priceRange: [0, MAX_PRICE],
}

export const useInventoryStore = create<InventoryState>((set) => ({
  ...DEFAULT_FILTERS,

  setSearchTerm: (searchTerm) => set({ searchTerm }),
  setLoaiMayFilter: (loaiMayFilter) => set({ loaiMayFilter }),
  setSourceFilter: (sourceFilter) => set({ sourceFilter }),
  setFilterType: (filterType) => set({ filterType }),
  setProductNameFilter: (productNameFilter) => set({ productNameFilter }),
  setColorFilter: (colorFilter) => set({ colorFilter }),
  setCapacityFilter: (capacityFilter) => set({ capacityFilter }),
  setPinFilter: (pinFilter) => set({ pinFilter }),
  setPriceRange: (priceRange) => set({ priceRange }),

  setFilters: (filters) => set(filters),
  resetFilters: () => set({ ...DEFAULT_FILTERS }),
}))
