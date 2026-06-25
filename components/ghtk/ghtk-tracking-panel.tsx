// components/ghtk/ghtk-tracking-panel.tsx
"use client"

import { useState } from "react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Loader2, Search } from "lucide-react"
import { useGhtkTracking } from "./ghtk-status-badge"
import { STATUS_GROUP_COLOR } from "@/lib/ghtk-status"
import { cn } from "@/lib/utils"

const fmtMoney = (n: number) => Number(n || 0).toLocaleString("vi-VN") + "đ"

/** Ô nhập mã + nút tra cứu chi tiết trạng thái đơn GHTK (gọi qua proxy server). */
export function GhtkTrackingPanel({ defaultCode = "" }: { defaultCode?: string }) {
  const [codeInput, setCodeInput] = useState(defaultCode)
  const [submitted, setSubmitted] = useState<string | null>(null)
  const { data, isLoading, error, isFetching, refetch } = useGhtkTracking(submitted)

  const lookup = () => {
    const c = codeInput.trim()
    if (!c) return
    if (c === submitted) refetch()
    else setSubmitted(c)
  }

  return (
    <div>
      <div className="flex items-center gap-2">
        <Input
          value={codeInput}
          onChange={(e) => setCodeInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && lookup()}
          placeholder="Mã đơn GHTK (S1.A1...) hoặc mã đối tác"
          className="h-9"
        />
        <Button onClick={lookup} disabled={!codeInput.trim() || isFetching} className="h-9 shrink-0">
          {isFetching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
          <span className="ml-1.5">Tra cứu</span>
        </Button>
      </div>

      {submitted && (
        <div className="mt-3">
          {isLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Đang tra cứu GHTK…
            </div>
          ) : error ? (
            <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-600 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-400">
              {(error as Error).message}
            </div>
          ) : data ? (
            <div className="space-y-2 rounded-lg border bg-muted/30 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span
                  className={cn(
                    "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
                    STATUS_GROUP_COLOR[data.statusGroup],
                  )}
                >
                  {data.statusLabel}
                </span>
                {data.labelId && (
                  <span className="font-mono text-xs text-muted-foreground">Mã GHTK: {data.labelId}</span>
                )}
              </div>
              {data.message && <p className="text-xs text-muted-foreground">{data.message}</p>}
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                {data.customerName && (
                  <div>
                    <span className="text-muted-foreground">Người nhận:</span> {data.customerName}
                  </div>
                )}
                {data.customerTel && (
                  <div>
                    <span className="text-muted-foreground">SĐT:</span> {data.customerTel}
                  </div>
                )}
                {data.address && (
                  <div className="col-span-2">
                    <span className="text-muted-foreground">Địa chỉ:</span> {data.address}
                  </div>
                )}
                <div>
                  <span className="text-muted-foreground">COD:</span>{" "}
                  <span className="font-medium text-foreground">{fmtMoney(data.codMoney)}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Phí ship:</span> {fmtMoney(data.shipMoney)}
                </div>
                {data.weight > 0 && (
                  <div>
                    <span className="text-muted-foreground">Khối lượng:</span> {data.weight} g
                  </div>
                )}
                {data.pickDate && (
                  <div>
                    <span className="text-muted-foreground">Ngày lấy:</span> {data.pickDate}
                  </div>
                )}
                {data.deliverDate && (
                  <div className="col-span-2">
                    <span className="text-muted-foreground">Ngày giao:</span> {data.deliverDate}
                  </div>
                )}
              </div>
            </div>
          ) : null}
        </div>
      )}
    </div>
  )
}
