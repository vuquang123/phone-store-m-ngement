"use client"

import { CartItem, WarrantyPackageUI } from "@/lib/types/ban-hang"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { CheckCircle, Plus, Minus, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"

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
  removeFromCart
}: CartItemRowProps) {
  const isPartner = String(item.nguon || item.source || '').toLowerCase().includes('kho ngoài')
  const deviceId = (item.imei || item.serial || item.id) as string

  return (
    <div className="grid grid-cols-1 sm:grid-cols-[1.4fr_1fr_0.9fr_0.9fr_auto] gap-2 items-start sm:items-center border rounded-lg p-3 sm:p-2.5 bg-white shadow-sm">
      <div className="min-w-0">
        <p className="font-medium truncate" title={item.ten_san_pham}>{item.ten_san_pham}</p>
        {(item.imei || item.serial) && (
          <p className="text-[11px] text-muted-foreground font-mono">{item.imei ? 'IMEI' : 'Serial'}: {item.imei || item.serial}</p>
        )}
        {isPartner && (
          <div className="mt-1">
            <Badge className="bg-teal-600 text-white text-[10px] h-4">Kho ngoài</Badge>
            {(item.ten_doi_tac || item.sdt_doi_tac) && (
              <span className="ml-2 text-[10px] text-muted-foreground">
                {(item.ten_doi_tac || '')}{item.ten_doi_tac && item.sdt_doi_tac ? ' • ' : ''}{(item.sdt_doi_tac || '')}
              </span>
            )}
          </div>
        )}
        {item.type === 'accessory' && (
          <div className="mt-1 sm:hidden text-[11px] text-muted-foreground space-y-1">
            {item.loai_phu_kien && (
              <div>
                Loại: <span className="text-slate-700">{item.loai_phu_kien}</span>
              </div>
            )}
            {item.mau_sac && (
              <div>
                Màu: <span className="text-slate-700">{item.mau_sac}</span>
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
              className={`inline-flex items-center gap-1 text-[11px] ${item.imei ? 'text-slate-700' : 'text-slate-400 cursor-not-allowed'}`}
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
                <CheckCircle className={`h-4 w-4 ${item.imei_confirmed ? 'text-green-600' : 'text-slate-400'}`} />
              )}
            </button>
          </div>
        )}
      </div>

      <div className="text-center sm:text-left flex flex-col gap-1">
        {isWarrantyEligible(item) && (
          <>
            <select
              className="text-[11px] border rounded px-1 py-0.5 bg-white w-full max-w-[150px]"
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
              <div className="mt-1 p-2 rounded border bg-slate-50 text-[10px] space-y-0.5 max-w-[150px]">
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
            {item.loai_phu_kien && <div>Loại: <span className="text-slate-700">{item.loai_phu_kien}</span></div>}
            {item.mau_sac && <div>Màu: <span className="text-slate-700">{item.mau_sac}</span></div>}
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
          <Badge variant="secondary" className="bg-slate-50">x1</Badge>
        )}
      </div>

      <div className="text-right">
        <p className="font-semibold text-sm">₫{(item.gia_ban * (item.so_luong || 1)).toLocaleString()}</p>
        {item.type === 'product' && selectedWarranties[deviceId] && (
          <p className="text-[10px] text-blue-600">
            + ₫{(warrantyPackages.find(p => p.code === selectedWarranties[deviceId])?.price || 0).toLocaleString()}
          </p>
        )}
      </div>

      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 text-slate-400 hover:text-red-500 sm:ml-auto"
        onClick={() => removeFromCart(item.id, item.type)}
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  )
}
