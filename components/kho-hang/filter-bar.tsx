"use client"

import { useMemo } from "react"
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

export function FilterBar({ productNames, colors, capacities, maxPrice }: FilterBarProps) {
  const {
    searchTerm, setSearchTerm,
    trangThai, setTrangThai,
    sourceFilter, setSourceFilter,
    productNameFilter, setProductNameFilter,
    colorFilter, setColorFilter,
    capacityFilter, setCapacityFilter,
    pinFilter, setPinFilter,
    khoFilter, setKhoFilter,
    priceRange, setPriceRange,
    resetFilters
  } = useInventoryStore()

  return (
    <div className="space-y-4 bg-slate-50/50 p-4 rounded-xl border border-slate-200/60 shadow-sm animate-in fade-in slide-in-from-top-2 duration-300">
      <div className="flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Tìm theo tên, IMEI, serial, ghi chú..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 bg-white border-slate-200 focus:ring-emerald-500/20 focus:border-emerald-500"
          />
        </div>
        <Button 
          variant="outline" 
          onClick={resetFilters}
          className="md:w-auto w-full group hover:border-emerald-500 hover:text-emerald-600 transition-colors"
        >
          <RotateCcw className="mr-2 h-4 w-4 group-hover:rotate-180 transition-transform duration-500" />
          Đặt lại bộ lọc
        </Button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
        <Select value={productNameFilter} onValueChange={setProductNameFilter}>
          <SelectTrigger className="h-10 bg-white text-xs"><SelectValue placeholder="Sản phẩm" /></SelectTrigger>
          <SelectContent className="bg-white">
            <SelectItem value="all">Sản phẩm: Tất cả</SelectItem>
            {productNames.map((name: string) => (
              <SelectItem key={name} value={name}>{name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={sourceFilter} onValueChange={setSourceFilter as any}>
          <SelectTrigger className="h-10 bg-white text-xs"><SelectValue placeholder="Nguồn" /></SelectTrigger>
          <SelectContent className="bg-white">
            <SelectItem value="all">Nguồn: Tất cả</SelectItem>
            <SelectItem value="kho">Kho trong</SelectItem>
            <SelectItem value="doi_tac">Kho ngoài</SelectItem>
          </SelectContent>
        </Select>

        <Select value={trangThai} onValueChange={setTrangThai}>
          <SelectTrigger className="h-10 bg-white text-xs"><SelectValue placeholder="Loại máy" /></SelectTrigger>
          <SelectContent className="bg-white">
            <SelectItem value="all">Loại: Tất cả</SelectItem>
            <SelectItem value="Lock">Lock</SelectItem>
            <SelectItem value="Qte">Quốc tế</SelectItem>
          </SelectContent>
        </Select>

        <Select value={colorFilter} onValueChange={setColorFilter}>
          <SelectTrigger className="h-10 bg-white text-xs"><SelectValue placeholder="Màu" /></SelectTrigger>
          <SelectContent className="bg-white">
            <SelectItem value="all">Màu: Tất cả</SelectItem>
            {colors.map((color: string) => (
              <SelectItem key={color} value={color}>{color}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={capacityFilter} onValueChange={setCapacityFilter}>
          <SelectTrigger className="h-10 bg-white text-xs"><SelectValue placeholder="Dung lượng" /></SelectTrigger>
          <SelectContent className="bg-white">
            <SelectItem value="all">Dung lượng: Tất cả</SelectItem>
            {capacities.map((cap: string) => (
              <SelectItem key={cap} value={cap}>{cap}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={pinFilter} onValueChange={setPinFilter as any}>
          <SelectTrigger className="h-10 bg-white text-xs">
            <SelectValue placeholder="Pin" />
          </SelectTrigger>
          <SelectContent className="bg-white">
            <SelectItem value="all">Pin: Tất cả</SelectItem>
            <SelectItem value="100">Pin 100%</SelectItem>
            <SelectItem value="9x">Pin 9x (90-99)</SelectItem>
            <SelectItem value="8x">Pin 8x (80-89)</SelectItem>
            <SelectItem value="7x">Pin 7x (70-79)</SelectItem>
            <SelectItem value="lt70">Dưới 70%</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="pt-2 px-1">
        <div className="flex items-center justify-between text-xs text-slate-500 mb-2">
          <span className="font-medium">Khoảng giá</span>
          <span>{priceRange[0].toLocaleString()} - {priceRange[1].toLocaleString()} VNĐ</span>
        </div>
        <Slider
          value={priceRange}
          min={0}
          max={maxPrice}
          step={500000}
          onValueChange={(val) => setPriceRange(val as [number, number])}
          className="py-2"
        />
      </div>
    </div>
  )
}
