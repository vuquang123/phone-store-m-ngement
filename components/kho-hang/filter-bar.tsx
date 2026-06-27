"use client"

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Slider } from "@/components/ui/slider"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Search, RotateCcw } from "lucide-react"
import { useInventoryStore } from "@/lib/store/inventory-store"

interface FilterBarProps {
  productNames: string[]
  colors: string[]
  capacities: string[]
  maxPrice: number
}

const TRIGGER_CLS = "h-9 bg-card text-xs [&>span]:truncate"

export function FilterBar({ productNames, colors, capacities, maxPrice }: FilterBarProps) {
  const {
    searchTerm, setSearchTerm,
    trangThai, setTrangThai,
    sourceFilter, setSourceFilter,
    productNameFilter, setProductNameFilter,
    colorFilter, setColorFilter,
    capacityFilter, setCapacityFilter,
    pinFilter, setPinFilter,
    priceRange, setPriceRange,
    resetFilters,
  } = useInventoryStore()

  const fmt = (n: number) => (n >= 1_000_000 ? `${(n / 1_000_000).toLocaleString("vi-VN")}tr` : n.toLocaleString("vi-VN"))

  return (
    <div className="space-y-3 rounded-xl border border-border/60 bg-muted/40 p-3 shadow-sm">
      {/* Hàng tìm kiếm + reset */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1 min-w-0">
          <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Tìm theo tên, IMEI, serial, ghi chú..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="h-9 pl-9 bg-card"
          />
        </div>
        <Button variant="outline" size="sm" onClick={resetFilters} className="h-9 shrink-0 px-2 sm:px-3" title="Đặt lại bộ lọc">
          <RotateCcw className="h-4 w-4 sm:mr-2" />
          <span className="hidden sm:inline">Đặt lại</span>
        </Button>
      </div>

      {/* Lưới bộ lọc: 2 cột (mobile) -> 3 (sm) -> 6 (lg) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
        <Select value={productNameFilter} onValueChange={setProductNameFilter}>
          <SelectTrigger className={TRIGGER_CLS}><SelectValue placeholder="Sản phẩm" /></SelectTrigger>
          <SelectContent className="bg-card">
            <SelectItem value="all">Sản phẩm: Tất cả</SelectItem>
            {productNames.map((name) => (<SelectItem key={name} value={name}>{name}</SelectItem>))}
          </SelectContent>
        </Select>

        <Select value={sourceFilter} onValueChange={setSourceFilter as any}>
          <SelectTrigger className={TRIGGER_CLS}><SelectValue placeholder="Nguồn" /></SelectTrigger>
          <SelectContent className="bg-card">
            <SelectItem value="all">Nguồn: Tất cả</SelectItem>
            <SelectItem value="kho">Kho trong</SelectItem>
            <SelectItem value="doi_tac">Kho ngoài</SelectItem>
          </SelectContent>
        </Select>

        <Select value={trangThai} onValueChange={setTrangThai}>
          <SelectTrigger className={TRIGGER_CLS}><SelectValue placeholder="Loại máy" /></SelectTrigger>
          <SelectContent className="bg-card">
            <SelectItem value="all">Loại: Tất cả</SelectItem>
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
