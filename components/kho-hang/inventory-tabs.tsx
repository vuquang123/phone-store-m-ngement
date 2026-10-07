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
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
      <Card className="p-4 bg-card border-border shadow-sm">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="bg-muted p-2 rounded-lg leading-none">📲</div>
            <div className="text-sm font-bold text-foreground">Sản phẩm hệ thống</div>
          </div>
          <div className="grid grid-cols-4 gap-2">
              <button
                onClick={() => onNavigate("san-pham")}
                className="flex flex-col items-center p-2 bg-muted/50 rounded-lg border border-border hover:bg-muted transition-colors"
              >
                <span className="text-xs text-muted-foreground mb-1">Còn hàng</span>
                <span className="text-lg font-bold text-emerald-600 dark:text-emerald-400">{soSanPhamCon}</span>
              </button>
              <button
                onClick={() => onNavigate("dang-cnc")}
                className="flex flex-col items-center p-2 bg-muted/50 rounded-lg border border-border hover:bg-muted transition-colors"
              >
                <span className="text-xs text-muted-foreground mb-1">Đang CNC</span>
                <span className="text-lg font-bold text-orange-600 dark:text-orange-400">{soSanPhamCNC}</span>
              </button>
              <button
                onClick={() => onNavigate("bao-hanh")}
                className="flex flex-col items-center p-2 bg-muted/50 rounded-lg border border-border hover:bg-muted transition-colors"
              >
                <span className="text-xs text-muted-foreground mb-1">Bảo hành</span>
                <span className="text-lg font-bold text-blue-600 dark:text-blue-400">{soSanPhamBH}</span>
              </button>
              <button
                onClick={() => onNavigate("giao-doi-tac")}
                className="flex flex-col items-center p-2 bg-muted/50 rounded-lg border border-border hover:bg-muted transition-colors"
              >
                <span className="text-xs text-muted-foreground mb-1">Đối tác</span>
                <span className="text-lg font-bold text-purple-600 dark:text-purple-400">{soSanPhamDoiTac}</span>
              </button>
            </div>
          </div>
      </Card>

      <Card className="p-4 bg-card border-border shadow-sm">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="bg-muted p-2 rounded-lg leading-none">📦</div>
            <div className="text-sm font-bold text-foreground">Trạng thái phụ kiện</div>
          </div>
          <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => onNavigate("phu-kien")}
                className="flex flex-col items-center p-2 bg-muted/50 rounded-lg border border-border hover:bg-muted transition-colors"
              >
                <span className="text-xs text-muted-foreground mb-1">Đã hết hàng</span>
                <span className="text-lg font-bold text-rose-600 dark:text-rose-400">{soPhuKienDaHet}</span>
              </button>
              <button
                onClick={() => onNavigate("phu-kien")}
                className="flex flex-col items-center p-2 bg-muted/50 rounded-lg border border-border hover:bg-muted transition-colors"
              >
                <span className="text-xs text-muted-foreground mb-1">Sắp hết hàng</span>
                <span className="text-lg font-bold text-orange-500 dark:text-orange-400">{soPhuKienSapHet}</span>
              </button>
            </div>
          </div>
      </Card>
    </div>
  )
}
