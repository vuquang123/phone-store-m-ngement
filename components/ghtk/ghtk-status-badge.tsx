// components/ghtk/ghtk-status-badge.tsx
"use client"

import { useQuery } from "@tanstack/react-query"
import { STATUS_GROUP_COLOR, type GhtkStatusGroup } from "@/lib/ghtk-status"
import { cn } from "@/lib/utils"

// Shape gọn mà API proxy trả về cho UI.
export interface GhtkUiOrder {
  labelId: string
  partnerId: string
  statusCode: string
  statusLabel: string
  statusGroup: GhtkStatusGroup
  created: string
  modified: string
  message: string
  pickDate: string
  deliverDate: string
  customerName: string
  customerTel: string
  address: string
  codMoney: number
  shipMoney: number
  weight: number
}

/** Tra cứu trạng thái đơn GHTK qua proxy server (không gọi GHTK trực tiếp). */
export function useGhtkTracking(code: string | null) {
  return useQuery<GhtkUiOrder>({
    queryKey: ["ghtk-tracking", code],
    enabled: !!code,
    staleTime: 60_000,
    queryFn: async () => {
      const res = await fetch(`/api/ghtk/tracking/${encodeURIComponent(code as string)}`, { cache: "no-store" })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data?.success) {
        throw new Error(data?.message || `Tra cứu GHTK thất bại (HTTP ${res.status})`)
      }
      return data.order as GhtkUiOrder
    },
  })
}

/** Badge hiển thị trạng thái đơn GHTK theo mã (mã GHTK hoặc mã đối tác). */
export function GhtkStatusBadge({ code }: { code: string }) {
  const { data, isLoading, error } = useGhtkTracking(code)

  if (isLoading) {
    return <span className="text-xs text-muted-foreground">Đang tra…</span>
  }
  if (error) {
    return <span className="text-xs text-red-600 dark:text-red-400">{(error as Error).message}</span>
  }
  if (!data) return null

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap",
        STATUS_GROUP_COLOR[data.statusGroup],
      )}
      title={`Mã GHTK: ${data.labelId || "—"}`}
    >
      {data.statusLabel}
    </span>
  )
}
