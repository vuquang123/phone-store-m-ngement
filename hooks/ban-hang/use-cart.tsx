"use client"
// Hook giỏ hàng + chọn gói bảo hành — tách verbatim từ app/dashboard/ban-hang/page.tsx.
// Refactor thuần: GIỮ NGUYÊN hành vi (load/persist localStorage, mutators, chọn bảo hành).
import { useState, useEffect, useRef } from "react"
import type { CartItem, WarrantyPackageUI } from "@/lib/types/ban-hang"

interface UseCartDeps {
  // Truyền vào từ component để tránh phụ thuộc chéo concern khác (toast/search/tab)
  toast: (props: any) => void
  setSearchQuery: (v: string) => void
  setActiveTab: (v: string) => void
}

export function useCart({ toast, setSearchQuery, setActiveTab }: UseCartDeps) {
  const [cart, setCart] = useState<CartItem[]>([])
  /* ===== Warranty state ===== */
  const [warrantyPackages, setWarrantyPackages] = useState<WarrantyPackageUI[]>([])
  const [warrantyPkgLoading, setWarrantyPkgLoading] = useState(false)
  const [selectedWarranties, setSelectedWarranties] = useState<Record<string,string|null>>({}) // deviceId (IMEI/Serial) -> packageCode
  const isCartLoaded = useRef(false)
  const isWarrantyLoaded = useRef(false)

  useEffect(() => {
    try {
      const raw = localStorage.getItem('cart_draft_v1')
      if (raw) {
        const parsed = JSON.parse(raw)
        if (Array.isArray(parsed)) setCart(parsed)
      }
    } catch {}
    isCartLoaded.current = true

    try {
      const sel = localStorage.getItem('cart_warranty_sel_v1')
      if (sel) {
        const parsedSel = JSON.parse(sel)
        if (parsedSel && typeof parsedSel === 'object') setSelectedWarranties(parsedSel)
      }
    } catch {}
    isWarrantyLoaded.current = true

    const loadWarrantyPkgs = async () => {
      try {
        setWarrantyPkgLoading(true)
        const res = await fetch('/api/warranties/packages')
        if (!res.ok) throw new Error('Fetch warranty packages failed')
        const data = await res.json()
        setWarrantyPackages(Array.isArray(data.data) ? data.data : [])
      } catch (e) {
        console.warn('[WARRANTY] Load packages fail', e)
        setWarrantyPackages([])
      } finally {
        setWarrantyPkgLoading(false)
      }
    }
    loadWarrantyPkgs()
  }, [])

  function handleSelectWarranty(deviceId: string, pkgCode: string | null) {
    setSelectedWarranties(prev => ({ ...prev, [deviceId]: pkgCode }))
  }
  // Persist cart & selections (9.3)
  useEffect(()=>{
    if (!isCartLoaded.current) return
    try { localStorage.setItem('cart_draft_v1', JSON.stringify(cart)) } catch{}
  }, [cart])

  useEffect(()=>{
    if (!isWarrantyLoaded.current) return
    try { localStorage.setItem('cart_warranty_sel_v1', JSON.stringify(selectedWarranties)) } catch{}
  }, [selectedWarranties])

  // === CART ===
  const addToCart = (product: any) => {
    const prevCart = cart
    let nextCart = prevCart
    let didChange = false
    if (product.type === "accessory") {
      const accessoryId = product.id || `${product.ten_san_pham}_${product.loai_may || ""}`
      const existingItem = prevCart.find((item) => item.type === "accessory" && item.id === accessoryId)
      let giaNhap = 0
      if (typeof product.gia_nhap === "number") giaNhap = product.gia_nhap
      else if (typeof product["Giá Nhập"] === "number") giaNhap = product["Giá Nhập"]
      else if (typeof product.gia_nhap === "string") giaNhap = parseInt(product.gia_nhap.replace(/[^\d]/g, "")) || 0
      else if (typeof product["Giá Nhập"] === "string") giaNhap = parseInt(product["Giá Nhập"].replace(/[^\d]/g, "")) || 0
      if (existingItem) {
        const maxQty = product.so_luong_ton || 1
        if (existingItem.so_luong < maxQty) {
          nextCart = prevCart.map((item) => item.id === accessoryId ? { ...item, so_luong: item.so_luong + 1 } : item)
          didChange = true
        }
      } else {
        nextCart = [
          ...prevCart,
          {
            id: accessoryId,
            type: "accessory",
            ten_san_pham: product.ten_san_pham,
            gia_niemyet: Number(product.gia_ban) || 0,
            gia_ban: Number(product.gia_ban) || 0,
            gia_nhap: giaNhap,
            so_luong: 1,
            max_quantity: product.so_luong_ton || 1,
            imei: product.imei || "",
            trang_thai: product.trang_thai || "",
            // preserve accessory descriptors for cart display
            loai_phu_kien: product.loai_phu_kien || product.loai || "",
            mau_sac: product.mau_sac || product.mau || ""
          }
        ]
        didChange = true
      }
    } else {
      const exists = prevCart.find((item) => item.id === product.id && item.type === "product")
      if (!exists) {
        const isPartner = String(product.nguon || product.source || '').toLowerCase().includes('kho ngoài')
        nextCart = [
          ...prevCart,
          {
            ...product,
            type: "product",
            so_luong: 1,
            max_quantity: 1,
            // Track initial IMEI state for partner items to skip extra confirmation if it already existed
            imei_initial: product.imei || '',
            imei_confirmed: isPartner && product.imei ? true : (product as any).imei_confirmed,
            "Tên Sản Phẩm": product.ten_san_pham,
            "Loại Máy": product.loai_may,
            "Dung Lượng": product.dung_luong,
            "IMEI": product.imei,
            "Màu Sắc": product.mau_sac,
            "Pin (%)": product.pin,
            "Tình Trạng Máy": product.tinh_trang,
            gia_niemyet: Number(product.gia_ban) || 0,
            gia_ban: (Number(product.gia_ban) || 0) - (Number(product.giam_gia) || 0)
          }
        ]
        didChange = true
      }
    }
    if (didChange) {
      setCart(nextCart)
      try {
        toast({
          title: "Đã thêm vào giỏ",
          description: product.ten_san_pham || product.imei || product.serial || "Sản phẩm",
          action: (
            <button
              onClick={() => setCart(prevCart)}
              className="inline-flex h-8 items-center justify-center rounded-md border px-3 text-sm font-medium hover:bg-secondary"
            >
              Hoàn tác
            </button>
          ) as any,
        })
      } catch {}
    }
    setSearchQuery("")
  }

  // Thêm máy kho ngoài vào giỏ từ dialog
  function addPartnerItemToCart(p: any) {
    const id = p.imei || p.id
    const exists = cart.find((it) => it.type === 'product' && (it.imei === p.imei || it.id === id))
    if (exists) return
    const item: CartItem = {
      id,
      type: 'product',
      ten_san_pham: p.model || p.ten_san_pham || '',
      gia_niemyet: typeof p.gia_goi_y_ban === 'number' && p.gia_goi_y_ban > 0 ? p.gia_goi_y_ban : 0,
      gia_ban: typeof p.gia_goi_y_ban === 'number' && p.gia_goi_y_ban > 0 ? p.gia_goi_y_ban : 0,
      gia_nhap: typeof p.gia_chuyen === 'number' ? p.gia_chuyen : 0,
      so_luong: 1,
      max_quantity: 1,
      imei: p.imei || '',
      imei_initial: p.imei || '',
      imei_confirmed: (p.imei ? true : false) as any,
      trang_thai: 'Còn hàng',
      loai_may: p.loai_may || '',
      dung_luong: p.bo_nho || p.dung_luong || '',
      mau_sac: p.mau || '',
      pin: p.pin_pct || p.pin || '',
      tinh_trang: p.tinh_trang || '',
      // Metadata cho API ban-hang xử lý xóa dòng kho ngoài
      source: 'Kho ngoài',
      nguon: 'Kho ngoài',
      partner_sheet: p.sheet,
      partner_row_index: p.row_index,
      ten_doi_tac: p.ten_doi_tac || '',
      sdt_doi_tac: p.sdt_doi_tac || ''
    }
    setCart(prev => [...prev, item])
    setActiveTab('ban-hang')
  }

  const updateQuantity = (id: string, type: string, newQty: number) => {
    if (newQty <= 0) {
      removeFromCart(id, type)
      return
    }
    setCart(cart.map((item) =>
      item.id === id && item.type === type
        ? { ...item, so_luong: Math.min(newQty, item.max_quantity || 1) }
        : item
    ))
  }

  const removeFromCart = (id: string, type: string) => {
    setCart(cart.filter((item) => !(item.id === id && item.type === type)))
  }

  return {
    cart, setCart,
    addToCart, addPartnerItemToCart, updateQuantity, removeFromCart,
    warrantyPackages, warrantyPkgLoading,
    selectedWarranties, setSelectedWarranties, handleSelectWarranty,
  }
}
