"use client"
// Các panel quản lý kho (CNC / Giao đối tác / Hàng đối tác / Bảo hành / Tồn phụ kiện),
// chuyển nguyên từ app/dashboard/kho-hang/page.tsx sang để trang Bán hàng mount lại được.
// Component tự gọi query + mutation của riêng nó; chỉ nhận 1 callback để đẩy máy đối tác
// vào giỏ hàng thật của trang (trước đây phải ghi localStorage rồi reload sang trang khác).
import { useMemo, useState } from "react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { TablePaginationFooter } from "@/components/ui/table-pagination-footer"
import { Plus, ListChecks } from "lucide-react"
import { toast } from "sonner"

import { CNCTable } from "@/components/kho-hang/cnc-table"
import { BaoHanhTable } from "@/components/kho-hang/bao-hanh-table"
import { PartnerTable } from "@/components/kho-hang/partner-table"
import { AccessoryTable } from "@/components/kho-hang/accessory-table"
import { HangDoiTacTable } from "@/components/kho-hang/hang-doi-tac-table"
import { HangDoiTacDialog } from "@/components/kho-hang/hang-doi-tac-dialog"
import AddCNCMachineDialog from "@/components/kho-hang/add-cnc-machine-dialog"
import AddBaoHanhMachineDialog from "@/components/kho-hang/add-baohanh-machine-dialog"
import { TableSkeleton } from "@/components/kho-hang/table-skeleton"

import {
  useInventoryData,
  useCNCData,
  useBaoHanhHistory,
  useAccessoriesData,
  useHangDoiTacData,
} from "@/hooks/use-inventory-data"
import { useInventoryActions } from "@/hooks/use-inventory-actions"
import { useAuthMe } from "@/hooks/use-auth-me"
import { extractPartnerInfo } from "@/lib/utils/inventory-helpers"

const PAGE_SIZE = 10

export type ManageTab = "dang-cnc" | "giao-doi-tac" | "hang-doi-tac" | "bao-hanh" | "phu-kien"

export const MANAGE_TABS: { key: ManageTab; label: string }[] = [
  { key: "dang-cnc", label: "CNC" },
  { key: "bao-hanh", label: "Bảo hành" },
  { key: "giao-doi-tac", label: "Giao đối tác" },
  { key: "hang-doi-tac", label: "Hàng đối tác" },
  { key: "phu-kien", label: "Tồn phụ kiện" },
]

interface ManageTabsProps {
  tab: ManageTab
  isManager: boolean
  /** Đẩy máy kho ngoài vào giỏ hàng của trang (thay cho hack localStorage + reload). */
  onAddPartnerToCart: (products: any[]) => void
}

