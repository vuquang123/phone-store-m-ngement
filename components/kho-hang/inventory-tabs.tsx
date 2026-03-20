"use client"

import { Card } from "@/components/ui/card"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useInventoryStore } from "@/lib/store/inventory-store"

interface InventoryStatsProps {
  soSanPhamCon: number
  soSanPhamCNC: number
  soSanPhamBH: number
  soSanPhamDoiTac: number
  soPhuKienDaHet: number
  soPhuKienSapHet: number
}

export function InventoryStats({
  soSanPhamCon,
  soSanPhamCNC,
  soSanPhamBH,
  soSanPhamDoiTac,
  soPhuKienDaHet,
  soPhuKienSapHet
}: InventoryStatsProps) {
  const { setActiveTab } = useInventoryStore()

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
      <Card className="p-4 bg-gradient-to-br from-emerald-50 to-blue-50 border-emerald-100 shadow-sm">
        <div className="flex items-start gap-3">
          <div className="bg-white p-2 rounded-lg shadow-sm">📲</div>
          <div className="flex-1">
            <div className="text-sm font-bold text-emerald-800 mb-2">Sản phẩm hệ thống</div>
            <div className="grid grid-cols-4 gap-2">
              <button 
                onClick={() => setActiveTab("san-pham")}
                className="flex flex-col items-center p-2 bg-white/60 rounded-lg border border-emerald-100 hover:bg-white transition-colors"
              >
                <span className="text-xs text-slate-500 mb-1">Còn hàng</span>
                <span className="text-lg font-bold text-emerald-600">{soSanPhamCon}</span>
              </button>
              <button 
                onClick={() => setActiveTab("dang-cnc")}
                className="flex flex-col items-center p-2 bg-white/60 rounded-lg border border-emerald-100 hover:bg-white transition-colors"
              >
                <span className="text-xs text-slate-500 mb-1">Đang CNC</span>
                <span className="text-lg font-bold text-orange-600">{soSanPhamCNC}</span>
              </button>
              <button 
                onClick={() => setActiveTab("bao-hanh")}
                className="flex flex-col items-center p-2 bg-white/60 rounded-lg border border-emerald-100 hover:bg-white transition-colors"
              >
                <span className="text-xs text-slate-500 mb-1">Bảo hành</span>
                <span className="text-lg font-bold text-blue-600">{soSanPhamBH}</span>
              </button>
              <button 
                onClick={() => setActiveTab("giao-doi-tac")}
                className="flex flex-col items-center p-2 bg-white/60 rounded-lg border border-emerald-100 hover:bg-white transition-colors"
              >
                <span className="text-xs text-slate-500 mb-1">Đối tác</span>
                <span className="text-lg font-bold text-purple-600">{soSanPhamDoiTac}</span>
              </button>
            </div>
          </div>
        </div>
      </Card>

      <Card className="p-4 bg-gradient-to-br from-slate-50 to-rose-50 border-rose-100 shadow-sm">
        <div className="flex items-start gap-3">
          <div className="bg-white p-2 rounded-lg shadow-sm">📦</div>
          <div className="flex-1">
            <div className="text-sm font-bold text-slate-800 mb-2">Trạng thái phụ kiện</div>
            <div className="grid grid-cols-2 gap-2">
              <button 
                onClick={() => setActiveTab("phu-kien")}
                className="flex flex-col items-center p-2 bg-white/60 rounded-lg border border-rose-100 hover:bg-white transition-colors"
              >
                <span className="text-xs text-slate-500 mb-1">Đã hết hàng</span>
                <span className="text-lg font-bold text-rose-600">{soPhuKienDaHet}</span>
              </button>
              <button 
                onClick={() => setActiveTab("phu-kien")}
                className="flex flex-col items-center p-2 bg-white/60 rounded-lg border border-rose-100 hover:bg-white transition-colors"
              >
                <span className="text-xs text-slate-500 mb-1">Sắp hết hàng</span>
                <span className="text-lg font-bold text-orange-500">{soPhuKienSapHet}</span>
              </button>
            </div>
          </div>
        </div>
      </Card>
    </div>
  )
}

export function InventoryTabs() {
  const { activeTab, setActiveTab } = useInventoryStore()

  return (
    <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
      <TabsList className="grid w-full grid-cols-5 max-w-3xl bg-slate-100/50 p-1 rounded-xl h-11">
        <TabsTrigger value="san-pham" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-emerald-700 font-medium">Sản phẩm</TabsTrigger>
        <TabsTrigger value="phu-kien" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-emerald-700 font-medium">Phụ kiện</TabsTrigger>
        <TabsTrigger value="dang-cnc" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-emerald-700 font-medium">CNC</TabsTrigger>
        <TabsTrigger value="bao-hanh" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-emerald-700 font-medium">Bảo hành</TabsTrigger>
        <TabsTrigger value="giao-doi-tac" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-emerald-700 font-medium">Đối tác</TabsTrigger>
      </TabsList>
    </Tabs>
  )
}
