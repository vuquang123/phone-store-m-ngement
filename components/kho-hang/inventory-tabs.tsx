"use client"

import { Card } from "@/components/ui/card"

/** Đích điều hướng khi bấm vào một thẻ số liệu. */
export type StatTarget = "san-pham" | "dang-cnc" | "bao-hanh" | "giao-doi-tac" | "phu-kien"

interface InventoryStatsProps {
  soSanPhamCon: number
  soSanPhamCNC: number
  soSanPhamBH: number
  soSanPhamDoiTac: number
  soPhuKienDaHet: number
  soPhuKienSapHet: number
  onNavigate: (target: StatTarget) => void
}

export function InventoryStats({
  soSanPhamCon,
  soSanPhamCNC,
  soSanPhamBH,
  soSanPhamDoiTac,
  soPhuKienDaHet,
  soPhuKienSapHet,
  onNavigate,
}: InventoryStatsProps) {
  const items: { label: string; value: number; tone: string; target: string; group: string }[] = [
    { group: "Máy", label: "Còn hàng", value: soSanPhamCon, tone: "text-emerald-600 dark:text-emerald-400", target: "san-pham" },
    { group: "Máy", label: "Đang CNC", value: soSanPhamCNC, tone: "text-orange-600 dark:text-orange-400", target: "dang-cnc" },
    { group: "Máy", label: "Bảo hành", value: soSanPhamBH, tone: "text-blue-600 dark:text-blue-400", target: "bao-hanh" },
    { group: "Máy", label: "Đối tác", value: soSanPhamDoiTac, tone: "text-purple-600 dark:text-purple-400", target: "giao-doi-tac" },
    { group: "Phụ kiện", label: "PK hết hàng", value: soPhuKienDaHet, tone: "text-rose-600 dark:text-rose-400", target: "phu-kien" },
    { group: "Phụ kiện", label: "PK sắp hết", value: soPhuKienSapHet, tone: "text-orange-500 dark:text-orange-400", target: "phu-kien" },
  ]
  return (
    <div className="grid grid-cols-3 gap-2 lg:grid-cols-6">
      {items.map((it) => (
        <button
          key={it.label}
          onClick={() => onNavigate(it.target as any)}
          className="flex items-center justify-between gap-2 rounded-lg border border-border bg-card px-3 py-2 text-left shadow-sm transition-colors hover:bg-muted"
        >
          <span className="text-xs text-muted-foreground">{it.label}</span>
          <span className={`text-lg font-bold tabular-nums leading-none ${it.tone}`}>{it.value}</span>
        </button>
      ))}
    </div>
  )
}
