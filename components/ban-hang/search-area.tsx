"use client"

import { CartItem } from "@/lib/types/ban-hang"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { Search, Globe, Lock, Battery, Copy, Pencil, Check, X, ShoppingCart, Edit2, Hammer, UserPlus, Hourglass } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table"
import { getLoaiMayLabel, getLoaiMayBadgeClass, getPinColorClass, formatPinDisplay, getAppleColorHex, getTrangThaiColor, normalizeStatus } from "@/lib/utils/inventory-helpers"
import { useRef } from "react"
import { Checkbox } from "@/components/ui/checkbox"
import { buildCustomerQuote, copyTextToClipboard } from "@/lib/utils/customer-quote"
import { toast as sonnerToast } from "sonner"
import { cn } from "@/lib/utils"
import type { FilterType, SourceFilter } from "@/lib/store/inventory-store"

interface SearchAreaProps {
  isMobile: boolean
  mobileView: string
  searchQuery: string
  setSearchQuery: (q: string) => void
  isSearching: boolean
  searchResults: any[]
  sortedSearchResults: any[]
  selectedIndex: number
  setSelectedIndex: (i: number) => void
  addToCart: (p: any) => void
  // Domain lấy từ useInventoryStore để trùng với trang Kho hàng ("kho"/"doi_tac").
  filterSource: SourceFilter
  setFilterSource: (v: SourceFilter) => void
  filterType: FilterType
  setFilterType: (v: FilterType) => void
  toggleSort: (k: any) => void
  sortKey: string
  sortOrder: "asc" | "desc"
  tableContainerRef: React.RefObject<HTMLDivElement>
  highlight: (text: string, q: string) => React.ReactNode
  justAddedKey: string | null
  setJustAddedKey: (k: string | null) => void
  copiedImei: string | null
  setCopiedImei: (v: string | null) => void
  editingPriceId: string | null
  setEditingPriceId: (id: string | null) => void
  editPriceRef: React.RefObject<HTMLInputElement>
  setCart: React.Dispatch<React.SetStateAction<CartItem[]>>
  toast: any
  advancedFilter?: React.ReactNode
  cartProductKeys?: Set<string>
  isManager?: boolean
  // ===== Chế độ quản lý kho (gộp từ trang Kho hàng cũ) =====
  // Bật isEditMode -> mỗi dòng có checkbox chọn hàng loạt; tắt -> hiện cụm nút hành động.
  isEditMode?: boolean
  selectedIds?: string[]
  onSelect?: (id: string) => void
  onSelectAll?: () => void
  onEditProduct?: (p: any) => void
  onSendCNC?: (p: any) => void
  onSendPartner?: (p: any) => void
  onToggleProcessing?: (p: any) => void
}

