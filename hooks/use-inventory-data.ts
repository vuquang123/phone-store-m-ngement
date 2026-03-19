import { useQuery } from "@tanstack/react-query"

export function useInventoryData() {
  return useQuery({
    queryKey: ["inventory"],
    queryFn: async () => {
      const res = await fetch("/api/kho-hang", { cache: "no-store" })
      if (!res.ok) throw new Error("Failed to fetch inventory")
      return res.json()
    },
  })
}

export function usePartnerData() {
  return useQuery({
    queryKey: ["partner-inventory"],
    queryFn: async () => {
      const res = await fetch("/api/doi-tac/hang-order", { cache: "no-store" })
      if (!res.ok) throw new Error("Failed to fetch partner inventory")
      return res.json()
    },
  })
}

export function useCNCData() {
  return useQuery({
    queryKey: ["cnc-inventory"],
    queryFn: async () => {
      const res = await fetch("/api/kho-hang/cnc", { cache: "no-store" })
      if (!res.ok) throw new Error("Failed to fetch CNC data")
      return res.json()
    },
  })
}

export function useBaoHanhHistory() {
  return useQuery({
    queryKey: ["baohanh-history"],
    queryFn: async () => {
      const res = await fetch("/api/kho-hang/baohanh-history", { cache: "no-store" })
      if (!res.ok) throw new Error("Failed to fetch warranty history")
      return res.json()
    },
  })
}

export function useAccessoriesData() {
  return useQuery({
    queryKey: ["accessories-inventory"],
    queryFn: async () => {
      const res = await fetch("/api/phu-kien", { cache: "no-store" })
      if (!res.ok) throw new Error("Failed to fetch accessories data")
      return res.json()
    },
  })
}
