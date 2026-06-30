"use client"

import { useState } from "react"
import { CartItem, WarrantyPackageUI } from "@/lib/types/ban-hang"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { CheckCircle, Plus, Minus, Trash2, Pencil, Check, X } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { getLoaiMayLabel } from "@/lib/utils/inventory-helpers"
import {
  QUICK_ACC_CATEGORIES,
  type QuickAccCategory,
  type QuickAccProduct,
  addAccessoryUnit,
  removeAccessoryUnit,
  accessoryQtyInCart,
  filterAccessoriesForPhone,
} from "@/lib/ban-hang/quick-accessories"

interface CartItemRowProps {
  item: CartItem
  cart: CartItem[]
  setCart: React.Dispatch<React.SetStateAction<CartItem[]>>
  selectedWarranties: Record<string, string | null>
  setSelectedWarranties: React.Dispatch<React.SetStateAction<Record<string, string | null>>>
  warrantyPackages: WarrantyPackageUI[]
  isWarrantyEligible: (item: CartItem) => boolean
  handleSelectWarranty: (deviceId: string, pkgCode: string | null) => void
  openWarrantyInfo: string | null
  setOpenWarrantyInfo: React.Dispatch<React.SetStateAction<string | null>>
  updateQuantity: (id: string, type: string, newQty: number) => void
  removeFromCart: (id: string, type: string) => void
  accessoriesByCategory?: Record<QuickAccCategory, QuickAccProduct[]>
}

