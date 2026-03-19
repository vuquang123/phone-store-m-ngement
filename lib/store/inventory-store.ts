import { create } from 'zustand'

interface InventoryState {
  // Filters
  searchTerm: string
  trangThai: string
  sourceFilter: "all" | "kho" | "doi_tac"
  productNameFilter: string
  colorFilter: string
  capacityFilter: string
  pinFilter: "all" | "100" | "9x" | "8x" | "7x" | "lt70"
  khoFilter: "all" | "co_san" | "khong_san"
  priceRange: [number, number]
  conditionFilter: "all" | "nguyen_ban" | "cnc"
  
  // Tab state
  activeTab: string
  
  // Actions
  setSearchTerm: (term: string) => void
  setTrangThai: (status: string) => void
  setSourceFilter: (filter: "all" | "kho" | "doi_tac") => void
  setProductNameFilter: (filter: string) => void
  setColorFilter: (filter: string) => void
  setCapacityFilter: (filter: string) => void
  setPinFilter: (filter: "all" | "100" | "9x" | "8x" | "7x" | "lt70") => void
  setKhoFilter: (filter: "all" | "co_san" | "khong_san") => void
  setPriceRange: (range: [number, number]) => void
  setConditionFilter: (filter: "all" | "nguyen_ban" | "cnc") => void
  setActiveTab: (tab: string) => void
  resetFilters: () => void
}

export const useInventoryStore = create<InventoryState>((set) => ({
  searchTerm: "",
  trangThai: "all",
  sourceFilter: "all",
  productNameFilter: "all",
  colorFilter: "all",
  capacityFilter: "all",
  pinFilter: "all",
  khoFilter: "all",
  priceRange: [0, 50000000],
  conditionFilter: "all",
  activeTab: "san-pham",

  setSearchTerm: (searchTerm) => set({ searchTerm }),
  setTrangThai: (trangThai) => set({ trangThai }),
  setSourceFilter: (sourceFilter) => set({ sourceFilter }),
  setProductNameFilter: (productNameFilter) => set({ productNameFilter }),
  setColorFilter: (colorFilter) => set({ colorFilter }),
  setCapacityFilter: (capacityFilter) => set({ capacityFilter }),
  setPinFilter: (pinFilter) => set({ pinFilter }),
  setKhoFilter: (khoFilter) => set({ khoFilter }),
  setPriceRange: (priceRange) => set({ priceRange }),
  setConditionFilter: (conditionFilter) => set({ conditionFilter }),
  setActiveTab: (activeTab) => set({ activeTab }),
  
  resetFilters: () => set({
    searchTerm: "",
    trangThai: "all",
    sourceFilter: "all",
    productNameFilter: "all",
    colorFilter: "all",
    capacityFilter: "all",
    pinFilter: "all",
    khoFilter: "all",
    priceRange: [0, 50000000],
    conditionFilter: "all",
  }),
}))
