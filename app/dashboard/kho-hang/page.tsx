"use client"

import { useState, useMemo, useEffect } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { TabsContent } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Plus, ListChecks } from "lucide-react"

// Components
import { FilterBar } from "@/components/kho-hang/filter-bar"
import { ProductTable } from "@/components/kho-hang/product-table"
import { AccessoryTable } from "@/components/kho-hang/accessory-table"
import { CNCTable } from "@/components/kho-hang/cnc-table"
import { BaoHanhTable } from "@/components/kho-hang/bao-hanh-table"
import { InventoryTabs, InventoryStats } from "@/components/kho-hang/inventory-tabs"
import { TableSkeleton } from "@/components/kho-hang/table-skeleton"
import { ProductDialog } from "@/components/kho-hang/product-dialog"
import { SendCNCDialog } from "@/components/kho-hang/send-cnc-dialog"
import { PartnerTable } from "@/components/kho-hang/partner-table"
import AddCNCMachineDialog from "@/components/kho-hang/add-cnc-machine-dialog"
import AddBaoHanhMachineDialog from "@/components/kho-hang/add-baohanh-machine-dialog"
import { SendPartnerDialog } from "@/components/kho-hang/send-partner-dialog"
import { useRouter } from "next/navigation"

// Hooks & Store
import { useInventoryStore } from "@/lib/store/inventory-store"
import {
  useInventoryData,
  usePartnerData,
  useCNCData,
  useBaoHanhHistory,
  useAccessoriesData
} from "@/hooks/use-inventory-data"
import { useInventoryActions } from "@/hooks/use-inventory-actions"
import { useIsMobile } from "@/hooks/use-mobile"
import { useAuthMe } from "@/hooks/use-auth-me"
import { toast } from "sonner"

// Utils
import { isConHangProduct } from "@/lib/utils/inventory-helpers"
import { uploadTelegramProof } from "@/lib/utils/telegram"


