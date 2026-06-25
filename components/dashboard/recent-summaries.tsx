// components/dashboard/recent-summaries.tsx
"use client"

import { useMemo, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import Link from "next/link"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select"
import { Truck, Wallet, ArrowUpCircle, ArrowDownCircle, Loader2 } from "lucide-react"

const fmt = (n: number) => Number(n || 0).toLocaleString("vi-VN") + "₫"

const PERIODS = [
  { value: "7", label: "7 ngày" },
  { value: "30", label: "30 ngày" },
  { value: "90", label: "90 ngày" },
]

function cutoffDate(days: number): Date {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() - (days - 1))
  return d
}

// Parse ngày VN ("dd/mm/yyyy" có/không giờ) hoặc ISO.
function parseVN(s: any): Date | null {
  const str = String(s ?? "").trim()
  if (!str) return null
  if (/^\d{4}-\d{2}-\d{2}/.test(str)) {
    const d = new Date(str)
    return isNaN(d.getTime()) ? null : d
  }
  const m = str.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/)
  if (m) {
    const d = new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]))
    return isNaN(d.getTime()) ? null : d
  }
  const d = new Date(str)
  return isNaN(d.getTime()) ? null : d
}

function PeriodSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="h-8 w-[110px]">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {PERIODS.map((p) => (
          <SelectItem key={p.value} value={p.value}>
            {p.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

/* ===== Đơn online (GHTK) ===== */
function OnlineOrdersSummary() {
  const [days, setDays] = useState("7")
  const { data, isLoading } = useQuery<any[]>({
    queryKey: ["dash-online-orders"],
    queryFn: async () => {
      const res = await fetch("/api/ban-hang?ghtk=1&limit=200", { cache: "no-store" })
      if (!res.ok) throw new Error("fail")
      const json = await res.json()
      return Array.isArray(json.data) ? json.data : []
    },
    staleTime: 60_000,
  })

  const { count, cod } = useMemo(() => {
    const cutoff = cutoffDate(Number(days))
    let count = 0
    let cod = 0
    for (const o of data ?? []) {
      const d = parseVN(o.ngay_xuat)
      if (d && d >= cutoff) {
        count++
        cod += Number(o.tong_tien || 0)
      }
    }
    return { count, cod }
  }, [data, days])

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between gap-2 pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Truck className="h-4 w-4 text-blue-500" /> Đơn online (GHTK)
        </CardTitle>
        <PeriodSelect value={days} onChange={setDays} />
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Đang tải...
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-2xl font-bold">{count}</div>
              <div className="text-xs text-muted-foreground">Đơn trong kỳ</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-emerald-600">{fmt(cod)}</div>
              <div className="text-xs text-muted-foreground">Tổng tiền COD</div>
            </div>
          </div>
        )}
        <Link href="/dashboard/don-online" className="mt-3 inline-block text-sm text-blue-600 hover:underline dark:text-blue-400">
          Xem tất cả →
        </Link>
      </CardContent>
    </Card>
  )
}

/* ===== Thu / chi tiền mặt ===== */
function CashFlowSummary() {
  const [days, setDays] = useState("7")
  const { data, isLoading } = useQuery<any>({
    queryKey: ["tien-mat"],
    queryFn: async () => {
      const res = await fetch("/api/tien-mat", { cache: "no-store" })
      if (!res.ok) throw new Error("fail")
      return res.json()
    },
    staleTime: 60_000,
  })

  const { thu, chi } = useMemo(() => {
    const cutoff = cutoffDate(Number(days))
    const entries: any[] = Array.isArray(data?.entries) ? data.entries : []
    let thu = 0
    let chi = 0
    for (const e of entries) {
      const d = parseVN(e.created_at)
      if (d && d >= cutoff) {
        if (e.loai === "thu") thu += Number(e.so_tien || 0)
        else chi += Number(e.so_tien || 0)
      }
    }
    return { thu, chi }
  }, [data, days])

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between gap-2 pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Wallet className="h-4 w-4 text-green-500" /> Thu / chi tiền mặt
        </CardTitle>
        <PeriodSelect value={days} onChange={setDays} />
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Đang tải...
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="flex items-center gap-1 text-2xl font-bold text-blue-600">
                <ArrowUpCircle className="h-5 w-5" /> {fmt(thu)}
              </div>
              <div className="text-xs text-muted-foreground">Tổng thu</div>
            </div>
            <div>
              <div className="flex items-center gap-1 text-2xl font-bold text-red-600">
                <ArrowDownCircle className="h-5 w-5" /> {fmt(chi)}
              </div>
              <div className="text-xs text-muted-foreground">Tổng chi</div>
            </div>
          </div>
        )}
        <Link href="/dashboard/tien-mat" className="mt-3 inline-block text-sm text-blue-600 hover:underline dark:text-blue-400">
          Xem tất cả →
        </Link>
      </CardContent>
    </Card>
  )
}

export function RecentSummaries() {
  return (
    <div className="grid gap-6 md:grid-cols-2">
      <OnlineOrdersSummary />
      <CashFlowSummary />
    </div>
  )
}
