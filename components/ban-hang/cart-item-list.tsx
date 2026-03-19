"use client"

import { useState } from "react"
import { CartItem, WarrantyPackageUI } from "@/lib/types/ban-hang"
import { CartItemRow } from "./cart-item"
import { Smartphone, Package, ShieldCheck } from "lucide-react"

interface CartItemListProps {
  cart: CartItem[]
  setCart: React.Dispatch<React.SetStateAction<CartItem[]>>
  selectedWarranties: Record<string, string | null>
  setSelectedWarranties: React.Dispatch<React.SetStateAction<Record<string, string | null>>>
  warrantyPackages: WarrantyPackageUI[]
  isWarrantyEligible: (item: CartItem) => boolean
  updateQuantity: (id: string, type: string, newQty: number) => void
  removeFromCart: (id: string, type: string) => void
  setEditingPriceId: React.Dispatch<React.SetStateAction<string | null>>
}

export function CartItemList({
  cart,
  setCart,
  selectedWarranties,
  setSelectedWarranties,
  warrantyPackages,
  isWarrantyEligible,
  updateQuantity,
  removeFromCart,
  setEditingPriceId
}: CartItemListProps) {
  const [openWarrantyInfo, setOpenWarrantyInfo] = useState<string | null>(null)

  const devices = cart.filter(item => item.type === 'product')
  const accessories = cart.filter(item => item.type === 'accessory')

  const handleSelectWarranty = (deviceId: string, pkgCode: string | null) => {
    setSelectedWarranties(prev => ({ ...prev, [deviceId]: pkgCode }))
  }

  const eligibleItems = cart.filter(i => isWarrantyEligible(i))

  return (
    <div className="flex-1 overflow-y-auto space-y-6 pr-1">
      {/* Apply all warranty logic */}
      {eligibleItems.length > 1 && warrantyPackages.length > 0 && (
        <div className="flex items-center gap-3 border rounded-xl p-3 bg-blue-50/50 border-blue-100 shadow-sm">
          <div className="bg-blue-600 p-1.5 rounded-lg">
            <ShieldCheck className="h-4 w-4 text-white" />
          </div>
          <div className="flex-1 flex flex-wrap items-center gap-3">
            <span className="text-xs font-medium text-blue-900">Áp gói bảo hành nhanh:</span>
            <select
              className="text-xs border rounded-lg px-2 py-1.5 bg-white shadow-sm focus:ring-2 focus:ring-blue-500 outline-none"
              defaultValue=""
              onChange={e => {
                const code = e.target.value || null
                setSelectedWarranties(prev => {
                  const next = { ...prev }
                  eligibleItems.forEach(it => {
                    const key = (it.imei || it.serial || it.id) as string
                    if (key) next[key] = code
                  })
                  return next
                })
              }}
            >
              <option value="">Chọn cho tất cả máy...</option>
              {warrantyPackages.map(p => (
                <option key={p.code} value={p.code}>{p.code} - {p.price.toLocaleString()}đ</option>
              ))}
            </select>
            <button
              type="button"
              className="text-[11px] text-red-600 hover:text-red-700 font-medium underline-offset-2 hover:underline"
              onClick={() => setSelectedWarranties(prev => {
                const next = { ...prev }
                eligibleItems.forEach(it => {
                  const key = (it.imei || it.serial || it.id) as string
                  if (key) next[key] = null
                })
                return next
              })}
            >Xoá tất cả</button>
          </div>
        </div>
      )}

      {/* Group 1: Devices */}
      {devices.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 px-1">
            <Smartphone className="h-4 w-4 text-slate-500" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">Danh sách máy ({devices.length})</h3>
          </div>
          <div className="space-y-3">
            {devices.map(item => (
              <CartItemRow
                key={`${item.type}-${item.id}`}
                item={item}
                cart={cart}
                setCart={setCart}
                selectedWarranties={selectedWarranties}
                setSelectedWarranties={setSelectedWarranties}
                warrantyPackages={warrantyPackages}
                isWarrantyEligible={isWarrantyEligible}
                handleSelectWarranty={handleSelectWarranty}
                openWarrantyInfo={openWarrantyInfo}
                setOpenWarrantyInfo={setOpenWarrantyInfo}
                updateQuantity={updateQuantity}
                removeFromCart={removeFromCart}
              />
            ))}
          </div>
        </div>
      )}

      {/* Group 2: Accessories */}
      {accessories.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 px-1">
            <Package className="h-4 w-4 text-slate-500" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">Phụ kiện ({accessories.length})</h3>
          </div>
          <div className="space-y-3">
            {accessories.map(item => (
              <CartItemRow
                key={`${item.type}-${item.id}`}
                item={item}
                cart={cart}
                setCart={setCart}
                selectedWarranties={selectedWarranties}
                setSelectedWarranties={setSelectedWarranties}
                warrantyPackages={warrantyPackages}
                isWarrantyEligible={isWarrantyEligible}
                handleSelectWarranty={handleSelectWarranty}
                openWarrantyInfo={openWarrantyInfo}
                setOpenWarrantyInfo={setOpenWarrantyInfo}
                updateQuantity={updateQuantity}
                removeFromCart={removeFromCart}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
