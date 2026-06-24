import { useQuery } from "@tanstack/react-query"

// Fetch JSON có TIMEOUT: nếu request bị treo, abort -> reject -> React Query mới retry được.
// (Trước đây fetch không timeout -> treo là pending vĩnh viễn -> skeleton xoay mãi, phải refresh.)
async function fetchJson(url: string, timeoutMs = 12000) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch(url, { cache: "no-store", signal: controller.signal })
    if (!res.ok) throw new Error(`Fetch ${url} thất bại: ${res.status}`)
    return res.json()
  } finally {
    clearTimeout(timer)
  }
}

// Tự retry vài lần (kèm backoff) để không cần refresh tay khi request đầu treo/lỗi tạm.
const RESILIENT = {
  retry: 3,
  retryDelay: (attempt: number) => Math.min(1000 * 2 ** attempt, 8000),
} as const

export function useInventoryData() {
  return useQuery({ queryKey: ["inventory"], queryFn: () => fetchJson("/api/kho-hang"), ...RESILIENT })
}

export function usePartnerData() {
  return useQuery({ queryKey: ["partner-inventory"], queryFn: () => fetchJson("/api/doi-tac/hang-order"), ...RESILIENT })
}

export function useCNCData() {
  return useQuery({ queryKey: ["cnc-inventory"], queryFn: () => fetchJson("/api/kho-hang/cnc"), ...RESILIENT })
}

export function useBaoHanhHistory() {
  return useQuery({ queryKey: ["baohanh-history"], queryFn: () => fetchJson("/api/kho-hang/baohanh-history"), ...RESILIENT })
}

export function useAccessoriesData() {
  return useQuery({ queryKey: ["accessories-inventory"], queryFn: () => fetchJson("/api/phu-kien"), ...RESILIENT })
}
