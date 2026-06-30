"use client"

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Slider } from "@/components/ui/slider"
import { Button } from "@/components/ui/button"
import { RotateCcw } from "lucide-react"

interface AdvancedFilterBarProps {
  productNames: string[]
  colors: string[]
  capacities: string[]
  maxPrice: number
  productNameFilter: string
  setProductNameFilter: (v: string) => void
  loaiMayFilter: string
  setLoaiMayFilter: (v: string) => void
  colorFilter: string
  setColorFilter: (v: string) => void
  capacityFilter: string
  setCapacityFilter: (v: string) => void
  pinFilter: "all" | "100" | "9x" | "8x" | "7x" | "lt70"
  setPinFilter: (v: "all" | "100" | "9x" | "8x" | "7x" | "lt70") => void
  priceRange: [number, number]
  setPriceRange: (v: [number, number]) => void
  resetFilters: () => void
}

const TRIGGER_CLS = "h-9 bg-card text-xs [&>span]:truncate"

export function AdvancedFilterBar({
  productNames,
  colors,
  capacities,
  maxPrice,
  productNameFilter,
  setProductNameFilter,
  loaiMayFilter,
  setLoaiMayFilter,
  colorFilter,
  setColorFilter,
  capacityFilter,
  setCapacityFilter,
  pinFilter,
  setPinFilter,
  priceRange,
  setPriceRange,
  resetFilters,
}: AdvancedFilterBarProps) {
  const fmt = (n: number) => (n >= 1_000_000 ? `${(n / 1_000_000).toLocaleString("vi-VN")}tr` : n.toLocaleString("vi-VN"))

  return (
    <div className="space-y-3 rounded-xl border border-border/60 bg-muted/40 p-3 shadow-sm">
      {/* Lưới bộ lọc: 2 cột (mobile) -> 3 (sm) -> 5 (lg) + nút Đặt lại */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
        <Select value={productNameFilter} onValueChange={setProductNameFilter}>
          <SelectTrigger className={TRIGGER_CLS}><SelectValue placeholder="Sản phẩm" /></SelectTrigger>
          <SelectContent className="bg-card">
            <SelectItem value="all">Sản phẩm: Tất cả</SelectItem>
            {productNames.map((name) => (<SelectItem key={name} value={name}>{name}</SelectItem>))}
          </SelectContent>
        </Select>

        <Select value={loaiMayFilter} onValueChange={setLoaiMayFilter}>
          <SelectTrigger className={TRIGGER_CLS}><SelectValue placeholder="Loại máy" /></SelectTrigger>
          <SelectContent className="bg-card">
            <SelectItem value="all">Loại máy: Tất cả</SelectItem>
            <SelectItem value="Lock">Lock</SelectItem>
            <SelectItem value="Qte">Quốc tế</SelectItem>
          </SelectContent>
        </Select>

        <Select value={colorFilter} onValueChange={setColorFilter}>
          <SelectTrigger className={TRIGGER_CLS}><SelectValue placeholder="Màu" /></SelectTrigger>
          <SelectContent className="bg-card">
            <SelectItem value="all">Màu: Tất cả</SelectItem>
            {colors.map((color) => (<SelectItem key={color} value={color}>{color}</SelectItem>))}
          </SelectContent>
        </Select>

        <Select value={capacityFilter} onValueChange={setCapacityFilter}>
          <SelectTrigger className={TRIGGER_CLS}><SelectValue placeholder="Dung lượng" /></SelectTrigger>
          <SelectContent className="bg-card">
            <SelectItem value="all">Dung lượng: Tất cả</SelectItem>
            {capacities.map((cap) => (<SelectItem key={cap} value={cap}>{cap}</SelectItem>))}
          </SelectContent>
        </Select>

        <Select value={pinFilter} onValueChange={setPinFilter as any}>
          <SelectTrigger className={TRIGGER_CLS}><SelectValue placeholder="Pin" /></SelectTrigger>
          <SelectContent className="bg-card">
            <SelectItem value="all">Pin: Tất cả</SelectItem>
            <SelectItem value="100">Pin 100%</SelectItem>
            <SelectItem value="9x">Pin 9x (90-99)</SelectItem>
            <SelectItem value="8x">Pin 8x (80-89)</SelectItem>
            <SelectItem value="7x">Pin 7x (70-79)</SelectItem>
            <SelectItem value="lt70">Dưới 70%</SelectItem>
          </SelectContent>
        </Select>

        <Button variant="outline" size="sm" onClick={resetFilters} className="h-9 px-2 sm:px-3" title="Đặt lại bộ lọc">
          <RotateCcw className="h-4 w-4 sm:mr-2" />
          <span className="hidden sm:inline">Đặt lại</span>
        </Button>
      </div>

      {/* Khoảng giá */}
      <div className="flex items-center gap-3 pt-1">
        <span className="shrink-0 text-xs font-medium text-muted-foreground">Khoảng giá</span>
        <Slider
          value={priceRange}
          min={0}
          max={maxPrice}
          step={500000}
          onValueChange={(val) => setPriceRange(val as [number, number])}
          className="flex-1"
        />
        <span className="shrink-0 text-xs font-medium tabular-nums text-muted-foreground">
          {fmt(priceRange[0])} – {fmt(priceRange[1])}đ
        </span>
      </div>
    </div>
  )
}