export default function KhoHangPage() {
  const router = useRouter()
  const { me } = useAuthMe()
  const isMobile = useIsMobile()
  const {
    activeTab,
    searchTerm,
    khoFilter,
    priceRange,
    trangThai,
    sourceFilter,
    productNameFilter,
    colorFilter,
    capacityFilter,
    pinFilter,
    setSearchTerm,
    resetFilters
  } = useInventoryStore()

  // Queries
  const { data: invRes, isLoading: isLoadingInv } = useInventoryData()
  const { data: partnerRes, isLoading: isLoadingPartner } = usePartnerData()
  const { data: cncRes, isLoading: isLoadingCNC } = useCNCData()
  const { data: bhRes, isLoading: isLoadingBH } = useBaoHanhHistory()
  const { data: accRes, isLoading: isLoadingAcc } = useAccessoriesData()

  const rawInventory = invRes?.data || []
  const partnerInventory = partnerRes?.items || partnerRes?.data || []
  const cncProducts = cncRes?.data || []
  const baoHanhHistory = bhRes?.data || []
  const accessories = accRes?.data || []

  // Actions
  const {
    sendCNC,
    completeCNC,
    isCompletingCNC,
    sendPartner,
    isSendingPartner,
    returnPartner,
    isReturningPartner
  } = useInventoryActions()

  // Local UI State
  const [isEditMode, setIsEditMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [selectedProduct, setSelectedProduct] = useState<any>(null)

  const [isAddCNCMachineOpen, setIsAddCNCMachineOpen] = useState(false)
  const [isSendCNCDialogOpen, setIsSendCNCDialogOpen] = useState(false)
  const [isAddBaoHanhMachineOpen, setIsAddBaoHanhMachineOpen] = useState(false)
  const [isSendPartnerDialogOpen, setIsSendPartnerDialogOpen] = useState(false)

  const [page, setPage] = useState(1)
  const [accessoryPage, setAccessoryPage] = useState(1)
  const [accessoryStatusFilter, setAccessoryStatusFilter] = useState("all")

  const [cncProcessingSearch, setCncProcessingSearch] = useState("")
  const [cncCompletedSearch, setCncCompletedSearch] = useState("")
  const [cncProcessingPage, setCncProcessingPage] = useState(1)
  const [cncCompletedPage, setCncCompletedPage] = useState(1)

  const pageSize = 10

  // Auth/Role
  const [userRole, setUserRole] = useState<"quan_ly" | "nhan_vien">("nhan_vien")
  const isManager = userRole === "quan_ly"

  useEffect(() => {
    const checkRole = async () => {
      try {
        const raw = localStorage.getItem("auth_user")
        const auth = raw ? JSON.parse(raw) : null
        const res = await fetch("/api/auth/me", {
          headers: auth?.email ? { "x-user-email": auth.email } : {}
        })
        if (res.ok) {
          const me = await res.ok ? await res.json() : null
          if (me?.role === "quan_ly") setUserRole("quan_ly")
        }
      } catch (e) { }
    }
    checkRole()
  }, [])

  // Combined Inventory (Shop + Partner)
  const allProducts = useMemo(() => {
    const partnerMapped = partnerInventory.map((it: any) => ({
      ...it,
      id: `DT-${it.row_index}-${it.imei}`,
      trang_thai: "Còn hàng",
      trang_thai_kho: "Có sẵn",
      nguon: "Kho ngoài"
    }))
    return [...rawInventory, ...partnerMapped]
  }, [rawInventory, partnerInventory])

  // Filtering Logic
  const baseFilteredProducts = useMemo(() => {
    let result = allProducts.filter(isConHangProduct)

    // Basic Search
    if (searchTerm) {
      const q = searchTerm.toLowerCase()
      result = result.filter((p: any) =>
        p.ten_san_pham?.toLowerCase().includes(q) ||
        p.imei?.toLowerCase().includes(q) ||
        p.mau_sac?.toLowerCase().includes(q)
      )
    }

    // Kho Filter
    if (khoFilter !== "all") {
      result = result.filter((p: any) => {
        const isReady = (p.trang_thai_kho || "").toLowerCase().includes("có sẵn")
        return khoFilter === "co_san" ? isReady : !isReady
      })
    }

    // Price Filter
    const [minP, maxP] = priceRange
    if (minP > 0) result = result.filter((p: any) => (p.gia_ban || 0) >= minP)
    if (maxP > 0 && maxP < 50000000) result = result.filter((p: any) => (p.gia_ban || 0) <= maxP)

    // Advanced Filters
    if (trangThai !== "all") {
      result = result.filter((p: any) => {
        const type = (p.loai_may || "").toLowerCase()
        if (trangThai === "Lock") return type.includes("lock")
        return type.includes("qte") || type.includes("qt") || type.includes("quoc te") || type.includes("quốc tế")
      })
    }
    if (sourceFilter !== "all") {
      result = result.filter((p: any) => {
        const isPartner = String(p.nguon || '').toLowerCase().includes("kho ngoài") || String(p.nguon || '').toLowerCase().includes("kho ngoài");
        return sourceFilter === "kho" ? !isPartner : isPartner;
      })
    }
    return result
  }, [allProducts, searchTerm, khoFilter, priceRange, trangThai, sourceFilter])

  // Lọc sản phẩm cho dropdowns (giữ lại option của field bị loại trừ)
  const getFilteredOptions = (excludeFilter: 'product' | 'color' | 'capacity') => {
    let result = baseFilteredProducts;
    if (excludeFilter !== 'product' && productNameFilter !== "all") {
      result = result.filter((p: any) => p.ten_san_pham === productNameFilter)
    }
    if (excludeFilter !== 'color' && colorFilter !== "all") {
      result = result.filter((p: any) => p.mau_sac === colorFilter)
    }
    if (excludeFilter !== 'capacity' && capacityFilter !== "all") {
      result = result.filter((p: any) => p.dung_luong === capacityFilter)
    }
    return result;
  }

  const filteredProducts = useMemo(() => {
    let result = baseFilteredProducts
    if (productNameFilter !== "all") result = result.filter((p: any) => p.ten_san_pham === productNameFilter)
    if (colorFilter !== "all") result = result.filter((p: any) => p.mau_sac === colorFilter)
    if (capacityFilter !== "all") result = result.filter((p: any) => p.dung_luong === capacityFilter)

    return result
  }, [baseFilteredProducts, productNameFilter, colorFilter, capacityFilter])

  const filteredAccessories = useMemo(() => {
    let result = accessories

    // Status filter
    if (accessoryStatusFilter !== "all") {
      result = result.filter((a: any) => {
        const qty = parseInt(String(a.so_luong_ton || 0))
        if (accessoryStatusFilter === "in_stock") return qty > 5
        if (accessoryStatusFilter === "low_stock") return qty > 0 && qty <= 5
        if (accessoryStatusFilter === "out_of_stock") return qty <= 0
        return true
      })
    }

    if (!searchTerm) return result
    const q = searchTerm.toLowerCase()
    return result.filter((a: any) =>
      a.ten_phu_kien?.toLowerCase().includes(q) ||
      a.loai_phu_kien?.toLowerCase().includes(q) ||
      a.ghi_chu?.toLowerCase().includes(q)
    )
  }, [accessories, searchTerm, accessoryStatusFilter])

  const processingCNC = useMemo(() => {
    let result = cncProducts.filter((p: any) =>
      p.trang_thai !== "Hoàn thành CNC" && (p.trang_thai_cnc || "").toLowerCase() !== "đã nhận"
    )
    if (cncProcessingSearch) {
      const q = cncProcessingSearch.toLowerCase()
      result = result.filter((p: any) =>
        p.ten_san_pham?.toLowerCase().includes(q) ||
        p.imei?.toLowerCase().includes(q)
      )
    }
    return result
  }, [cncProducts, cncProcessingSearch])

  const completedCNC = useMemo(() => {
    let result = cncProducts.filter((p: any) =>
      p.trang_thai === "Hoàn thành CNC" || (p.trang_thai_cnc || "").toLowerCase() === "đã nhận"
    )
    if (cncCompletedSearch) {
      const q = cncCompletedSearch.toLowerCase()
      result = result.filter((p: any) =>
        p.ten_san_pham?.toLowerCase().includes(q) ||
        p.imei?.toLowerCase().includes(q)
      )
    }
    return result
  }, [cncProducts, cncCompletedSearch])

  const partnerProducts = useMemo(() => {
    let result = rawInventory.filter((p: any) => p.trang_thai === "Giao đối tác")
    if (searchTerm) {
      const q = searchTerm.toLowerCase()
      result = result.filter((p: any) =>
        p.ten_san_pham?.toLowerCase().includes(q) ||
        p.imei?.toLowerCase().includes(q)
      )
    }
    return result
  }, [rawInventory, searchTerm])

  const productNameOptions = useMemo(() => {
    const validProducts = getFilteredOptions('product');
    const names = Array.from(new Set(validProducts.map((p: any) => p.ten_san_pham).filter(Boolean))) as string[]
    return names.sort((a, b) => a.localeCompare(b, "vi", { sensitivity: "base" }))
  }, [baseFilteredProducts, colorFilter, capacityFilter])

  const colorOptions = useMemo(() => {
    const validProducts = getFilteredOptions('color');
    const colors = Array.from(new Set(validProducts.map((p: any) => p.mau_sac).filter(Boolean))) as string[]
    return colors.sort((a, b) => a.localeCompare(b, "vi", { sensitivity: "base" }))
  }, [baseFilteredProducts, productNameFilter, capacityFilter])

  const capacityOptions = useMemo(() => {
    const validProducts = getFilteredOptions('capacity');
    const caps = Array.from(new Set(validProducts.map((p: any) => p.dung_luong).filter(Boolean))) as string[]
    return caps.sort((a, b) => a.localeCompare(b, "vi", { sensitivity: "base" }))
  }, [baseFilteredProducts, productNameFilter, colorFilter])


  // Stats
  const stats = useMemo(() => ({
    soSanPhamCon: allProducts.filter(isConHangProduct).length,
    soSanPhamCNC: cncProducts.filter((p: any) => p.trang_thai === "Đang CNC").length,
    soSanPhamBH: baoHanhHistory.length,
    soSanPhamDoiTac: partnerProducts.length,
    soPhuKienDaHet: accessories.filter((a: any) => parseInt(a.so_luong_ton) <= 0).length,
    soPhuKienSapHet: accessories.filter((a: any) => {
      const q = parseInt(a.so_luong_ton)
      return q > 0 && q <= 5
    }).length,
  }), [allProducts, cncProducts, baoHanhHistory, accessories, partnerProducts])

  // Handlers
  const handleSelect = (id: string) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  const handleSelectAll = () => {
    if (selectedIds.length === filteredProducts.length) setSelectedIds([])
    else setSelectedIds(filteredProducts.map((p: any) => p.id))
  }

  const handleEdit = (product: any) => {
    setSelectedProduct(product)
    setIsDialogOpen(true)
  }

  const handleCompleteSalePartner = (p: any) => {
    // Thêm sản phẩm vào giỏ hàng localStorage
    try {
      const cartRaw = localStorage.getItem('cart_draft_v1')
      let cart = cartRaw ? JSON.parse(cartRaw) : []
      if (!Array.isArray(cart)) cart = []

      const newCartItem = {
        id: p.id || p.ID || p["ID Máy"],
        ten_san_pham: p.ten_san_pham || p.tenSP || p["Tên Sản Phẩm"],
        imei: p.imei || "",
        mau_sac: p.mau_sac || "",
        dung_luong: p.dung_luong || "",
        loai_may: p.loai_may || "",
        gia_ban: p.gia_ban || 0,
        gia_nhap: p.gia_nhap || 0,
        sl: 1
      }

      // Kiểm tra nếu đã có trong giỏ
      const exists = cart.find((item: any) => item.id === newCartItem.id)
      if (!exists) {
        cart.push(newCartItem)
        localStorage.setItem('cart_draft_v1', JSON.stringify(cart))
      }

      toast.success("Đã thêm vào giỏ hàng. Chuyển sang trang bán hàng...")
      router.push('/dashboard/ban-hang')
    } catch (e) {
      toast.error("Lỗi khi thêm vào giỏ hàng")
    }
  }

  return (
    <div className="space-y-6 px-4 pb-8 max-w-[1600px] mx-auto">
      <InventoryStats {...stats} />

      <InventoryTabs />

      <div className="mt-4">
        {activeTab === "san-pham" && (
          <div className="space-y-4">
            <div className="flex justify-between items-center gap-2">
              <div className="flex gap-2">
                <Button
                  onClick={() => { setSelectedProduct(null); setIsDialogOpen(true) }}
                  className="bg-emerald-600 hover:bg-emerald-700 shadow-sm"
                >
                  <Plus className="w-4 h-4 mr-2" /> Nhập hàng
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  className={isEditMode ? "bg-blue-50 text-blue-600 border-blue-200" : ""}
                  onClick={() => setIsEditMode(!isEditMode)}
                >
                  <ListChecks className="w-4 h-4" />
                </Button>
              </div>
              {isEditMode && selectedIds.length > 0 && (
                <div className="flex items-center gap-2 animate-in fade-in slide-in-from-left-2 transition-all">
                  <Badge variant="secondary" className="px-3 py-1 bg-blue-50 text-blue-700 border-blue-100">
                    Đã chọn {selectedIds.length}
                  </Badge>
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-orange-600 bg-orange-50 hover:bg-orange-100 border-orange-200"
                    onClick={() => setIsSendCNCDialogOpen(true)}
                  >
                    Gửi CNC
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-purple-600 bg-purple-50 hover:bg-purple-100 border-purple-200"
                    onClick={() => setIsSendPartnerDialogOpen(true)}
                  >
                    Giao đối tác
                  </Button>
                </div>
              )}
            </div>

            <FilterBar
              productNames={productNameOptions}
              colors={colorOptions}
              capacities={capacityOptions}
              maxPrice={50000000}
            />

            {isLoadingInv || isLoadingPartner ? (
              <TableSkeleton rows={5} />
            ) : (
              <Card className="border-none shadow-sm overflow-hidden">
                <ProductTable
                  products={filteredProducts.slice((page - 1) * pageSize, page * pageSize)}
                  selectedIds={selectedIds}
                  onSelect={handleSelect}
                  onSelectAll={handleSelectAll}
                  isEditMode={isEditMode}
                  isManager={isManager}
                  onEdit={handleEdit}
                  onSendCNC={(p) => {
                    setSelectedIds([p.id])
                    setIsSendCNCDialogOpen(true)
                  }}
                  onSendPartner={(p) => {
                    setSelectedIds([p.id])
                    setIsSendPartnerDialogOpen(true)
                  }}
                  totalCount={filteredProducts.length}
                />

                {filteredProducts.length > pageSize && (
                  <div className="flex items-center justify-center p-4 bg-slate-50/50 gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page === 1}
                      onClick={() => setPage(page - 1)}
                    >
                      Trạm trước
                    </Button>
                    <span className="text-sm font-medium">Trang {page} / {Math.ceil(filteredProducts.length / pageSize)}</span>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page * pageSize >= filteredProducts.length}
                      onClick={() => setPage(page + 1)}
                    >
                      Trạm sau
                    </Button>
                  </div>
                )}
              </Card>
            )}
          </div>
        )}

        {activeTab === "dang-cnc" && (
          <div className="space-y-8">
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b pb-2">
                <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></span>
                  Đang CNC
                  <Badge variant="secondary" className="ml-2 bg-blue-50 text-blue-600 border-blue-100">{processingCNC.length}</Badge>
                </h3>
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <Input
                    placeholder="Tìm máy đang CNC..."
                    className="h-9 bg-white w-full sm:w-[240px]"
                    value={cncProcessingSearch}
                    onChange={(e) => { setCncProcessingSearch(e.target.value); setCncProcessingPage(1); }}
                  />
                  <div className="flex gap-2">
                    <Button onClick={() => setIsAddCNCMachineOpen(true)} className="bg-blue-600 h-9 shrink-0">
                      + Thêm mới
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      className={`h-9 w-9 shrink-0 ${isEditMode ? "bg-blue-50 text-blue-600 border-blue-200" : ""}`}
                      onClick={() => setIsEditMode(!isEditMode)}
                    >
                      <ListChecks className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </div>

              {isEditMode && selectedIds.length > 0 && (
                <div className="flex items-center gap-2 animate-in fade-in slide-in-from-left-2 transition-all">
                  <Badge variant="secondary" className="px-3 py-1 bg-blue-50 text-blue-700 border-blue-100">
                    Đã chọn {selectedIds.length} máy
                  </Badge>
                  <Button
                    size="sm"
                    className="h-8 bg-green-600 hover:bg-green-700 shadow-sm"
                    onClick={() => {
                      completeCNC({ productIds: selectedIds, employeeId: me?.employeeId || "NV-UNKNOWN" });
                      setSelectedIds([]);
                      setIsEditMode(false);
                    }}
                    disabled={isCompletingCNC}
                  >
                    Hoàn thành CNC ({selectedIds.length})
                  </Button>
                </div>
              )}

              {isLoadingCNC ? <TableSkeleton rows={3} /> : (
                <>
                  <CNCTable
                    products={processingCNC.slice((cncProcessingPage - 1) * pageSize, cncProcessingPage * pageSize)}
                    selectedImeis={selectedIds}
                    onSelect={(imei) => handleSelect(imei)}
                    onSelectAll={() => {
                      if (selectedIds.length === processingCNC.length) setSelectedIds([])
                      else setSelectedIds(processingCNC.map((p: any, idx: number) => p.imei || p.id || `unknown-${idx}`))
                    }}
                    isEditMode={isEditMode}
                    onComplete={(p) => completeCNC({ productIds: [p.imei || p.id], employeeId: me?.employeeId || "NV-UNKNOWN" })}
                    totalCount={processingCNC.length}
                  />
                  {processingCNC.length > pageSize && (
                    <div className="flex items-center justify-between mt-2 px-2">
                      <div className="text-[12px] text-slate-500">
                        Trang {cncProcessingPage} / {Math.ceil(processingCNC.length / pageSize)}
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 text-[11px]"
                          disabled={cncProcessingPage === 1}
                          onClick={() => setCncProcessingPage(cncProcessingPage - 1)}
                        >
                          Trạm trước
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 text-[11px]"
                          disabled={cncProcessingPage * pageSize >= processingCNC.length}
                          onClick={() => setCncProcessingPage(cncProcessingPage + 1)}
                        >
                          Trạm sau
                        </Button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            <div className="space-y-4 opacity-90 grayscale-[0.3]">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b pb-2">
                <h3 className="text-lg font-bold text-slate-700 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                  Đã hoàn thành CNC
                  <Badge variant="secondary" className="ml-2 bg-emerald-50 text-emerald-600 border-emerald-100">{completedCNC.length}</Badge>
                </h3>
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <Input
                    placeholder="Tìm máy đã hoàn thành..."
                    className="h-9 bg-white w-full sm:w-[240px]"
                    value={cncCompletedSearch}
                    onChange={(e) => { setCncCompletedSearch(e.target.value); setCncCompletedPage(1); }}
                  />
                </div>
              </div>
              {isLoadingCNC ? <TableSkeleton rows={3} /> : (
                <>
                  <CNCTable
                    products={completedCNC.slice((cncCompletedPage - 1) * pageSize, cncCompletedPage * pageSize)}
                    selectedImeis={[]}
                    onSelect={() => { }}
                    onSelectAll={() => { }}
                    isEditMode={false}
                    totalCount={completedCNC.length}
                  />
                  {completedCNC.length > pageSize && (
                    <div className="flex items-center justify-between mt-2 px-2">
                      <div className="text-[12px] text-slate-500">
                        Trang {cncCompletedPage} / {Math.ceil(completedCNC.length / pageSize)}
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 text-[11px]"
                          disabled={cncCompletedPage === 1}
                          onClick={() => setCncCompletedPage(cncCompletedPage - 1)}
                        >
                          Trạm trước
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 text-[11px]"
                          disabled={cncCompletedPage * pageSize >= completedCNC.length}
                          onClick={() => setCncCompletedPage(cncCompletedPage + 1)}
                        >
                          Trạm sau
                        </Button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        )}

        {activeTab === "giao-doi-tac" && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b pb-2">
              <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-purple-500 animate-pulse"></span>
                Đang giao đối tác
                <Badge variant="secondary" className="ml-2 bg-purple-50 text-purple-600 border-purple-100">{partnerProducts.length}</Badge>
              </h3>
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <Input
                  placeholder="Tìm máy đang giao..."
                  className="h-9 bg-white w-full sm:w-[240px]"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
                <Button
                  variant="outline"
                  size="icon"
                  className={`h-9 w-9 shrink-0 ${isEditMode ? "bg-purple-50 text-purple-600 border-purple-200" : ""}`}
                  onClick={() => setIsEditMode(!isEditMode)}
                >
                  <ListChecks className="w-4 h-4" />
                </Button>
              </div>
            </div>

            {isEditMode && selectedIds.length > 0 && (
              <div className="flex items-center gap-2 animate-in fade-in slide-in-from-left-2 transition-all">
                <Badge variant="secondary" className="px-3 py-1 bg-purple-50 text-purple-700 border-purple-100">
                  Đã chọn {selectedIds.length} máy
                </Badge>
                <Button
                  size="sm"
                  className="h-8 bg-orange-600 hover:bg-orange-700 shadow-sm"
                  onClick={async () => {
                    await returnPartner({ productIds: selectedIds, employeeId: me?.employeeId || "NV-UNKNOWN" });
                    setSelectedIds([]);
                    setIsEditMode(false);
                  }}
                  disabled={isReturningPartner}
                >
                  Hoàn kho đồng loạt ({selectedIds.length})
                </Button>
              </div>
            )}

            {isLoadingInv ? <TableSkeleton rows={3} /> : (
              <PartnerTable
                products={partnerProducts}
                selectedIds={selectedIds}
                onSelect={handleSelect}
                onSelectAll={() => {
                  if (selectedIds.length === partnerProducts.length) setSelectedIds([])
                  else setSelectedIds(partnerProducts.map((p: any) => p.id))
                }}
                isEditMode={isEditMode}
                onReturnStock={(p) => returnPartner({ productIds: [p.id], employeeId: me?.employeeId || "NV-UNKNOWN" })}
                onCompleteSale={handleCompleteSalePartner}
                totalCount={partnerProducts.length}
                isReturning={isReturningPartner}
              />
            )}
          </div>
        )}

        {activeTab === "bao-hanh" && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <Button onClick={() => setIsAddBaoHanhMachineOpen(true)} className="bg-blue-600">
                + Máy bảo hành
              </Button>
            </div>
            {isLoadingBH ? <TableSkeleton rows={5} /> : (
              <BaoHanhTable
                products={baoHanhHistory}
                selectedIds={[]}
                onSelect={() => { }}
                onSelectAll={() => { }}
                isEditMode={false}
                onViewInfo={(p) => toast.info(`Thông tin: ${p["Địa chỉ Bảo hành"]}`)}
              />
            )}
          </div>
        )}

        {activeTab === "phu-kien" && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <h3 className="text-lg font-semibold text-slate-800">Danh sách phụ kiện</h3>
              <div className="flex items-center gap-2">
                <Select value={accessoryStatusFilter} onValueChange={(v) => { setAccessoryStatusFilter(v); setAccessoryPage(1); }}>
                  <SelectTrigger className="w-[180px] h-9 bg-white">
                    <SelectValue placeholder="Trạng thái tồn" />
                  </SelectTrigger>
                  <SelectContent className="bg-white">
                    <SelectItem value="all">Trạng thái: Tất cả</SelectItem>
                    <SelectItem value="in_stock">Còn hàng (&gt; 5)</SelectItem>
                    <SelectItem value="low_stock">Sắp hết hàng (1 - 5)</SelectItem>
                    <SelectItem value="out_of_stock">Hết hàng (0)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            {isLoadingAcc ? <TableSkeleton rows={5} /> : (
              <>
                <AccessoryTable
                  items={filteredAccessories.slice((accessoryPage - 1) * pageSize, accessoryPage * pageSize)}
                  isManager={isManager}
                  onEdit={(item) => toast.info(`Chỉnh sửa phụ kiện: ${item.ten_phu_kien}`)}
                  totalCount={filteredAccessories.length}
                />

                {filteredAccessories.length > pageSize && (
                  <div className="flex items-center justify-between mt-4 pb-4">
                    <div className="text-sm text-slate-500">
                      Hiển thị {Math.min(filteredAccessories.length, (accessoryPage - 1) * pageSize + 1)} - {Math.min(filteredAccessories.length, accessoryPage * pageSize)} trong tổng số {filteredAccessories.length} phụ kiện
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={accessoryPage === 1}
                        onClick={() => setAccessoryPage(accessoryPage - 1)}
                      >
                        Trang trước
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={accessoryPage * pageSize >= filteredAccessories.length}
                        onClick={() => setAccessoryPage(accessoryPage + 1)}
                      >
                        Trang sau
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>

      <ProductDialog
        isOpen={isDialogOpen}
        onClose={() => { setIsDialogOpen(false); setSelectedProduct(null) }}
        product={selectedProduct}
        onSuccess={() => { }}
      />

      <AddCNCMachineDialog
        isOpen={isAddCNCMachineOpen}
        onClose={() => setIsAddCNCMachineOpen(false)}
        onSuccess={() => { }}
      />

      <SendCNCDialog
        isOpen={isSendCNCDialogOpen}
        onClose={() => setIsSendCNCDialogOpen(false)}
        selectedProducts={allProducts.filter(p => selectedIds.includes(p.id))}
        onSuccess={() => {
          setSelectedIds([])
          setIsEditMode(false)
        }}
      />

      <AddBaoHanhMachineDialog
        isOpen={isAddBaoHanhMachineOpen}
        onClose={() => setIsAddBaoHanhMachineOpen(false)}
        onSuccess={() => { }}
      />

      <SendPartnerDialog
        open={isSendPartnerDialogOpen}
        onOpenChange={setIsSendPartnerDialogOpen}
        selectedProducts={allProducts.filter(p => selectedIds.includes(p.id))}
        employeeId={me?.employeeId}
        onSuccess={() => {
          setSelectedIds([])
          setIsEditMode(false)
        }}
      />
    </div>
  )
}
