"use client"

import { useMemo, useState } from "react"
import { CartItem, WarrantyPackageUI } from "@/lib/types/ban-hang"
import { CartItemRow } from "./cart-item"
import { Smartphone, Package, ShieldCheck, PlusCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  ACCESSORY_BROWSE_CATEGORIES,
  addAccessoryUnit,
  accessoryQtyInCart,
  groupAccessoriesByCategory,
  groupAccessoriesForBrowse,
  type AccessoryBrowseCategory,
} from "@/lib/ban-hang/quick-accessories"

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
  accessoryProducts?: any[]
  isManager?: boolean
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
  setEditingPriceId,
  accessoryProducts = [],
  isManager = false
}: CartItemListProps) {
  const [openWarrantyInfo, setOpenWarrantyInfo] = useState<string | null>(null)
  const [selectedAccessoryByCategory, setSelectedAccessoryByCategory] = useState<Record<AccessoryBrowseCategory, string>>({
    cuong_luc: "",
    op_lung: "",
    sac_cap: "",
    sim_ghep: "",
    khac: "",
  })

  const accessoriesByCategory = useMemo(
    () => groupAccessoriesByCategory(accessoryProducts),
    [accessoryProducts]
  )
  const accessoryBrowseGroups = useMemo(
    () => groupAccessoriesForBrowse(accessoryProducts),
    [accessoryProducts]
  )

  const devices = cart.filter(item => item.type === 'product')
  const accessories = cart.filter(item => item.type === 'accessory')

  const handleSelectWarranty = (deviceId: string, pkgCode: string | null) => {
    setSelectedWarranties(prev => ({ ...prev, [deviceId]: pkgCode }))
  }

  const handleAddAccessory = (category: AccessoryBrowseCategory) => {
    const selectedId = selectedAccessoryByCategory[category]
    const options = (accessoryBrowseGroups[category] || [])
      .filter((item) => item.so_luong_ton - accessoryQtyInCart(cart, item.id) > 0)
    const prod = options.find((item) => item.id === selectedId) || options[0]
    if (!prod) return
    setCart((prev) => addAccessoryUnit(prev, prod))
  }

  const eligibleItems = cart.filter(i => isWarrantyEligible(i))

  return (
    <div className="flex-1 overflow-y-auto space-y-6 pr-1">
      {accessoryProducts.length > 0 && (
        <div className="space-y-3 rounded-xl border p-3 shadow-sm bg-amber-50/50 border-amber-200 dark:bg-amber-500/10 dark:border-amber-500/20">
          <div className="flex items-center gap-2">
            <Package className="h-4 w-4 text-amber-700 dark:text-amber-300" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-amber-800 dark:text-amber-200">Chọn nhanh phụ kiện</h3>
          </div>
          <div className="grid grid-cols-1 gap-2 xl:grid-cols-2">
            {ACCESSORY_BROWSE_CATEGORIES.map((category) => {
              const options = (accessoryBrowseGroups[category.key] || [])
                .filter((item) => item.so_luong_ton - accessoryQtyInCart(cart, item.id) > 0)
                .sort((a, b) => {
                  if (a.ten_san_pham === b.ten_san_pham) return a.gia_ban - b.gia_ban
                  return a.ten_san_pham.localeCompare(b.ten_san_pham, "vi", { sensitivity: "base" })
                })

              if (options.length === 0) return null

              const selectedId = selectedAccessoryByCategory[category.key] || options[0]?.id || ""
              const selectedProduct = options.find((item) => item.id === selectedId) || options[0]
              const remaining = selectedProduct ? Math.max(0, selectedProduct.so_luong_ton - accessoryQtyInCart(cart, selectedProduct.id)) : 0

              return (
                <div key={category.key} className="rounded-lg border bg-background/90 p-2.5">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <span className="text-xs font-medium">{category.label}</span>
                    <span className={`text-[11px] tabular-nums ${remaining > 0 ? 'text-muted-foreground' : 'text-red-500'}`}>
                      Tồn {remaining}
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <select
                      className="h-9 flex-1 rounded-md border bg-card px-2 text-xs"
                      value={selectedId}
                      onChange={(e) => {
                        const nextId = e.target.value
                        setSelectedAccessoryByCategory((prev) => ({ ...prev, [category.key]: nextId }))
                      }}
                    >
                      {options.map((item) => {
                        const stock = Math.max(0, item.so_luong_ton - accessoryQtyInCart(cart, item.id))
                        return (
                          <option key={item.id} value={item.id}>
                            {item.ten_san_pham} • ₫{item.gia_ban.toLocaleString("vi-VN")} • còn {stock}
                          </option>
                        )
                      })}
                    </select>
                    <Button
                      type="button"
                      size="sm"
                      className="shrink-0"
                      onClick={() => handleAddAccessory(category.key)}
                    >
                      <PlusCircle className="mr-1 h-4 w-4" />
                      Thêm
                    </Button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Apply all warranty logic */}
      {eligibleItems.length > 1 && warrantyPackages.length > 0 && (
        <div className="flex items-center gap-3 border rounded-xl p-3 shadow-sm bg-blue-50/60 border-blue-200 dark:bg-blue-500/10 dark:border-blue-500/30">
          <div className="bg-blue-600 p-1.5 rounded-lg shrink-0">
            <ShieldCheck className="h-4 w-4 text-white" />
          </div>
          <div className="flex-1 flex flex-wrap items-center gap-3">
            <span className="text-xs font-medium text-blue-900 dark:text-blue-200">Áp gói bảo hành nhanh:</span>
            <select
              className="text-xs border rounded-lg px-2 py-1.5 bg-background text-foreground border-input shadow-sm focus:ring-2 focus:ring-ring outline-none"
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
              className="text-[11px] text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 font-medium underline-offset-2 hover:underline"
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
            <Smartphone className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Danh sách máy ({devices.length})</h3>
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
                accessoriesByCategory={accessoriesByCategory}
                isManager={isManager}
              />
            ))}
          </div>
        </div>
      )}

      {/* Group 2: Accessories */}
      {accessories.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 px-1">
            <Package className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Phụ kiện ({accessories.length})</h3>
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
                isManager={isManager}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