export function CartItemRow({
  item,
  cart,
  setCart,
  selectedWarranties,
  setSelectedWarranties,
  warrantyPackages,
  isWarrantyEligible,
  handleSelectWarranty,
  openWarrantyInfo,
  setOpenWarrantyInfo,
  updateQuantity,
  removeFromCart,
  accessoriesByCategory
}: CartItemRowProps) {
  const [isEditingPrice, setIsEditingPrice] = useState(false)
  const [tempPrice, setTempPrice] = useState(String(item.gia_ban))

  const isPartner = String(item.nguon || item.source || '').toLowerCase().includes('kho ngoài')
  const deviceId = (item.imei || item.serial || item.id) as string

  // ===== Phụ kiện kèm theo máy (quick-add) =====
  const quickAcc = (item.quick_acc || {}) as Record<string, string>
  // Chỉ hiện phụ kiện hợp model của máy (vd 16 Pro Max -> cường lực/ốp lưng 16 Pro Max).
  const accForPhone = (item.type === 'product' && accessoriesByCategory)
    ? (Object.fromEntries(
        QUICK_ACC_CATEGORIES.map((c) => [c.key, filterAccessoriesForPhone(accessoriesByCategory[c.key] || [], item.ten_san_pham)])
      ) as Record<QuickAccCategory, QuickAccProduct[]>)
    : null
  const hasQuickAcc = !!accForPhone &&
    QUICK_ACC_CATEGORIES.some((c) => (accForPhone[c.key] || []).length > 0)

  // Chọn mặc định: rẻ nhất còn tồn (so với giỏ hiện tại)
  const pickDefault = (cartNow: CartItem[], cat: QuickAccCategory): QuickAccProduct | null => {
    const prods = (accForPhone?.[cat] || []).filter((p) => p.so_luong_ton - accessoryQtyInCart(cartNow, p.id) > 0)
    if (!prods.length) return null
    return [...prods].sort((a, b) => a.gia_ban - b.gia_ban)[0]
  }

  const toggleQuickAcc = (cat: QuickAccCategory, checked: boolean) => {
    setCart((prev) => {
      if (checked) {
        const prod = pickDefault(prev, cat)
        if (!prod) return prev
        let next = addAccessoryUnit(prev, prod)
        next = next.map((p) => (p.id === item.id && p.type === 'product')
          ? { ...p, quick_acc: { ...(p.quick_acc || {}), [cat]: prod.id } } : p)
        return next
      }
      const accId = quickAcc[cat]
      let next = accId ? removeAccessoryUnit(prev, accId) : prev
      next = next.map((p) => {
        if (p.id === item.id && p.type === 'product') {
          const qa = { ...(p.quick_acc || {}) }
          delete qa[cat]
          return { ...p, quick_acc: qa }
        }
        return p
      })
      return next
    })
  }

  const changeQuickAcc = (cat: QuickAccCategory, newId: string) => {
    setCart((prev) => {
      const oldId = quickAcc[cat]
      if (oldId === newId) return prev
      let next = oldId ? removeAccessoryUnit(prev, oldId) : prev
      const prod = (accForPhone?.[cat] || []).find((p) => p.id === newId)
      if (prod) next = addAccessoryUnit(next, prod)
      next = next.map((p) => (p.id === item.id && p.type === 'product')
        ? { ...p, quick_acc: { ...(p.quick_acc || {}), [cat]: newId } } : p)
      return next
    })
  }

  // Xoá máy: dọn luôn các phụ kiện đã kèm theo máy này
  const handleRemove = () => {
    const accIds = Object.values(quickAcc)
    if (item.type !== 'product' || accIds.length === 0) {
      removeFromCart(item.id, item.type)
      return
    }
    setCart((prev) => {
      let next = prev
      for (const accId of accIds) next = removeAccessoryUnit(next, accId)
      return next.filter((p) => !(p.id === item.id && p.type === item.type))
    })
  }

  return (
    <div className="border rounded-lg p-3 sm:p-2.5 bg-card shadow-sm">
    <div className="grid grid-cols-1 sm:grid-cols-[1.4fr_1fr_0.9fr_0.9fr_auto] gap-2 items-start sm:items-center">
      <div className="min-w-0">
        <p className="font-medium truncate" title={item.ten_san_pham}>{item.ten_san_pham}</p>
        {item.type === 'product' && (item.dung_luong || item.mau_sac || item.loai_may) && (
          <p className="text-[11px] text-muted-foreground">
            {[item.dung_luong, item.mau_sac, item.loai_may ? getLoaiMayLabel(item.loai_may) : '']
              .filter(Boolean)
              .join(' • ')}
          </p>
        )}
        {(item.imei || item.serial) && (
          <p className="text-[11px] text-muted-foreground font-mono">{item.imei ? 'IMEI' : 'Serial'}: {item.imei || item.serial}</p>
        )}
        <div className="mt-1 flex gap-1.5 flex-wrap items-center">
          {item.do_sim && (
            <Badge className="bg-orange-50 text-orange-700 border-orange-200 border text-[10px] h-4 leading-none py-0" variant="outline">
              {item.do_sim}
            </Badge>
          )}
          {isPartner && (
            <>
              <Badge className="bg-teal-600 text-white border-teal-600 text-[10px] h-4 leading-none py-0">Kho ngoài</Badge>
              {(item.ten_doi_tac || item.sdt_doi_tac) && (
                <span className="text-[10px] text-muted-foreground ml-1">
                  {(item.ten_doi_tac || '')}{item.ten_doi_tac && item.sdt_doi_tac ? ' • ' : ''}{(item.sdt_doi_tac || '')}
                </span>
              )}
            </>
          )}
        </div>
        {item.type === 'accessory' && (
          <div className="mt-1 sm:hidden text-[11px] text-muted-foreground space-y-1">
            {item.loai_phu_kien && (
              <div>
                Loại: <span className="text-foreground">{item.loai_phu_kien}</span>
              </div>
            )}
            {item.mau_sac && (
              <div>
                Màu: <span className="text-foreground">{item.mau_sac}</span>
              </div>
            )}
          </div>
        )}
        
        {isPartner && item.type === 'product' && (
          <div className="mt-2 flex items-center gap-2 flex-wrap">
            <Input
              placeholder="Nhập IMEI hoặc Serial..."
              className="h-7 w-44 text-[11px] font-mono"
              defaultValue={item.imei || item.serial || ''}
              onBlur={async (e) => {
                const valRaw = (e.target.value || '').trim()
                const val = valRaw.replace(/\s/g, '')
                setCart(prev => prev.map(p => {
                  if (p.id === item.id && p.type === item.type) {
                    const prevId = (p.imei || p.serial || '')
                    const changed = prevId !== (val || '')
                    const next: any = { ...p, imei_confirmed: changed ? false : (p as any).imei_confirmed }
                    if (/^\d{10,}$/.test(val)) { next.imei = val; next.serial = '' }
                    else { next.serial = val; next.imei = '' }
                    return next
                  }
                  return p
                }))
              }}
            />
            <button
              type="button"
              className={`inline-flex items-center gap-1 text-[11px] ${item.imei ? 'text-foreground' : 'text-muted-foreground cursor-not-allowed'}`}
              disabled={!!item.imei_loading}
              onClick={async () => {
                if (!item.imei) return
                setCart(prev => prev.map(p => (p.id === item.id && p.type === item.type) ? { ...p, imei_loading: true } : p))
                const isPartner = String(item.nguon || item.source || '').toLowerCase().includes('kho ngoài')
                const sheet = item.partner_sheet || item.sheet
                const rowIndex = item.partner_row_index || item.row_index
                if (isPartner && sheet && rowIndex) {
                  try {
                    const res = await fetch('/api/doi-tac/confirm-imei', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ sheet, row_index: Number(rowIndex), imei: item.imei, createIdMay: true })
                    })
                    if (res.ok) {
                      const data = await res.json()
                      try { await fetch('/api/doi-tac/hang-order?refresh=1', { cache: 'no-store' }) } catch {}
                      setCart(prev => prev.map(p => {
                        if (p.id === item.id && p.type === item.type) {
                          const next: any = { ...p, imei_confirmed: !p.imei_confirmed, imei_loading: false }
                          if (data?.id_may) next.id_may = data.id_may
                          return next
                        }
                        return p
                      }))
                      toast.success('Xác nhận IMEI thành công')
                    } else {
                      const msg = await res.text()
                      toast.error('Lỗi xác nhận: ' + msg)
                      setCart(prev => prev.map(p => (p.id === item.id && p.type === item.type) ? { ...p, imei_loading: false } : p))
                    }
                  } catch (e: any) {
                    toast.error('Lỗi xác nhận: ' + (e?.message || String(e)))
                    setCart(prev => prev.map(p => (p.id === item.id && p.type === item.type) ? { ...p, imei_loading: false } : p))
                  }
                } else {
                  setCart(prev => prev.map(p => (p.id === item.id && p.type === item.type) ? { ...p, imei_confirmed: !p.imei_confirmed, imei_loading: false } : p))
                }
              }}
            >
              {item.imei_loading ? (
                <CheckCircle className="h-4 w-4 animate-spin text-blue-500" />
              ) : (
                <CheckCircle className={`h-4 w-4 ${item.imei_confirmed ? 'text-green-600' : 'text-muted-foreground'}`} />
              )}
            </button>
          </div>
        )}
      </div>

      <div className="text-center sm:text-left flex flex-col gap-1">
        {isWarrantyEligible(item) && (
          <>
            <select
              className="text-[11px] border rounded px-1 py-0.5 bg-card w-full max-w-[150px]"
              value={selectedWarranties[deviceId] || ''}
              onChange={e => handleSelectWarranty(deviceId, e.target.value || null)}
            >
              <option value="">Gói bảo hành...</option>
              {warrantyPackages.map(p => (
                <option key={p.code} value={p.code}>
                  {p.code}{p.hwMonths ? `-${p.hwMonths}T` : ''}{p.lifetime ? '(Life)' : ''}
                </option>
              ))}
            </select>
            {selectedWarranties[deviceId] && (
              <button
                type="button"
                className="text-[10px] underline text-blue-600 text-left"
                onClick={() => setOpenWarrantyInfo(openWarrantyInfo === deviceId ? null : deviceId)}
              >Chi tiết</button>
            )}
            {openWarrantyInfo === deviceId && selectedWarranties[deviceId] && (
              <div className="mt-1 p-2 rounded border bg-muted text-[10px] space-y-0.5 max-w-[150px]">
                 {(() => {
                   const sel = selectedWarranties[deviceId]
                   const pkg = warrantyPackages.find(p => p.code === sel)
                   if (!pkg) return null
                   return (
                     <>
                       <div className="font-medium">{pkg.name}</div>
                       {pkg.price > 0 && <div>Phí: ₫{pkg.price.toLocaleString()}</div>}
                       <div>Đổi trả: {pkg.exchangeDays} ngày</div>
                       {pkg.hwMonths > 0 && <div>Cứng: {pkg.hwMonths} tháng</div>}
                       {pkg.lifetime && <div>BH phần mềm trọn đời</div>}
                     </>
                   )
                 })()}
              </div>
            )}
          </>
        )}
        {item.type === 'accessory' && (
          <div className="hidden sm:block text-[10px] text-muted-foreground space-y-0.5">
            {item.loai_phu_kien && <div>Loại: <span className="text-foreground">{item.loai_phu_kien}</span></div>}
            {item.mau_sac && <div>Màu: <span className="text-foreground">{item.mau_sac}</span></div>}
          </div>
        )}
      </div>

      <div className="flex items-center gap-1 justify-center">
        {item.type === 'accessory' ? (
          <>
            <Button
              variant="outline"
              size="icon"
              className="h-7 w-7"
              onClick={() => updateQuantity(item.id, item.type, (item.so_luong || 1) - 1)}
            >
              <Minus className="h-3 w-3" />
            </Button>
            <span className="text-sm font-medium w-6 text-center">{item.so_luong}</span>
            <Button
              variant="outline"
              size="icon"
              className="h-7 w-7"
              onClick={() => updateQuantity(item.id, item.type, (item.so_luong || 1) + 1)}
            >
              <Plus className="h-3 w-3" />
            </Button>
          </>
        ) : (
          <Badge variant="secondary" className="bg-muted">x1</Badge>
        )}
      </div>

      <div className="text-right min-w-[100px]">
        {isEditingPrice ? (
          <div className="flex items-center gap-1 justify-end">
            <Input
              className="h-7 w-20 text-[11px] px-1 text-right"
              value={tempPrice}
              autoFocus
              onChange={e => setTempPrice(e.target.value.replace(/\D/g, ''))}
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  const newPrice = parseInt(tempPrice) || 0
                  setCart(prev => prev.map(it => (it.id === item.id && it.type === item.type) ? { ...it, gia_ban: newPrice } : it))
                  setIsEditingPrice(false)
                } else if (e.key === 'Escape') {
                  setTempPrice(String(item.gia_ban))
                  setIsEditingPrice(false)
                }
              }}
            />
            <button 
              className="text-green-600 hover:text-green-700"
              onClick={() => {
                const newPrice = parseInt(tempPrice) || 0
                setCart(prev => prev.map(it => (it.id === item.id && it.type === item.type) ? { ...it, gia_ban: newPrice } : it))
                setIsEditingPrice(false)
              }}
            >
              <Check className="h-3.5 w-3.5" />
            </button>
            <button 
              className="text-muted-foreground hover:text-muted-foreground"
              onClick={() => {
                setTempPrice(String(item.gia_ban))
                setIsEditingPrice(false)
              }}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-1 justify-end group">
            <p className="font-semibold text-sm">₫{(item.gia_ban * (item.so_luong || 1)).toLocaleString()}</p>
            <button 
              className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-blue-500"
              onClick={() => {
                setTempPrice(String(item.gia_ban))
                setIsEditingPrice(true)
              }}
            >
              <Pencil className="h-3 w-3" />
            </button>
          </div>
        )}
        
        {item.type === 'product' && selectedWarranties[deviceId] && (
          <p className="text-[10px] text-blue-600">
            + ₫{(warrantyPackages.find(p => p.code === selectedWarranties[deviceId])?.price || 0).toLocaleString()}
          </p>
        )}
      </div>

      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 text-muted-foreground hover:text-red-500 sm:ml-auto"
        onClick={handleRemove}
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>

    {/* Phụ kiện kèm theo máy: checkbox + tồn kho + chọn sản phẩm */}
    {hasQuickAcc && (
      <div className="mt-2.5 border-t pt-2.5">
        <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Phụ kiện kèm máy</p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
          {QUICK_ACC_CATEGORIES.map((cat) => {
            const prods = accForPhone?.[cat.key] || []
            if (prods.length === 0) return null
            // Tồn còn lại cho đúng model này (đã trừ phần đang trong giỏ)
            const remaining = prods.reduce((s, p) => s + Math.max(0, p.so_luong_ton - accessoryQtyInCart(cart, p.id)), 0)
            const selectedId = quickAcc[cat.key]
            const isChecked = !!selectedId
            const inStock = prods.filter((p) => p.so_luong_ton - accessoryQtyInCart(cart, p.id) > 0)
            const canCheck = isChecked || inStock.length > 0
            // Tuỳ chọn dropdown: hàng còn tồn + sản phẩm đang chọn (kể cả nếu vừa hết)
            const options = [...inStock]
            if (selectedId && !options.some((p) => p.id === selectedId)) {
              const sel = prods.find((p) => p.id === selectedId)
              if (sel) options.unshift(sel)
            }
            return (
              <div
                key={cat.key}
                className={`flex flex-col gap-1 rounded-md border px-2 py-1.5 ${isChecked ? 'border-blue-300 bg-blue-50/50 dark:border-blue-500/40 dark:bg-blue-500/10' : 'bg-muted/30'}`}
              >
                <label className={`flex items-center gap-1.5 text-[11px] font-medium ${canCheck ? 'cursor-pointer' : 'cursor-not-allowed opacity-60'}`}>
                  <Checkbox
                    checked={isChecked}
                    disabled={!canCheck}
                    onCheckedChange={(v) => toggleQuickAcc(cat.key, !!v)}
                    className="h-3.5 w-3.5"
                  />
                  <span className="truncate">{cat.label}</span>
                  <span className={`ml-auto shrink-0 text-[10px] tabular-nums ${remaining > 0 ? 'text-muted-foreground' : 'text-red-500'}`}>
                    {remaining > 0 ? `Tồn ${remaining}` : 'Hết'}
                  </span>
                </label>
                {isChecked && options.length > 0 && (
                  <select
                    value={selectedId}
                    onChange={(e) => changeQuickAcc(cat.key, e.target.value)}
                    className="w-full rounded border bg-card px-1 py-0.5 text-[10px]"
                  >
                    {options.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.ten_san_pham} • ₫{p.gia_ban.toLocaleString()}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            )
          })}
        </div>
      </div>
    )}
    </div>
  )
}
