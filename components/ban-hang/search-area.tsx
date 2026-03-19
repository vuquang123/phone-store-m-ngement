"use client"

import { CartItem } from "@/lib/types/ban-hang"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { Search, Globe, Lock, Battery, Copy, Pencil, Check, X } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table"
import { useRef } from "react"

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
  filterSource: "all" | "inhouse" | "partner"
  setFilterSource: React.Dispatch<React.SetStateAction<"all" | "inhouse" | "partner">>
  filterType: "all" | "iphone" | "ipad" | "accessory"
  setFilterType: React.Dispatch<React.SetStateAction<"all" | "iphone" | "ipad" | "accessory">>
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
  toast
}: SearchAreaProps) {
  if (isMobile && mobileView !== 'san-pham') return null

  return (
    <Card className="min-h-[220px] h-full flex flex-col overflow-hidden lg:h-[600px]">
      <CardHeader>
        <CardTitle>Tìm kiếm sản phẩm</CardTitle>
        <CardDescription>Tìm kiếm iPhone và phụ kiện để thêm vào đơn hàng</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col h-full min-h-0">
        <div className="relative mb-4">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Tìm theo Tên, Loại phụ kiện, IMEI/Serial..."
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
          <div className="flex items-center gap-1">
            <span className="text-xs text-slate-500 mr-1">Nguồn:</span>
            <Button size="sm" variant={filterSource === 'all' ? 'default' : 'outline'}
              className={filterSource === 'all' ? 'bg-blue-600 text-white hover:bg-blue-700' : 'hover:text-blue-700 hover:border-blue-300 active:bg-blue-50'}
              onClick={() => setFilterSource('all')}>Tất cả</Button>
            <Button size="sm" variant={filterSource === 'inhouse' ? 'default' : 'outline'}
              className={filterSource === 'inhouse' ? 'bg-blue-600 text-white hover:bg-blue-700' : 'hover:text-blue-700 hover:border-blue-300 active:bg-blue-50'}
              onClick={() => setFilterSource('inhouse')}>Kho trong</Button>
            <Button size="sm" variant={filterSource === 'partner' ? 'default' : 'outline'}
              className={filterSource === 'partner' ? 'bg-blue-600 text-white hover:bg-blue-700' : 'hover:text-blue-700 hover:border-blue-300 active:bg-blue-50'}
              onClick={() => setFilterSource('partner')}>Kho ngoài</Button>
          </div>
          <div className="flex items-center gap-1">
            <span className="text-xs text-slate-500 mr-1">Loại:</span>
            <Button size="sm" variant={filterType === 'all' ? 'default' : 'outline'}
              className={filterType === 'all' ? 'bg-blue-600 text-white hover:bg-blue-700' : 'hover:text-blue-700 hover:border-blue-300 active:bg-blue-50'}
              onClick={() => setFilterType('all')}>Tất cả</Button>
            <Button size="sm" variant={filterType === 'iphone' ? 'default' : 'outline'}
              className={filterType === 'iphone' ? 'bg-blue-600 text-white hover:bg-blue-700' : 'hover:text-blue-700 hover:border-blue-300 active:bg-blue-50'}
              onClick={() => setFilterType('iphone')}>iPhone</Button>
            <Button size="sm" variant={filterType === 'ipad' ? 'default' : 'outline'}
              className={filterType === 'ipad' ? 'bg-blue-600 text-white hover:bg-blue-700' : 'hover:text-blue-700 hover:border-blue-300 active:bg-blue-50'}
              onClick={() => setFilterType('ipad')}>iPad</Button>
            <Button size="sm" variant={filterType === 'accessory' ? 'default' : 'outline'}
              className={filterType === 'accessory' ? 'bg-blue-600 text-white hover:bg-blue-700' : 'hover:text-blue-700 hover:border-blue-300 active:bg-blue-50'}
              onClick={() => setFilterType('accessory')}>Phụ kiện</Button>
          </div>
        </div>

        <div className="flex-1 overflow-y-hidden min-h-0">
          {(isSearching || searchResults.length > 0) && (
            <>
              {/* Mobile: Card grid */}
              <div className="md:hidden mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[60vh] overflow-y-auto overflow-x-hidden rounded-lg border mb-4 p-3 min-h-0">
                {sortedSearchResults.map((product: any) => {
                  const isDisabled = product.trang_thai === "Đã đặt cọc" || product.trang_thai === "Đã bán"
                  const rawPin = product.pin ?? product['Pin (%)']
                  const hasPin = rawPin !== undefined && rawPin !== null && String(rawPin).trim() !== ''
                  const formattedPin = !hasPin ? '' : typeof rawPin === 'number' ? `${rawPin}%` : String(rawPin)
                  const tinhTrang = product.tinh_trang || product['Tình Trạng Máy'] || ''
                  const isAccessoryItem = (product.type === 'accessory') || (!!product.loai_phu_kien && !product.imei && !product.serial)
                  return (
                    <div
                      key={`${product.id || product.imei || product.serial || product.ten_san_pham}`}
                      role="button"
                      tabIndex={0}
                      aria-disabled={isDisabled}
                      onClick={() => { if (!isDisabled) { addToCart(product); try { (navigator as any).vibrate && navigator.vibrate(10) } catch { } } }}
                      onKeyDown={(e) => { if (!isDisabled && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); addToCart(product) } }}
                      className={`group relative border rounded-xl p-3 pb-10 bg-white shadow-sm hover:shadow-md transition select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 active:bg-blue-50 ${isDisabled ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer hover:border-blue-300 active:border-blue-400'}`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="font-medium leading-snug">
                            {product.ten_san_pham || "[Chưa có tên sản phẩm]"}
                            {product.dung_luong ? ` - ${product.dung_luong}` : ""}
                            {product.mau_sac ? ` - ${product.mau_sac}` : ""}
                          </p>
                          <div className="mt-1 flex items-center gap-1 flex-wrap">
                            <Badge variant="outline">{isAccessoryItem ? 'Phụ kiện' : 'Máy'}</Badge>
                            {!isAccessoryItem && (
                              String(product.nguon || product.source || '').toLowerCase().includes('kho ngoài') ? (
                                <Badge variant="outline" className="border-teal-600 text-teal-700">Kho ngoài</Badge>
                              ) : (
                                <Badge variant="outline" className="border-emerald-600 text-emerald-700">Kho trong</Badge>
                              )
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="mt-2 text-sm text-muted-foreground">
                        {!isAccessoryItem ? (
                          <>
                            {product.loai_may && <div>Loại: <span className="text-slate-800">{product.loai_may}</span></div>}
                            {hasPin && <div>Pin: <span className="text-slate-800">{formattedPin}</span></div>}
                            {tinhTrang && <div>Tình trạng: <span className="text-slate-800">{tinhTrang}</span></div>}
                            {(product.imei || product.serial) && (
                              <div>{product.imei ? 'IMEI' : 'Serial'}: <span className="font-mono text-slate-800">{product.imei || product.serial}</span></div>
                            )}
                          </>
                        ) : (
                          <>
                            {product.loai_phu_kien && <div>Loại: <span className="text-slate-800">{product.loai_phu_kien}</span></div>}
                            <div>Tồn: <span className="text-slate-800">{product.so_luong_ton ?? product.so_luong ?? 0}</span></div>
                          </>
                        )}
                      </div>

                      <div className="absolute bottom-3 right-3 text-right flex flex-col items-end text-sm">
                        <span className="font-semibold text-blue-600">
                           ₫{(product.gia_ban - (product.giam_gia || 0)).toLocaleString()}
                        </span>
                        {(product.giam_gia || 0) > 0 && (
                          <span className="text-[10px] text-slate-400 line-through">
                            ₫{product.gia_ban.toLocaleString()}
                          </span>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Desktop: Table list */}
              <div
                className="hidden md:block mt-4 rounded-lg border h-full overflow-y-auto pr-2 pb-3"
                ref={tableContainerRef}
                style={{ scrollbarGutter: "stable" }}
              >
                <Table>
                  <TableHeader>
                    <TableRow className="sticky top-0 z-10 bg-white">
                      <TableHead className="w-[30%] cursor-pointer" onClick={() => toggleSort('san_pham')}>
                        <div className="flex items-center gap-2">
                          Sản phẩm
                          <Badge variant="secondary" className="bg-blue-100 text-blue-700 hover:bg-blue-100 py-0 leading-none h-5">
                            {sortedSearchResults.length}
                          </Badge>
                          {sortKey === 'san_pham' && <span>{sortOrder === 'asc' ? '▲' : '▼'}</span>}
                        </div>
                      </TableHead>
                      <TableHead className="w-[14%]">Ghi chú</TableHead>
                      <TableHead className="w-[20%] cursor-pointer" onClick={() => toggleSort('imei_loai')}>
                        IMEI/Serial / Loại {sortKey === 'imei_loai' && <span>{sortOrder === 'asc' ? '▲' : '▼'}</span>}
                      </TableHead>
                      <TableHead className="w-[28%] text-left">Chi tiết</TableHead>
                      <TableHead className="w-[12%] cursor-pointer" onClick={() => toggleSort('trang_thai')}>
                        Trạng thái {sortKey === 'trang_thai' && <span>{sortOrder === 'asc' ? '▲' : '▼'}</span>}
                      </TableHead>
                      <TableHead className="text-right cursor-pointer" onClick={() => toggleSort('gia')}>
                        Giá {sortKey === 'gia' && <span>{sortOrder === 'asc' ? '▲' : '▼'}</span>}
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isSearching && sortedSearchResults.length === 0 ? (
                      Array.from({ length: 8 }).map((_, i) => (
                        <TableRow key={`skeleton-${i}`}>
                           <TableCell colSpan={6}><div className="h-8 w-full bg-slate-100 animate-pulse rounded"/></TableCell>
                        </TableRow>
                      ))
                    ) : (
                      sortedSearchResults.map((product: any, idx: number) => {
                        const isDisabled = product.trang_thai === 'Đã đặt cọc' || product.trang_thai === 'Đã bán'
                        const isAccessory = (product.type === 'accessory') || (!!product.loai_phu_kien && !product.imei && !product.serial)
                        const rawPin = product.pin ?? product['Pin (%)']
                        const hasPin = rawPin !== undefined && rawPin !== null && String(rawPin).trim() !== ''
                        const formattedPin = !hasPin ? '' : typeof rawPin === 'number' ? `${rawPin}%` : String(rawPin)
                        const tinhTrang = product.tinh_trang || product['Tình Trạng Máy'] || product.trang_thai || ''
                        return (
                          <TableRow
                            key={`${product.id || product.imei || product.serial || product.ten_san_pham}`}
                            data-index={idx}
                            className={`${isDisabled ? 'opacity-60' : 'cursor-pointer hover:bg-blue-50/50 active:bg-blue-50'} ${idx === selectedIndex ? 'bg-blue-50' : ''} ${justAddedKey === (product.id || product.imei || product.serial) ? 'animate-pulse bg-green-50' : ''} odd:bg-slate-50/30`}
                            onClick={() => { if (!isDisabled) { addToCart(product); setJustAddedKey(product.id || product.imei || product.serial || null); setTimeout(() => setJustAddedKey(null), 500) } }}
                          >
                            <TableCell className="px-3 py-2">
                              <div className="font-medium line-clamp-2">
                                {highlight(product.ten_san_pham || '[Chưa có tên sản phẩm]', searchQuery)}
                                {product.dung_luong ? ` - ${product.dung_luong}` : ''}
                                {product.mau_sac ? ` - ${product.mau_sac}` : ''}
                              </div>
                            </TableCell>
                            <TableCell className="px-3 py-2 text-xs">
                              {product.ghi_chu || '-'}
                            </TableCell>
                            <TableCell className="font-mono text-xs px-3 py-2">
                              {(product.imei || product.serial) ? (
                                <button
                                  type="button"
                                  onClick={async (e) => { e.stopPropagation(); const v = product.imei || product.serial; try { await navigator.clipboard.writeText(v) } catch { }; setCopiedImei(v); toast.success('Đã sao chép'); setTimeout(() => setCopiedImei(null), 1000) }}
                                  className="inline-flex items-center gap-1 underline decoration-dotted hover:text-blue-700"
                                >
                                  <Copy className="h-3 w-3" />
                                  {copiedImei === (product.imei || product.serial) ? 'Đã chép' : highlight(String(product.imei || product.serial), searchQuery)}
                                </button>
                              ) : (
                                <span>{highlight(String(product.loai_phu_kien || '-'), searchQuery)}</span>
                              )}
                            </TableCell>
                            <TableCell className="px-3 py-2 text-xs text-left">
                              {!isAccessory ? (
                                <div className="flex items-center gap-2 justify-start opacity-70">
                                   <Badge variant="outline">{product.loai_may || '-'}</Badge>
                                   <Badge variant="outline">{hasPin ? formattedPin : '-'}</Badge>
                                   <span className="truncate max-w-[100px]" title={tinhTrang}>{tinhTrang}</span>
                                </div>
                              ) : (
                                <span className="opacity-70">Tồn: {product.so_luong_ton || 0}</span>
                              )}
                            </TableCell>
                            <TableCell className="px-3 py-2">
                              <Badge className={
                                product.trang_thai === 'Đã đặt cọc' ? 'bg-orange-100 text-orange-800' :
                                product.trang_thai === 'Đang CNC' ? 'bg-orange-100 text-orange-800' :
                                product.trang_thai === 'Đã bán' ? 'bg-gray-200 text-gray-600' : 'bg-green-100 text-green-800'
                              }>
                                {product.trang_thai || 'Còn hàng'}
                              </Badge>
                            </TableCell>
                            <TableCell className="px-3 py-2 text-right">
                              <div className="flex flex-col items-end">
                                <span className="font-semibold text-blue-600 text-sm">
                                  ₫{(product.gia_ban - (product.giam_gia || 0)).toLocaleString()}
                                </span>
                                {(product.giam_gia || 0) > 0 && (
                                  <span className="text-[10px] text-slate-400 line-through">
                                    ₫{product.gia_ban.toLocaleString()}
                                  </span>
                                )}
                              </div>
                            </TableCell>
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