export function ManageTabs({ tab, isManager, onAddPartnerToCart }: ManageTabsProps) {
  const { me } = useAuthMe()

  const { data: invRes, isLoading: isLoadingInv } = useInventoryData()
  const { data: cncRes, isLoading: isLoadingCNC } = useCNCData()
  const { data: bhRes, isLoading: isLoadingBH } = useBaoHanhHistory()
  const { data: accRes, isLoading: isLoadingAcc } = useAccessoriesData()
  const { data: hdtRes, isLoading: isLoadingHDT } = useHangDoiTacData()

  const rawInventory = invRes?.data || []
  const cncProducts = cncRes?.data || []
  const baoHanhHistory = bhRes?.data || []
  const accessories = accRes?.data || []
  const hangDoiTac = hdtRes?.data || []

  const {
    completeCNC,
    isCompletingCNC,
    returnPartner,
    isReturningPartner,
    addHangDoiTac,
    isAddingHangDoiTac,
    deleteHangDoiTac,
    isDeletingHangDoiTac,
    transferHangDoiTac,
    isTransferringHangDoiTac,
  } = useInventoryActions()

  // State cục bộ của từng panel
  const [isEditMode, setIsEditMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [isAddCNCMachineOpen, setIsAddCNCMachineOpen] = useState(false)
  const [isAddBaoHanhMachineOpen, setIsAddBaoHanhMachineOpen] = useState(false)
  const [isHangDoiTacDialogOpen, setIsHangDoiTacDialogOpen] = useState(false)
  const [cncProcessingSearch, setCncProcessingSearch] = useState("")
  const [cncCompletedSearch, setCncCompletedSearch] = useState("")
  const [cncProcessingPage, setCncProcessingPage] = useState(1)
  const [cncCompletedPage, setCncCompletedPage] = useState(1)
  const [partnerSearch, setPartnerSearch] = useState("")
  const [hangDoiTacSearch, setHangDoiTacSearch] = useState("")
  const [hangDoiTacPage, setHangDoiTacPage] = useState(1)
  const [accessoryPage, setAccessoryPage] = useState(1)
  const [accessoryStatusFilter, setAccessoryStatusFilter] = useState("all")

  const handleSelect = (id: string) =>
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))

  const clearSelection = () => {
    setSelectedIds([])
    setIsEditMode(false)
  }

  const processingCNC = useMemo(() => {
    let result = cncProducts.filter(
      (p: any) => p.trang_thai !== "Hoàn thành CNC" && (p.trang_thai_cnc || "").toLowerCase() !== "đã nhận",
    )
    if (cncProcessingSearch) {
      const q = cncProcessingSearch.toLowerCase()
      result = result.filter(
        (p: any) => p.ten_san_pham?.toLowerCase().includes(q) || p.imei?.toLowerCase().includes(q),
      )
    }
    return result
  }, [cncProducts, cncProcessingSearch])

  const completedCNC = useMemo(() => {
    let result = cncProducts.filter(
      (p: any) => p.trang_thai === "Hoàn thành CNC" || (p.trang_thai_cnc || "").toLowerCase() === "đã nhận",
    )
    if (cncCompletedSearch) {
      const q = cncCompletedSearch.toLowerCase()
      result = result.filter(
        (p: any) => p.ten_san_pham?.toLowerCase().includes(q) || p.imei?.toLowerCase().includes(q),
      )
    }
    return result
  }, [cncProducts, cncCompletedSearch])

  const partnerProducts = useMemo(() => {
    let result = rawInventory.filter((p: any) => p.trang_thai === "Giao đối tác")
    if (partnerSearch) {
      const q = partnerSearch.toLowerCase()
      result = result.filter(
        (p: any) => p.ten_san_pham?.toLowerCase().includes(q) || p.imei?.toLowerCase().includes(q),
      )
    }
    return result
  }, [rawInventory, partnerSearch])

  const filteredHangDoiTac = useMemo(() => {
    if (!hangDoiTacSearch) return hangDoiTac
    const q = hangDoiTacSearch.toLowerCase()
    return hangDoiTac.filter(
      (p: any) =>
        p.ten_san_pham?.toLowerCase().includes(q) ||
        p.imei?.toLowerCase().includes(q) ||
        p.nguon_hang?.toLowerCase().includes(q) ||
        p.mau_sac?.toLowerCase().includes(q),
    )
  }, [hangDoiTac, hangDoiTacSearch])

  const filteredAccessories = useMemo(() => {
    let result = accessories
    if (accessoryStatusFilter !== "all") {
      result = result.filter((a: any) => {
        const qty = parseInt(String(a.so_luong_ton || 0))
        if (accessoryStatusFilter === "in_stock") return qty > 5
        if (accessoryStatusFilter === "low_stock") return qty > 0 && qty <= 5
        if (accessoryStatusFilter === "out_of_stock") return qty <= 0
        return true
      })
    }
    return result
  }, [accessories, accessoryStatusFilter])

  /** Chốt bán 1 máy đối tác -> vào giỏ ngay, không rời trang. */
  const completeSalePartner = (p: any) => {
    onAddPartnerToCart([p])
    clearSelection()
  }

  const bulkCompleteSalePartner = () => {
    const selected = partnerProducts.filter((p: any) => selectedIds.includes(p.id))
    if (selected.length === 0) return
    // Giữ nguyên luật cũ: chốt hàng loạt chỉ cho phép trong cùng 1 đối tác.
    const partners = new Set(selected.map((p: any) => extractPartnerInfo(p.ghi_chu)))
    if (partners.size > 1) {
      toast.error("Vui lòng chỉ chọn các máy của cùng một đối tác để chốt hàng loạt")
      return
    }
    onAddPartnerToCart(selected)
    clearSelection()
  }

  return (
    <>
      {tab === "dang-cnc" && (
        <div className="space-y-8">
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b pb-2">
              <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                Đang CNC
                <Badge variant="secondary" className="ml-2 bg-blue-50 text-blue-600 border-blue-100">{processingCNC.length}</Badge>
              </h3>
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <Input
                  placeholder="Tìm máy đang CNC..."
                  className="h-9 bg-card w-full sm:w-[240px]"
                  value={cncProcessingSearch}
                  onChange={(e) => { setCncProcessingSearch(e.target.value); setCncProcessingPage(1) }}
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
              <div className="flex flex-wrap items-center gap-2 animate-in fade-in slide-in-from-left-2 transition-all">
                <Badge variant="secondary" className="px-3 py-1 bg-blue-50 text-blue-700 border-blue-100">
                  Đã chọn {selectedIds.length} máy
                </Badge>
                <Button
                  size="sm"
                  className="h-8 bg-green-600 hover:bg-green-700 shadow-sm"
                  onClick={() => {
                    completeCNC({ productIds: selectedIds, employeeId: me?.employeeId || "NV-UNKNOWN" })
                    clearSelection()
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
                  products={processingCNC.slice((cncProcessingPage - 1) * PAGE_SIZE, cncProcessingPage * PAGE_SIZE)}
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
                <TablePaginationFooter
                  page={cncProcessingPage}
                  totalPages={Math.max(1, Math.ceil(processingCNC.length / PAGE_SIZE))}
                  onPageChange={setCncProcessingPage}
                  totalItems={processingCNC.length}
                  pageSize={PAGE_SIZE}
                  itemLabel="máy CNC"
                />
              </>
            )}
          </div>

          <div className="space-y-4 opacity-90 grayscale-[0.3]">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b pb-2">
              <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                Đã hoàn thành CNC
                <Badge variant="secondary" className="ml-2 bg-emerald-50 text-emerald-600 border-emerald-100">{completedCNC.length}</Badge>
              </h3>
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <Input
                  placeholder="Tìm máy đã hoàn thành..."
                  className="h-9 bg-card w-full sm:w-[240px]"
                  value={cncCompletedSearch}
                  onChange={(e) => { setCncCompletedSearch(e.target.value); setCncCompletedPage(1) }}
                />
              </div>
            </div>
            {isLoadingCNC ? <TableSkeleton rows={3} /> : (
              <>
                <CNCTable
                  products={completedCNC.slice((cncCompletedPage - 1) * PAGE_SIZE, cncCompletedPage * PAGE_SIZE)}
                  selectedImeis={[]}
                  onSelect={() => {}}
                  onSelectAll={() => {}}
                  isEditMode={false}
                  totalCount={completedCNC.length}
                />
                <TablePaginationFooter
                  page={cncCompletedPage}
                  totalPages={Math.max(1, Math.ceil(completedCNC.length / PAGE_SIZE))}
                  onPageChange={setCncCompletedPage}
                  totalItems={completedCNC.length}
                  pageSize={PAGE_SIZE}
                  itemLabel="máy CNC"
                />
              </>
            )}
          </div>
        </div>
      )}

      {tab === "giao-doi-tac" && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b pb-2">
            <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-purple-500 animate-pulse" />
              Đang giao đối tác
              <Badge variant="secondary" className="ml-2 bg-purple-50 text-purple-600 border-purple-100">{partnerProducts.length}</Badge>
            </h3>
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <Input
                placeholder="Tìm máy đang giao..."
                className="h-9 bg-card w-full sm:w-[240px]"
                value={partnerSearch}
                onChange={(e) => setPartnerSearch(e.target.value)}
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
            <div className="flex flex-wrap items-center gap-2 animate-in fade-in slide-in-from-left-2 transition-all">
              <Badge variant="secondary" className="px-3 py-1 bg-purple-50 text-purple-700 border-purple-100">
                Đã chọn {selectedIds.length} máy
              </Badge>
              <Button
                size="sm"
                className="h-8 bg-orange-600 hover:bg-orange-700 shadow-sm"
                onClick={async () => {
                  await returnPartner({ productIds: selectedIds, employeeId: me?.employeeId || "NV-UNKNOWN" })
                  clearSelection()
                }}
                disabled={isReturningPartner}
              >
                Hoàn kho ({selectedIds.length})
              </Button>
              <Button
                size="sm"
                className="h-8 bg-purple-600 hover:bg-purple-700 shadow-sm"
                onClick={bulkCompleteSalePartner}
              >
                Chốt hàng loạt ({selectedIds.length})
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
              onCompleteSale={completeSalePartner}
              totalCount={partnerProducts.length}
              isReturning={isReturningPartner}
            />
          )}
        </div>
      )}

      {tab === "hang-doi-tac" && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b pb-2">
            <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-purple-500" />
              Hàng đối tác
              <Badge variant="secondary" className="ml-2 bg-purple-50 text-purple-600 border-purple-100">{filteredHangDoiTac.length}</Badge>
            </h3>
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <Input
                placeholder="Tìm theo tên, IMEI, nguồn hàng..."
                className="h-9 bg-card w-full sm:w-[260px]"
                value={hangDoiTacSearch}
                onChange={(e) => { setHangDoiTacSearch(e.target.value); setHangDoiTacPage(1) }}
              />
              <Button onClick={() => setIsHangDoiTacDialogOpen(true)} className="bg-emerald-600 hover:bg-emerald-700 h-9 shrink-0">
                <Plus className="w-4 h-4 mr-1" /> Nhập hàng
              </Button>
            </div>
          </div>

          {isLoadingHDT ? <TableSkeleton rows={5} /> : (
            <>
              <HangDoiTacTable
                products={filteredHangDoiTac.slice((hangDoiTacPage - 1) * PAGE_SIZE, hangDoiTacPage * PAGE_SIZE)}
                isManager={isManager}
                onDelete={(p) => deleteHangDoiTac({ productIds: [p.id || p.imei] }).catch(() => {})}
                onTransfer={(p, khoDich) =>
                  transferHangDoiTac({
                    productIds: [p.id || p.imei],
                    khoDich,
                    employeeId: me?.employeeId || "NV-UNKNOWN",
                  }).catch(() => {})
                }
                isDeleting={isDeletingHangDoiTac}
                isTransferring={isTransferringHangDoiTac}
                totalCount={filteredHangDoiTac.length}
              />
              <TablePaginationFooter
                page={hangDoiTacPage}
                totalPages={Math.max(1, Math.ceil(filteredHangDoiTac.length / PAGE_SIZE))}
                onPageChange={setHangDoiTacPage}
                totalItems={filteredHangDoiTac.length}
                pageSize={PAGE_SIZE}
                itemLabel="máy đối tác"
                className="bg-muted/50 px-4 rounded-md"
              />
            </>
          )}
        </div>
      )}

      {tab === "bao-hanh" && (
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
              onSelect={() => {}}
              onSelectAll={() => {}}
              isEditMode={false}
              onViewInfo={(p) => toast.info(`Thông tin: ${p["Địa chỉ Bảo hành"]}`)}
            />
          )}
        </div>
      )}

      {tab === "phu-kien" && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <h3 className="text-lg font-semibold text-foreground">Danh sách phụ kiện</h3>
            <Select value={accessoryStatusFilter} onValueChange={(v) => { setAccessoryStatusFilter(v); setAccessoryPage(1) }}>
              <SelectTrigger className="w-[180px] h-9 bg-card">
                <SelectValue placeholder="Trạng thái tồn" />
              </SelectTrigger>
              <SelectContent className="bg-card">
                <SelectItem value="all">Trạng thái: Tất cả</SelectItem>
                <SelectItem value="in_stock">Còn hàng (&gt; 5)</SelectItem>
                <SelectItem value="low_stock">Sắp hết hàng (1 - 5)</SelectItem>
                <SelectItem value="out_of_stock">Hết hàng (0)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {isLoadingAcc ? <TableSkeleton rows={5} /> : (
            <>
              <AccessoryTable
                items={filteredAccessories.slice((accessoryPage - 1) * PAGE_SIZE, accessoryPage * PAGE_SIZE)}
                isManager={isManager}
                onEdit={(item) => toast.info(`Chỉnh sửa phụ kiện: ${item.ten_phu_kien}`)}
                totalCount={filteredAccessories.length}
              />
              <TablePaginationFooter
                page={accessoryPage}
                totalPages={Math.max(1, Math.ceil(filteredAccessories.length / PAGE_SIZE))}
                onPageChange={setAccessoryPage}
                totalItems={filteredAccessories.length}
                pageSize={PAGE_SIZE}
                itemLabel="phụ kiện"
                className="pb-4"
              />
            </>
          )}
        </div>
      )}

      <HangDoiTacDialog
        isOpen={isHangDoiTacDialogOpen}
        onClose={() => setIsHangDoiTacDialogOpen(false)}
        onSubmit={(product) => addHangDoiTac(product)}
        isSubmitting={isAddingHangDoiTac}
      />
      <AddCNCMachineDialog
        isOpen={isAddCNCMachineOpen}
        onClose={() => setIsAddCNCMachineOpen(false)}
        onSuccess={() => {}}
      />
      <AddBaoHanhMachineDialog
        isOpen={isAddBaoHanhMachineOpen}
        onClose={() => setIsAddBaoHanhMachineOpen(false)}
        onSuccess={() => {}}
      />
    </>
  )
}