export function SearchArea({
  isMobile,
  mobileView,
  searchQuery,
  setSearchQuery,
  isSearching,
  searchResults,
  sortedSearchResults,
  selectedIndex,
  setSelectedIndex,
  addToCart,
  filterSource,
  setFilterSource,
  filterType,
  setFilterType,
  toggleSort,
  sortKey,
  sortOrder,
  tableContainerRef,
  highlight,
  justAddedKey,
  setJustAddedKey,
  copiedImei,
  setCopiedImei,
  editingPriceId,
  setEditingPriceId,
  editPriceRef,
  setCart,
  toast,
  advancedFilter,
  cartProductKeys,
  isManager = false,
  isEditMode = false,
  selectedIds = [],
  onSelect,
  onSelectAll,
  onEditProduct,
  onSendCNC,
  onSendPartner,
  onToggleProcessing,
}: SearchAreaProps) {
  if (isMobile && mobileView !== 'san-pham') return null

  // Máy đã có trong giỏ -> tô màu để phân biệt
  const isInCart = (p: any) =>
    !!cartProductKeys && (
      (p.id != null && cartProductKeys.has(String(p.id))) ||
      (!!p.imei && cartProductKeys.has(String(p.imei))) ||
      (!!p.serial && cartProductKeys.has(String(p.serial)))
    )

  // Cột quản lý chỉ hiện cho MÁY (phụ kiện quản lý ở tab "Tồn phụ kiện").
  const hasManageActions = !!(onEditProduct || onSendCNC || onSendPartner || onToggleProcessing)
  const showSelectCol = isEditMode && !!onSelect
  const machineRows = sortedSearchResults.filter((p: any) => !!(p.imei || p.serial))

  // Cột "Đang xử lý" chứa tên NV đang giữ máy, hoặc "No" nếu không.
  const isProcessing = (p: any) => {
    const v = String(p?.dang_xu_ly || '').trim()
    return v !== '' && v.toLowerCase() !== 'no'
  }
  const processingName = (p: any) => {
    const v = String(p?.dang_xu_ly || '').trim()
    return v.toLowerCase() === 'yes' ? '' : v
  }
  const handleCopyQuote = async (p: any) => {
    const quote = buildCustomerQuote(p)
    const ok = await copyTextToClipboard(quote)
    if (ok) sonnerToast.success('Đã copy tin báo khách', { description: quote })
    else sonnerToast.error('Không copy được, thử lại giúp mình')
  }

  return (
    <Card className="min-h-[220px] flex flex-col overflow-hidden">
      <CardHeader>
        <CardTitle>Tìm kiếm sản phẩm</CardTitle>
        <CardDescription>Tìm kiếm iPhone và phụ kiện để thêm vào đơn hàng</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col min-h-0">
        <div className="relative mb-4">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Tìm theo Tên, IMEI/Serial..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-8"
            inputMode="search"
            enterKeyHint="search"
            onKeyDown={(e) => {
              const n = sortedSearchResults.length
              if (e.key === 'ArrowDown') {
                e.preventDefault()
                setSelectedIndex(Math.min(selectedIndex < 0 ? 0 : selectedIndex + 1, n - 1))
              } else if (e.key === 'ArrowUp') {
                e.preventDefault()
                setSelectedIndex(Math.max(selectedIndex - 1, -1))
              } else if (e.key === 'Enter') {
                if (selectedIndex >= 0 && sortedSearchResults[selectedIndex]) {
                  addToCart(sortedSearchResults[selectedIndex])
                  setSelectedIndex(-1)
                } else if (n === 1) {
                  addToCart(sortedSearchResults[0])
                }
              }
            }}
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 mb-3">
          <div className="flex flex-wrap items-center gap-1">
            <span className="text-xs text-muted-foreground mr-1">Nguồn:</span>
            <Button size="sm" variant={filterSource === 'all' ? 'default' : 'outline'}
              className={filterSource === 'all' ? 'bg-blue-600 text-white hover:bg-blue-700' : 'hover:text-blue-700 hover:border-blue-300 active:bg-blue-50'}
              onClick={() => setFilterSource('all')}>Tất cả</Button>
            <Button size="sm" variant={filterSource === 'kho' ? 'default' : 'outline'}
              className={filterSource === 'kho' ? 'bg-blue-600 text-white hover:bg-blue-700' : 'hover:text-blue-700 hover:border-blue-300 active:bg-blue-50'}
              onClick={() => setFilterSource('kho')}>Kho trong</Button>
            <Button size="sm" variant={filterSource === 'doi_tac' ? 'default' : 'outline'}
              className={filterSource === 'doi_tac' ? 'bg-blue-600 text-white hover:bg-blue-700' : 'hover:text-blue-700 hover:border-blue-300 active:bg-blue-50'}
              onClick={() => setFilterSource('doi_tac')}>Kho ngoài</Button>
          </div>
          <div className="flex flex-wrap items-center gap-1">
            <span className="text-xs text-muted-foreground mr-1">Loại:</span>
            <Button size="sm" variant={filterType === 'all' ? 'default' : 'outline'}
              className={filterType === 'all' ? 'bg-blue-600 text-white hover:bg-blue-700' : 'hover:text-blue-700 hover:border-blue-300 active:bg-blue-50'}
              onClick={() => setFilterType('all')}>Tất cả</Button>
            <Button size="sm" variant={filterType === 'iphone' ? 'default' : 'outline'}
              className={filterType === 'iphone' ? 'bg-blue-600 text-white hover:bg-blue-700' : 'hover:text-blue-700 hover:border-blue-300 active:bg-blue-50'}
              onClick={() => setFilterType('iphone')}>iPhone</Button>
            <Button size="sm" variant={filterType === 'ipad' ? 'default' : 'outline'}
              className={filterType === 'ipad' ? 'bg-blue-600 text-white hover:bg-blue-700' : 'hover:text-blue-700 hover:border-blue-300 active:bg-blue-50'}
              onClick={() => setFilterType('ipad')}>iPad</Button>
            <Button size="sm" variant={filterType === 'phu_kien' ? 'default' : 'outline'}
              className={filterType === 'phu_kien' ? 'bg-blue-600 text-white hover:bg-blue-700' : 'hover:text-blue-700 hover:border-blue-300 active:bg-blue-50'}
              onClick={() => setFilterType('phu_kien')}>Phụ kiện</Button>
            <Button size="sm" variant={filterType === 'sim_ghep' ? 'default' : 'outline'}
              className={filterType === 'sim_ghep' ? 'bg-blue-600 text-white hover:bg-blue-700' : 'hover:text-blue-700 hover:border-blue-300 active:bg-blue-50'}
              onClick={() => setFilterType('sim_ghep')}>Sim ghép</Button>
          </div>
        </div>

        {advancedFilter && <div className="mb-3">{advancedFilter}</div>}

        <div className="min-h-0">
          {(isSearching || searchResults.length > 0) && (
            <>
              {/* Mobile: Card grid */}
              <div className="md:hidden mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[60vh] overflow-y-auto overflow-x-hidden rounded-lg border mb-4 p-3 min-h-0">
                {sortedSearchResults.map((product: any, idx: number) => {
                  const isDisabled = ["dadatcoc", "daban"].includes(normalizeStatus(product.trang_thai))
                  const rawPin = product.pin ?? product['Pin (%)']
                  const hasPin = rawPin !== undefined && rawPin !== null && String(rawPin).trim() !== ''
                  const formattedPin = !hasPin ? '' : typeof rawPin === 'number' ? `${rawPin}%` : String(rawPin)
                  const tinhTrang = product.tinh_trang || product['Tình Trạng Máy'] || ''
                  const isAccessoryItem = (product.type === 'accessory') || (!!product.loai_phu_kien && !product.imei && !product.serial)
                  const isPartner = String(product.nguon || product.source || '').toLowerCase().includes('kho ngoài')
                  const pinNum = Math.max(0, Math.min(100, Math.round(Number(String(rawPin ?? '').replace(/[^\d.]/g, '')) || 0)))
                  const pinBar = pinNum >= 90 ? 'bg-emerald-500' : pinNum >= 80 ? 'bg-amber-500' : 'bg-red-500'
                  const giaSau = (product.gia_ban || 0) - (product.giam_gia || 0)
                  const tieuDe = isAccessoryItem
                    ? (product.ten_san_pham || '[Chưa có tên]')
                    : [product.ten_san_pham || '[Chưa có tên]', product.dung_luong, product.mau_sac].filter(Boolean).join(' — ')
                  const addCart = (e: React.MouseEvent) => {
                    e.stopPropagation()
                    if (isDisabled) return
                    addToCart(product)
                    setJustAddedKey(product.id || product.imei || product.serial || null)
                    setTimeout(() => setJustAddedKey(null), 500)
                    try { (navigator as any).vibrate && navigator.vibrate(10) } catch { }
                  }
                  const inCart = isInCart(product)
                  return (
                    <div
                      key={`${product.imei || product.serial || product.id || product.ten_san_pham}-${idx}`}
                      aria-disabled={isDisabled}
                      className={`relative flex flex-col rounded-2xl border p-4 shadow-sm transition select-none sm:p-5 ${inCart ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-500/10' : 'bg-card'} ${isDisabled ? 'opacity-60' : ''} ${justAddedKey === (product.id || product.imei || product.serial) ? 'ring-2 ring-green-500' : ''}`}
                    >
                      {/* Tiêu đề */}
                      <h3 className="text-base font-bold leading-snug text-foreground sm:text-lg">{tieuDe}</h3>

                      {/* Badge */}
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-muted px-3 py-1 text-xs font-medium text-foreground">
                          {isAccessoryItem ? 'Phụ kiện' : 'Máy'}
                        </span>
                        {!isAccessoryItem && (
                          isPartner ? (
                            <span className="rounded-full border border-teal-500 px-3 py-1 text-xs font-semibold text-teal-500">Kho ngoài</span>
                          ) : (
                            <span className="rounded-full border border-emerald-500 px-3 py-1 text-xs font-semibold text-emerald-500">Kho trong</span>
                          )
                        )}
                        {isManager && !isAccessoryItem && product.nguon_nhap && (
                          <span className="max-w-[180px] truncate rounded-full border border-slate-300 px-3 py-1 text-xs font-medium text-slate-600" title={product.nguon_nhap}>
                            Nhập: {product.nguon_nhap}
                          </span>
                        )}
                        {!isAccessoryItem && product.do_sim && (
                          <span className="max-w-[120px] truncate rounded-full border border-orange-300 px-3 py-1 text-xs font-medium text-orange-500 dark:border-orange-500/40">{product.do_sim}</span>
                        )}
                      </div>

                      <div className="my-3 border-t sm:my-4" />

                      {/* Thông số */}
                      <dl className="grid grid-cols-[4.5rem_1fr] gap-x-3 gap-y-2 text-sm">
                        {!isAccessoryItem ? (
                          <>
                            <dt className="text-muted-foreground">Loại</dt>
                            <dd className="font-medium text-foreground">{getLoaiMayLabel(product.loai_may)}</dd>
                            {hasPin && (
                              <>
                                <dt className="text-muted-foreground">Pin</dt>
                                <dd className="flex items-center gap-2">
                                  <span className={`font-medium ${getPinColorClass(rawPin)}`}>{formattedPin}</span>
                                  <span className="h-1.5 w-20 overflow-hidden rounded-full bg-muted">
                                    <span className={`block h-full rounded-full ${pinBar}`} style={{ width: `${pinNum}%` }} />
                                  </span>
                                </dd>
                              </>
                            )}
                            {tinhTrang && (
                              <>
                                <dt className="text-muted-foreground">Tình trạng</dt>
                                <dd className="font-medium text-foreground">{tinhTrang}</dd>
                              </>
                            )}
                            {(product.imei || product.serial) && (
                              <>
                                <dt className="text-muted-foreground">{product.imei ? 'IMEI' : 'Serial'}</dt>
                                <dd className="font-mono font-medium text-foreground">{product.imei || product.serial}</dd>
                              </>
                            )}
                            {isManager && product.nguon_nhap && (
                              <>
                                <dt className="text-muted-foreground">Nguồn nhập</dt>
                                <dd className="font-medium text-foreground">{product.nguon_nhap}</dd>
                              </>
                            )}
                          </>
                        ) : (
                          <>
                            {product.loai_phu_kien && (
                              <>
                                <dt className="text-muted-foreground">Loại</dt>
                                <dd className="font-medium text-foreground">{product.loai_phu_kien}</dd>
                              </>
                            )}
                            <dt className="text-muted-foreground">Tồn</dt>
                            <dd className="font-medium text-foreground">{product.so_luong_ton ?? product.so_luong ?? 0}</dd>
                          </>
                        )}
                      </dl>

                      <div className="my-3 border-t sm:my-4" />

                      {/* Đáy: nút giỏ (hoặc checkbox khi chọn hàng loạt) + giá bán */}
                      <div className="flex items-center justify-between gap-3">
                        {showSelectCol && !isAccessoryItem ? (
                          <label
                            className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full border bg-card"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Checkbox
                              checked={selectedIds.includes(product.id)}
                              onCheckedChange={() => onSelect?.(product.id)}
                            />
                          </label>
                        ) : (
                          <button
                            type="button"
                            disabled={isDisabled}
                            aria-label="Thêm vào giỏ hàng"
                            onClick={addCart}
                            className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-blue-600 text-white shadow-lg shadow-blue-600/40 transition active:scale-95 hover:bg-blue-700 disabled:opacity-50 disabled:shadow-none"
                          >
                            <ShoppingCart className="h-5 w-5" />
                          </button>
                        )}
                        <div className="text-right">
                          <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Giá bán</div>
                          <div className="text-xl font-bold text-blue-500 sm:text-2xl">đ{giaSau.toLocaleString()}</div>
                          {(product.giam_gia || 0) > 0 && (
                            <div className="text-[11px] text-muted-foreground line-through">đ{product.gia_ban.toLocaleString()}</div>
                          )}
                        </div>
                      </div>

                      {hasManageActions && !isEditMode && !isAccessoryItem && (
                        <div className="mt-3 flex items-center justify-end gap-1 border-t pt-3" onClick={(e) => e.stopPropagation()}>
                          <Button variant="outline" size="icon" className="h-8 w-8 text-muted-foreground hover:text-sky-600"
                            title="Copy tin báo khách" onClick={() => handleCopyQuote(product)}>
                            <Copy className="h-4 w-4" />
                          </Button>
                          {onToggleProcessing && (
                            <Button variant="outline" size="icon"
                              className={cn("h-8 w-8", isProcessing(product)
                                ? "border-amber-300 bg-amber-100 text-amber-600 dark:border-amber-500/40 dark:bg-amber-500/20 dark:text-amber-400"
                                : "text-muted-foreground hover:text-amber-600")}
                              title={isProcessing(product) ? 'Bỏ đánh dấu đang xử lý' : 'Đánh dấu đang xử lý'}
                              onClick={() => onToggleProcessing(product)}>
                              <Hourglass className="h-4 w-4" />
                            </Button>
                          )}
                          {onSendCNC && (
                            <Button variant="outline" size="icon" className="h-8 w-8 text-muted-foreground hover:text-orange-500"
                              title="Gửi CNC" onClick={() => onSendCNC(product)}>
                              <Hammer className="h-4 w-4" />
                            </Button>
                          )}
                          {onSendPartner && (
                            <Button variant="outline" size="icon" className="h-8 w-8 text-muted-foreground hover:text-purple-600"
                              title="Giao đối tác" onClick={() => onSendPartner(product)}>
                              <UserPlus className="h-4 w-4" />
                            </Button>
                          )}
                          {onEditProduct && (
                            <Button variant="outline" size="icon" className="h-8 w-8 text-muted-foreground hover:text-blue-600"
                              title="Sửa thông tin máy" onClick={() => onEditProduct(product)}>
                              <Edit2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>

              {/* Desktop: Table list — scroll nội bộ (max-h) để header không dính lên đỉnh trang */}
              <div
                className="hidden md:block rounded-lg border"
                ref={tableContainerRef}
              >
                <Table className="min-w-[640px]" containerClassName="max-h-[calc(100vh-360px)] min-h-[200px] [scrollbar-gutter:stable]">
                  <TableHeader>
                    <TableRow className="sticky top-0 z-20 bg-card shadow-[inset_0_-1px_0_hsl(var(--border))] hover:bg-card">
                      {showSelectCol && (
                        <TableHead className="w-12 text-center">
                          <Checkbox
                            checked={machineRows.length > 0 && selectedIds.length === machineRows.length}
                            onCheckedChange={() => onSelectAll?.()}
                          />
                        </TableHead>
                      )}
                      <TableHead className="cursor-pointer" onClick={() => toggleSort('san_pham')}>
                        <div className="flex items-center gap-2">
                          Sản phẩm
                          <Badge variant="secondary" className="bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-400 hover:bg-blue-100 py-0 leading-none h-5">
                            {sortedSearchResults.length}
                          </Badge>
                          {sortKey === 'san_pham' && <span>{sortOrder === 'asc' ? '▲' : '▼'}</span>}
                        </div>
                      </TableHead>
                      <TableHead className="cursor-pointer" onClick={() => toggleSort('imei_loai')}>
                        IMEI/Seri {sortKey === 'imei_loai' && <span>{sortOrder === 'asc' ? '▲' : '▼'}</span>}
                      </TableHead>
                      <TableHead>Loại</TableHead>
                      <TableHead>Pin</TableHead>
                      <TableHead>Tình trạng</TableHead>
                      {isManager && <TableHead>Nguồn nhập</TableHead>}
                      <TableHead className="cursor-pointer" onClick={() => toggleSort('trang_thai')}>
                        Trạng thái {sortKey === 'trang_thai' && <span>{sortOrder === 'asc' ? '▲' : '▼'}</span>}
                      </TableHead>
                      <TableHead className="text-right cursor-pointer" onClick={() => toggleSort('gia')}>
                        Giá {sortKey === 'gia' && <span>{sortOrder === 'asc' ? '▲' : '▼'}</span>}
                      </TableHead>
                      {hasManageActions && !isEditMode && <TableHead className="w-[172px] text-right">Kho</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isSearching && sortedSearchResults.length === 0 ? (
                      Array.from({ length: 8 }).map((_, i) => (
                        <TableRow key={`skeleton-${i}`}>
                          <TableCell colSpan={(isManager ? 8 : 7) + (showSelectCol ? 1 : 0) + (hasManageActions && !isEditMode ? 1 : 0)}><div className="h-8 w-full bg-muted animate-pulse rounded" /></TableCell>
                        </TableRow>
                      ))
                    ) : (
                      sortedSearchResults.map((product: any, idx: number) => {
                        const isDisabled = ["dadatcoc", "daban"].includes(normalizeStatus(product.trang_thai))
                        const isAccessory = (product.type === 'accessory') || (!!product.loai_phu_kien && !product.imei && !product.serial)
                        const pinRaw = product.pin ?? product['Pin (%)']
                        const tinhTrang = product.tinh_trang || product['Tình Trạng Máy'] || ''
                        const trangThai = product.trang_thai || 'Còn hàng'
                        const idVal = product.imei || product.serial
                        const rowKey = product.id || product.imei || product.serial
                        const inCart = isInCart(product)
                        const rowBg = justAddedKey === rowKey
                          ? 'animate-pulse bg-green-50 dark:bg-green-500/15'
                          : idx === selectedIndex
                            ? 'bg-blue-50 dark:bg-blue-500/15'
                            : inCart
                              ? 'bg-emerald-50 dark:bg-emerald-500/10'
                              : 'odd:bg-muted/30'
                        return (
                          <TableRow
                            key={`${product.imei || product.serial || product.id || product.ten_san_pham}-${idx}`}
                            data-index={idx}
                            className={cn(
                              isDisabled ? 'opacity-60' : 'cursor-pointer hover:bg-accent',
                              inCart && 'border-l-2 border-emerald-500',
                              rowBg,
                              isProcessing(product) && 'bg-amber-50/80 hover:bg-amber-100/60 dark:bg-amber-500/10 dark:hover:bg-amber-500/15',
                            )}
                            onClick={() => {
                              if (isDisabled) return
                              // Đang bật chọn hàng loạt thì click dòng = chọn, không thêm vào giỏ.
                              if (showSelectCol) { onSelect?.(product.id); return }
                              addToCart(product)
                              setJustAddedKey(product.id || product.imei || product.serial || null)
                              setTimeout(() => setJustAddedKey(null), 500)
                            }}
                          >
                            {showSelectCol && (
                              <TableCell className="text-center align-top" onClick={(e) => e.stopPropagation()}>
                                {(product.imei || product.serial) ? (
                                  <Checkbox
                                    checked={selectedIds.includes(product.id)}
                                    onCheckedChange={() => onSelect?.(product.id)}
                                  />
                                ) : null}
                              </TableCell>
                            )}
                            {/* Sản phẩm: tên + màu • dung lượng + nguồn + dạng sim (gộp như Kho hàng) */}
                            <TableCell className="px-3 py-2.5 align-top">
                              <div className="font-medium leading-tight">
                                {highlight(product.ten_san_pham || '[Chưa có tên sản phẩm]', searchQuery)}
                              </div>
                              {isProcessing(product) && (
                                <Badge className="mt-1 animate-pulse border-none bg-amber-500 text-[10px] text-white hover:bg-amber-500">
                                  Đang xử lý{processingName(product) ? ` · ${processingName(product)}` : ''}
                                </Badge>
                              )}
                              {isAccessory ? (
                                <div className="mt-1">
                                  <Badge variant="outline" className="text-[10px] h-4 px-1 py-0 leading-none">Phụ kiện</Badge>
                                </div>
                              ) : (
                                <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
                                  {product.mau_sac && (
                                    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                                      <span className="h-2.5 w-2.5 rounded-full ring-1 ring-black/10 dark:ring-white/20 shrink-0" style={{ backgroundColor: getAppleColorHex(product.mau_sac) }} />
                                      {product.mau_sac}
                                    </span>
                                  )}
                                  {product.dung_luong && <span className="text-xs text-muted-foreground">• {product.dung_luong}</span>}
                                  {String(product.nguon || product.source || '').toLowerCase().includes('kho ngoài') ? (
                                    <Badge variant="outline" className="bg-blue-50 text-blue-600 border-blue-100 dark:bg-blue-500/15 dark:text-blue-400 dark:border-transparent text-[10px] h-4 px-1 py-0 leading-none">Kho ngoài</Badge>
                                  ) : (
                                    <Badge variant="outline" className="bg-emerald-50 text-emerald-600 border-emerald-100 dark:bg-emerald-500/15 dark:text-emerald-400 dark:border-transparent text-[10px] h-4 px-1 py-0 leading-none">Kho trong</Badge>
                                  )}
                                  {isManager && product.nguon_nhap && (
                                    <Badge variant="outline" className="text-[10px] h-4 px-1 py-0 leading-none max-w-[150px] truncate" title={product.nguon_nhap}>
                                      Nhập: {product.nguon_nhap}
                                    </Badge>
                                  )}
                                  {product.do_sim && (
                                    <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-500/15 dark:text-orange-400 dark:border-transparent text-[10px] h-4 px-1.5 py-0 leading-none">
                                      {product.do_sim}
                                    </Badge>
                                  )}
                                </div>
                              )}
                            </TableCell>
                            {/* IMEI/Seri */}
                            <TableCell className="font-mono text-xs px-3 py-2 whitespace-nowrap align-top">
                              {idVal ? (
                                <button
                                  type="button"
                                  onClick={async (e) => { e.stopPropagation(); try { await navigator.clipboard.writeText(idVal) } catch { }; setCopiedImei(idVal); toast.success('Đã sao chép'); setTimeout(() => setCopiedImei(null), 1000) }}
                                  className="inline-flex items-center gap-1 underline decoration-dotted hover:text-blue-600 dark:hover:text-blue-400"
                                >
                                  <Copy className="h-3 w-3" />
                                  {copiedImei === idVal ? 'Đã chép' : highlight(String(idVal), searchQuery)}
                                </button>
                              ) : (
                                <span>{highlight(String(product.loai_phu_kien || '-'), searchQuery)}</span>
                              )}
                            </TableCell>
                            {/* Loại */}
                            <TableCell className="px-3 py-2 align-top">
                              {isAccessory ? <span className="text-muted-foreground">-</span> : (
                                <Badge variant="outline" className={`${getLoaiMayBadgeClass(product.loai_may)} font-medium whitespace-nowrap`}>
                                  {getLoaiMayLabel(product.loai_may)}
                                </Badge>
                              )}
                            </TableCell>
                            {/* Pin */}
                            <TableCell className="px-3 py-2 whitespace-nowrap align-top">
                              {isAccessory ? <span className="text-muted-foreground">-</span> : (
                                <span className={`text-sm font-semibold ${pinRaw ? getPinColorClass(pinRaw) : 'text-muted-foreground'}`}>
                                  {formatPinDisplay(pinRaw)}
                                </span>
                              )}
                            </TableCell>
                            {/* Tình trạng */}
                            <TableCell className="px-3 py-2 text-xs text-muted-foreground max-w-[160px] align-top">
                              {isAccessory ? `Tồn: ${product.so_luong_ton ?? product.so_luong ?? 0}` : (
                                <span className="line-clamp-2" title={tinhTrang}>{tinhTrang || '-'}</span>
                              )}
                            </TableCell>
                            {isManager && (
                              <TableCell className="px-3 py-2 text-xs text-muted-foreground max-w-[180px] align-top">
                                {isAccessory ? '-' : (product.nguon_nhap || '-')}
                              </TableCell>
                            )}
                            {/* Trạng thái */}
                            <TableCell className="px-3 py-2 align-top">
                              <Badge className={`${getTrangThaiColor(trangThai)} border-none whitespace-nowrap`}>{trangThai}</Badge>
                            </TableCell>
                            {/* Giá */}
                            <TableCell className="px-3 py-2 text-right whitespace-nowrap align-top">
                              <div className="flex flex-col items-end">
                                <span className="font-semibold text-blue-600 dark:text-blue-400 text-sm">
                                  ₫{(product.gia_ban - (product.giam_gia || 0)).toLocaleString()}
                                </span>
                                {(product.giam_gia || 0) > 0 && (
                                  <span className="text-[10px] text-muted-foreground line-through">
                                    ₫{product.gia_ban.toLocaleString()}
                                  </span>
                                )}
                              </div>
                            </TableCell>
                            {hasManageActions && !isEditMode && (
                              <TableCell className="px-2 py-2 align-top" onClick={(e) => e.stopPropagation()}>
                                {isAccessory ? (
                                  <span className="text-xs text-muted-foreground">-</span>
                                ) : (
                                  <div className="flex items-center justify-end gap-1">
                                    <Button variant="outline" size="icon" className="h-7 w-7 text-muted-foreground hover:text-sky-600"
                                      title="Copy tin báo khách" onClick={() => handleCopyQuote(product)}>
                                      <Copy className="h-3.5 w-3.5" />
                                    </Button>
                                    {onToggleProcessing && (
                                      <Button variant="outline" size="icon"
                                        className={cn("h-7 w-7", isProcessing(product)
                                          ? "border-amber-300 bg-amber-100 text-amber-600 hover:bg-amber-200 dark:border-amber-500/40 dark:bg-amber-500/20 dark:text-amber-400"
                                          : "text-muted-foreground hover:text-amber-600")}
                                        title={isProcessing(product) ? `Bỏ đánh dấu (${processingName(product) || 'đang xử lý'})` : 'Đánh dấu đang xử lý'}
                                        onClick={() => onToggleProcessing(product)}>
                                        <Hourglass className="h-3.5 w-3.5" />
                                      </Button>
                                    )}
                                    {onSendCNC && (
                                      <Button variant="outline" size="icon" className="h-7 w-7 text-muted-foreground hover:text-orange-500"
                                        title="Gửi CNC" onClick={() => onSendCNC(product)}>
                                        <Hammer className="h-3.5 w-3.5" />
                                      </Button>
                                    )}
                                    {onSendPartner && (
                                      <Button variant="outline" size="icon" className="h-7 w-7 text-muted-foreground hover:text-purple-600"
                                        title="Giao đối tác" onClick={() => onSendPartner(product)}>
                                        <UserPlus className="h-3.5 w-3.5" />
                                      </Button>
                                    )}
                                    {onEditProduct && (
                                      <Button variant="outline" size="icon" className="h-7 w-7 text-muted-foreground hover:text-blue-600"
                                        title="Sửa thông tin máy" onClick={() => onEditProduct(product)}>
                                        <Edit2 className="h-3.5 w-3.5" />
                                      </Button>
                                    )}
                                  </div>
                                )}
                              </TableCell>
                            )}
                          </TableRow>
                        )
                      })
                    )}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
