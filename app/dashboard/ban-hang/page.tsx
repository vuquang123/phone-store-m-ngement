"use client"

import { useState, useEffect, useRef } from "react"
import { ProtectedRoute } from "@/components/auth/protected-route"
import { CustomerDialog } from "@/components/ban-hang/customer-dialog"
import { CustomerSelectDialog } from "@/components/ban-hang/customer-select-dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Search, Plus, Minus, Trash2, User, ShoppingCart, Loader2, Pencil, Check, X } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import dayjs from "dayjs"
import customParseFormat from "dayjs/plugin/customParseFormat"
dayjs.extend(customParseFormat)
import { useIsMobile } from "@/hooks/use-mobile"

interface CartItem {
  id: string
  type: "product" | "accessory"
  ten_san_pham: string
  gia_ban: number
  so_luong: number
  max_quantity?: number
  imei?: string
  trang_thai?: string
  [key: string]: any
}

interface WarrantyPackageUI {
  code: string
  name: string
  price: number
  exchangeDays: number
  hwMonths: number
  cncMonths: number
  lifetime: boolean
  notes?: string
  active?: boolean
}

interface Customer {
  id: string
  ho_ten: string
  so_dien_thoai: string
}

export default function BanHangPage() {
  const { toast } = useToast()
  const isMobile = useIsMobile()
  const [mobileView, setMobileView] = useState<"san-pham" | "gio-hang" | "thanh-toan">("san-pham")
  // Bộ lọc nhanh cho mobile-first
  const [filterSource, setFilterSource] = useState<"all" | "inhouse" | "partner">("all")
  const [filterType, setFilterType] = useState<"all" | "iphone" | "accessory">("all")
  // Lấy employeeId từ API /me và lưu vào localStorage
  useEffect(() => {
    async function fetchEmployeeId() {
      try {
        const res = await fetch("/api/auth/me", { headers: { "x-user-email": localStorage.getItem("user_email") || "" } })
        if (res.ok) {
          const data = await res.json()
          if (data.employeeId) {
            localStorage.setItem("employeeId", data.employeeId)
          }
        }
      } catch {}
    }
    fetchEmployeeId()
  }, [])
  // State cho đơn đặt cọc
  const [depositOrdersState, setDepositOrders] = useState<any[]>([])
  const [depositLoading, setDepositLoading] = useState(false)
  const [depositSearch, setDepositSearch] = useState("")
  const [activeTab, setActiveTab] = useState("ban-hang")
  const [reloadFlag, setReloadFlag] = useState(0)
  // Fetch đơn đặt cọc từ API khi vào tab hoặc khi tạo mới
  useEffect(() => {
    if (activeTab !== "don-dat-coc") return;
    const fetchDepositOrders = async () => {
      try {
        setDepositLoading(true)
        const res = await fetch("/api/dat-coc")
        if (res.ok) {
          const data = await res.json()
          // Chuyển đổi dữ liệu từ header + rows thành mảng object
          const header = data?.data?.header || [];
          const rows = data?.data?.rows || [];
          const orders = rows.map((row: any[]) => {
            const obj: Record<string, any> = {};
            header.forEach((key: string, idx: number) => {
              obj[key] = row[idx];
            });
            return obj;
          });
          setDepositOrders(orders);
        } else {
          setDepositOrders([]);
        }
      } catch {
        setDepositOrders([]);
      } finally {
        setDepositLoading(false)
      }
    };
    fetchDepositOrders();
  }, [activeTab, reloadFlag]);
  // State to hold kho hàng products
  const [khoHangProducts, setKhoHangProducts] = useState<any[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  const [searchResults, setSearchResults] = useState<any[]>([])
  const [cart, setCart] = useState<CartItem[]>([])
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)
  const [giamGia, setGiamGia] = useState(0)
  const [phuongThucThanhToan, setPhuongThucThanhToan] = useState("Tiền mặt")
  const [loaiDon, setLoaiDon] = useState("")
  const [hinhThucVanChuyen, setHinhThucVanChuyen] = useState("")
  const [ghiChu, setGhiChu] = useState("")
  // Discount input string (5.2)
  const [giamGiaInput, setGiamGiaInput] = useState("")
  const [discountParseMsg, setDiscountParseMsg] = useState<string>("")
  const [isLoading, setIsLoading] = useState(false)
  const [isCustomerDialogOpen, setIsCustomerDialogOpen] = useState(false)
  const [isCustomerSelectOpen, setIsCustomerSelectOpen] = useState(false)
  const [orders, setOrders] = useState<any[]>([])
  const [customerSearch, setCustomerSearch] = useState("")
  const [customerResults, setCustomerResults] = useState<any[]>([])
  // Máy đối tác cache để lọc nhanh trong tìm kiếm
  const [partnerProducts, setPartnerProducts] = useState<any[]>([])
  // Cache phụ kiện để tránh gọi API lặp khi query ngắn
  const [accessoryProducts, setAccessoryProducts] = useState<any[]>([])
  // Hàm reload danh sách khách hàng
  const reloadCustomers = () => {
    if (!customerSearch) { setCustomerResults([]); return }
    fetch(`/api/khach-hang?search=${encodeURIComponent(customerSearch)}`)
      .then(res => res.json())
      .then(data => {
        const results = Array.isArray(data.data)
          ? data.data.map((kh: any) => ({ ...kh, isDeposit: kh.trang_thai === "Đặt cọc" }))
          : []
        setCustomerResults(results)
      })
      .catch(() => setCustomerResults([]))
  }
  const [loaiThanhToan, setLoaiThanhToan] = useState("Thanh toán đủ")
  const [soTienCoc, setSoTienCoc] = useState(0)
  const [ngayHenTraDu, setNgayHenTraDu] = useState("")
  /* ===== Warranty state ===== */
  const [warrantyPackages, setWarrantyPackages] = useState<WarrantyPackageUI[]>([])
  const [warrantyPkgLoading, setWarrantyPkgLoading] = useState(false)
  const [selectedWarranties, setSelectedWarranties] = useState<Record<string,string|null>>({}) // imei -> packageCode
  const [openWarrantyInfo, setOpenWarrantyInfo] = useState<string|null>(null)
  // Inline edit price (3.1)
  const [editingPriceId, setEditingPriceId] = useState<string|null>(null)
  const editPriceRef = useRef<HTMLInputElement|null>(null)
  // Abort previous search requests when user keeps typing
  const searchAbortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    // Khôi phục draft giỏ & bảo hành (9.3)
    try {
      const raw = localStorage.getItem('cart_draft_v1')
      if (raw) {
        const parsed = JSON.parse(raw)
        if (Array.isArray(parsed)) setCart(parsed)
      }
      const sel = localStorage.getItem('cart_warranty_sel_v1')
      if (sel) {
        const parsedSel = JSON.parse(sel)
        if (parsedSel && typeof parsedSel === 'object') setSelectedWarranties(parsedSel)
      }
    } catch {}
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

  function handleSelectWarranty(imei: string, pkgCode: string | null) {
    setSelectedWarranties(prev => ({ ...prev, [imei]: pkgCode }))
  }
  // Persist cart & selections (9.3)
  useEffect(()=>{ try { localStorage.setItem('cart_draft_v1', JSON.stringify(cart)) } catch{} }, [cart])
  useEffect(()=>{ try { localStorage.setItem('cart_warranty_sel_v1', JSON.stringify(selectedWarranties)) } catch{} }, [selectedWarranties])

  // ===== Discount parser (5.2) =====
  function parseDiscount(raw: string, base: number): number {
    const s = raw.trim().toLowerCase()
    if (!s) return 0
    if (/^\d+(\.\d+)?%$/.test(s)) {
      const pct = parseFloat(s.replace('%',''))
      return Math.min(Math.round(base * pct / 100), base)
    }
    if (/^\d+(\.\d+)?k$/.test(s)) {
      return Math.min(Math.round(parseFloat(s.replace('k','')) * 1000), base)
    }
    if (/^\d+(\.\d+)?m$/.test(s)) {
      return Math.min(Math.round(parseFloat(s.replace('m','')) * 1_000_000), base)
    }
    const num = parseInt(s.replace(/[^\d]/g,''),10)
    if (!Number.isFinite(num)) return 0
    return Math.min(num, base)
  }

  function handleDiscountInput(v: string){
    setGiamGiaInput(v)
    setDiscountParseMsg('')
  }
  function commitDiscount(){
    const parsed = parseDiscount(giamGiaInput, discountBase)
    setGiamGia(parsed)
    setGiamGiaInput(parsed ? `${parsed.toLocaleString('vi-VN')}đ` : "")
  }
  function applyQuickDiscount(tag: string){
    const parsed = parseDiscount(tag, discountBase)
    setGiamGia(parsed)
    setGiamGiaInput(parsed ? `${parsed.toLocaleString('vi-VN')}đ` : '')
    setDiscountParseMsg('')
  }

  // === SEARCH SẢN PHẨM (dựa trên cache + server search khi query >= 2) ===
  useEffect(() => {
    const run = async () => {
      const q = searchQuery.trim()
      if (q.length < 2) {
        // Không gọi API khi query ngắn – dùng dữ liệu cache
        setSearchResults([
          ...khoHangProducts,
          ...partnerProducts,
          ...accessoryProducts,
        ])
        return
      }
      try {
        // Huỷ request trước đó nếu còn đang chạy
        if (searchAbortRef.current) searchAbortRef.current.abort()
        const controller = new AbortController()
        searchAbortRef.current = controller
        const response = await fetch(`/api/search-products?search=${encodeURIComponent(q)}`,
          { signal: controller.signal })
        let results: any[] = []
        if (response.ok) results = await response.json()

        const qLower = q.toLowerCase()
        const filteredKho = khoHangProducts.filter((item) => (
          item.ten_san_pham?.toLowerCase().includes(qLower) ||
          item.imei?.toLowerCase().includes(qLower) ||
          (item.loai_phu_kien?.toLowerCase().includes(qLower) ?? false)
        ))
        const filteredPartner = partnerProducts.filter((item) => (
          item.ten_san_pham?.toLowerCase().includes(qLower) ||
          item.imei?.toLowerCase().includes(qLower) ||
          item.loai_may?.toLowerCase().includes(qLower) ||
          item.dung_luong?.toLowerCase().includes(qLower) ||
          item.mau_sac?.toLowerCase().includes(qLower)
        ))
        const filteredAccessories = accessoryProducts.filter((item) => (
          item.ten_san_pham?.toLowerCase().includes(qLower) ||
          (item.loai_phu_kien?.toLowerCase().includes(qLower) ?? false)
        ))

        const allProducts = [...results, ...filteredKho, ...filteredPartner, ...filteredAccessories]
          .reduce((acc: any[], item: any) => {
            if (!acc.some((p: any) => p.id === item.id)) {
              if (!item.type && item.imei) item.type = 'product'
              acc.push(item)
            }
            return acc
          }, [])
        setSearchResults(allProducts)
      } catch (error: any) {
        if (error?.name !== 'AbortError') {
          console.error('Error searching products:', error)
        }
      }
    }
    const debounce = setTimeout(run, 300)
    return () => clearTimeout(debounce)
  }, [searchQuery, khoHangProducts, partnerProducts, accessoryProducts])

  // Fetch cache (kho hàng, phụ kiện, đối tác) khi vào trang hoặc sau khi reloadFlag thay đổi
  useEffect(() => {
    let alive = true
    const fetchCaches = async () => {
      try {
        const [resKho, resPhuKien, resPartner] = await Promise.all([
          fetch('/api/kho-hang'),
          fetch('/api/phu-kien'),
          fetch('/api/doi-tac/hang-order')
        ])

        // Kho hàng
        let mappedKho: any[] = []
        if (resKho.ok) {
          const data = await resKho.json()
          const products = Array.isArray(data) ? data : data.data || []
          mappedKho = products
            .filter((p: any) => p.trang_thai === 'Còn hàng')
            .map((p: any) => ({
              ...p,
              id: p['ID Máy'] || p.id_may || p.id,
              type: 'product',
              gia_nhap: p.gia_nhap ?? p['Giá Nhập'] ?? '',
              'Tên Sản Phẩm': p.ten_san_pham,
              'Loại Máy': p.loai_may,
              'Dung Lượng': p.dung_luong,
              'IMEI': p.imei,
              'Màu Sắc': p.mau_sac,
              'Pin (%)': p.pin,
              'Tình Trạng Máy': p.tinh_trang_may
            }))
        }

        // Phụ kiện
        let mappedAccessories: any[] = []
        if (resPhuKien.ok) {
          const data = await resPhuKien.json()
          let accessories = Array.isArray(data) ? data : data.data || []
          accessories = accessories.filter((a: any) => Number(a.so_luong_ton) > 0)
          mappedAccessories = accessories.map((a: any) => {
            let price = 0
            if (typeof a.gia_ban === 'string') {
              const cleaned = a.gia_ban.replace(/[^\d]/g, '')
              price = cleaned ? parseInt(cleaned, 10) : 0
            } else if (typeof a.gia_ban === 'number') {
              price = a.gia_ban
            }
            return { ...a, type: 'accessory', ten_san_pham: a.ten_san_pham || a.ten_phu_kien || '', gia_ban: price }
          })
        }

        // Đối tác
        let mappedPartner: any[] = []
        if (resPartner.ok) {
          const data = await resPartner.json()
          const items = Array.isArray(data?.items) ? data.items : []
          mappedPartner = items.map((p: any) => ({
            id: p.imei || p.id,
            type: 'product',
            ten_san_pham: p.model || '',
            gia_ban: typeof p.gia_goi_y_ban === 'number' ? p.gia_goi_y_ban : 0,
            gia_nhap: typeof p.gia_chuyen === 'number' ? p.gia_chuyen : 0,
            so_luong: 1,
            max_quantity: 1,
            imei: p.imei || '',
            trang_thai: 'Còn hàng',
            loai_may: p.loai_may || '',
            dung_luong: p.bo_nho || '',
            mau_sac: p.mau || '',
            pin: p.pin_pct || '',
            tinh_trang: p.tinh_trang || '',
            source: 'Đối tác',
            nguon: 'Đối tác',
            partner_sheet: p.sheet,
            partner_row_index: p.row_index,
            ten_doi_tac: p.ten_doi_tac || '',
            sdt_doi_tac: p.sdt_doi_tac || ''
          }))
        }

        if (!alive) return
        setKhoHangProducts(mappedKho)
        setAccessoryProducts(mappedAccessories)
        setPartnerProducts(mappedPartner)

        // Nếu đang không search, cập nhật ngay list hiển thị để người dùng thấy dữ liệu mới
        if (searchQuery.trim().length < 2) {
          setSearchResults([...mappedKho, ...mappedPartner, ...mappedAccessories])
        }
      } catch (e) {
        if (!alive) return
        setKhoHangProducts([])
        setAccessoryProducts([])
        setPartnerProducts([])
        if (searchQuery.trim().length < 2) setSearchResults([])
      }
    }
    fetchCaches()
    return () => { alive = false }
  }, [reloadFlag])

  // === CART ===
  const addToCart = (product: any) => {
  console.log('Thêm vào giỏ:', product)
    if (product.type === "accessory") {
      let accessoryId = product.id || `${product.ten_san_pham}_${product.loai_may || ""}`
      const existingItem = cart.find((item) => item.type === "accessory" && item.id === accessoryId)
      // Lấy giá nhập từ product (ưu tiên product.gia_nhap, nếu không có thì product['Giá Nhập'], nếu không có thì 0)
      let giaNhap = 0;
      if (typeof product.gia_nhap === "number") giaNhap = product.gia_nhap;
      else if (typeof product["Giá Nhập"] === "number") giaNhap = product["Giá Nhập"];
      else if (typeof product.gia_nhap === "string") giaNhap = parseInt(product.gia_nhap.replace(/[^\d]/g, "")) || 0;
      else if (typeof product["Giá Nhập"] === "string") giaNhap = parseInt(product["Giá Nhập"].replace(/[^\d]/g, "")) || 0;
      if (existingItem) {
        const maxQty = product.so_luong_ton || 1
        if (existingItem.so_luong < maxQty) {
          setCart(cart.map((item) =>
            item.id === accessoryId ? { ...item, so_luong: item.so_luong + 1 } : item
          ))
        }
      } else {
        setCart([...cart, {
          id: accessoryId,
          type: "accessory",
          ten_san_pham: product.ten_san_pham,
          gia_ban: product.gia_ban,
          gia_nhap: giaNhap,
          so_luong: 1,
          max_quantity: product.so_luong_ton || 1,
          imei: product.imei || "",
          trang_thai: product.trang_thai || ""
        }])
      }
    } else {
      const exists = cart.find((item) => item.id === product.id && item.type === "product")
      if (!exists) {
        setCart([
          ...cart,
          {
            ...product,
            type: "product", // luôn gán type
            so_luong: 1,
            max_quantity: 1,
            // Mapping đúng tên cột sheet:
            "Tên Sản Phẩm": product.ten_san_pham,
            "Loại Máy": product.loai_may,
            "Dung Lượng": product.dung_luong,
            "IMEI": product.imei,
            "Màu Sắc": product.mau_sac,
            "Pin (%)": product.pin,
            "Tình Trạng Máy": product.tinh_trang
          }
        ])
      }
    }
    setSearchQuery("")
  }

  // Thêm máy đối tác vào giỏ từ dialog
  function addPartnerItemToCart(p: any) {
    const id = p.imei || p.id
    const exists = cart.find((it) => it.type === 'product' && (it.imei === p.imei || it.id === id))
    if (exists) return
    const item: CartItem = {
      id,
      type: 'product',
      ten_san_pham: p.model || p.ten_san_pham || '',
      gia_ban: typeof p.gia_goi_y_ban === 'number' && p.gia_goi_y_ban > 0 ? p.gia_goi_y_ban : 0,
      gia_nhap: typeof p.gia_chuyen === 'number' ? p.gia_chuyen : 0,
      so_luong: 1,
      max_quantity: 1,
      imei: p.imei || '',
      trang_thai: 'Còn hàng',
      loai_may: p.loai_may || '',
      dung_luong: p.bo_nho || p.dung_luong || '',
      mau_sac: p.mau || '',
      pin: p.pin_pct || p.pin || '',
      tinh_trang: p.tinh_trang || '',
      // Metadata cho API ban-hang xử lý xóa dòng đối tác
      source: 'Đối tác',
      nguon: 'Đối tác',
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

  // === CHECKOUT ===
  const tongTien = cart.reduce((sum, item) => sum + item.gia_ban * item.so_luong, 0)
  const thanhToan = tongTien - giamGia // (chưa cộng phí bảo hành)
  const warrantyTotal = cart
    .filter(i => i.type==='product' && i.imei && selectedWarranties[i.imei])
    .reduce((sum, i) => {
      const pkg = warrantyPackages.find(p => p.code === selectedWarranties[i.imei!])
      return sum + (pkg?.price || 0)
    }, 0)
  // Cơ sở tính giảm giá: tổng tiền hàng + phí bảo hành trước giảm
  const discountBase = Math.max(tongTien + warrantyTotal, 0)
  const finalThanhToan = Math.max(tongTien + warrantyTotal - giamGia, 0)

  // ===== Confirm rời trang khi giỏ chưa thanh toán =====
  const hasPendingCart = cart.length > 0
  useEffect(() => {
    const confirmMsg = 'Giỏ hàng chưa thanh toán. Bạn có chắc muốn rời trang?'
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!hasPendingCart) return
      e.preventDefault()
      e.returnValue = ''
    }
    const onDocumentClick = (e: MouseEvent) => {
      if (!hasPendingCart) return
      const target = e.target as HTMLElement | null
      if (!target) return
      const a = target.closest('a') as HTMLAnchorElement | null
      if (!a) return
      // Bỏ qua mở tab mới / modifier keys / anchor hash
      if (a.target === '_blank' || e.defaultPrevented || (e as any).metaKey || (e as any).ctrlKey || (e as any).shiftKey || (e as any).altKey) return
      const href = a.getAttribute('href') || ''
      if (!href || href.startsWith('#')) return
      const ok = window.confirm(confirmMsg)
      if (!ok) {
        e.preventDefault()
      }
    }
    const onPopState = () => {
      if (!hasPendingCart) return
      const ok = window.confirm(confirmMsg)
      if (!ok) {
        // Quay lại trạng thái hiện tại
        history.go(1)
      }
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    document.addEventListener('click', onDocumentClick)
    window.addEventListener('popstate', onPopState)
    return () => {
      window.removeEventListener('beforeunload', onBeforeUnload)
      document.removeEventListener('click', onDocumentClick)
      window.removeEventListener('popstate', onPopState)
    }
  }, [hasPendingCart])

  const handleCheckout = async () => {
    if (cart.length === 0) {
      toast({ title: 'Giỏ hàng trống', description: 'Vui lòng thêm sản phẩm trước khi thanh toán.' })
      return
    }
    if (thanhToan < 0) {
      toast({ title: 'Giảm giá không hợp lệ', variant: 'destructive' as any })
      return
    }
    setIsLoading(true)
    try {
      const products = cart.filter((i) => i.type === "product")
      const accessories = cart.filter((i) => i.type === "accessory")
      const giaNhapMay = products[0]?.gia_nhap ? Number(products[0].gia_nhap) : 0;
      const giaNhapPhuKien = accessories.reduce((s, i) => s + (i.gia_nhap || 0) * i.so_luong, 0);
      let employeeId = "";
      if (typeof window !== "undefined") {
        employeeId = localStorage.getItem("employeeId") || "";
      }

      if (loaiThanhToan === "Đặt cọc" || loaiThanhToan === "Thanh toán đủ") {
        // Cập nhật trạng thái sản phẩm thành 'Đã bán'
        try {
          // Chỉ cập nhật trạng thái & xóa khỏi kho cho hàng nội bộ (không phải đối tác)
          const internalImeis = products.filter(p => !String(p.nguon || p.source || '').toLowerCase().includes('đối tác')).map(p => p.imei)
          if (internalImeis.length > 0) {
            const resStatus = await fetch("/api/update-product-status", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ productIds: internalImeis, newStatus: "Đã bán" })
            });
            if (!resStatus.ok) throw new Error("API update-product-status lỗi: " + (await resStatus.text()));
          }
        } catch (err) {
          toast({ title: 'Lỗi cập nhật trạng thái', description: String(err), variant: 'destructive' as any })
          setIsLoading(false); return;
        }
        // Chỉ xóa sản phẩm khỏi kho nếu có sản phẩm có imei
        const internalImeisForDelete = products.filter(p => !String(p.nguon || p.source || '').toLowerCase().includes('đối tác')).map(p => p.imei).filter(Boolean)
        if (internalImeisForDelete.length > 0) {
          try {
            const resDel = await fetch("/api/delete-product-from-kho", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ productIds: internalImeisForDelete })
            });
            if (!resDel.ok) throw new Error("API delete-product-from-kho lỗi: " + (await resDel.text()));
          } catch (err) {
            toast({ title: 'Lỗi xóa sản phẩm khỏi kho', description: String(err), variant: 'destructive' as any })
            setIsLoading(false); return;
          }
        }
        // Ghi thông tin vào sheet Ban_Hang
        let orderData: any = {
          "Ngày Xuất": new Date().toLocaleDateString("vi-VN"),
          "Tên Khách Hàng": selectedCustomer?.ho_ten || "Khách lẻ",
          "Số Điện Thoại": selectedCustomer?.so_dien_thoai || "",
          "Phụ Kiện": accessories.length ? accessories.map(pk => pk.ten_san_pham).join(", ") : "",
          // Giá Bán & Thanh Toan (cốt lõi) chỉ phản ánh tiền hàng sau giảm giá (không gồm bảo hành)
          "Giá Bán": thanhToan,
          "Thanh Toan": thanhToan,
          "Giá Nhập": products.reduce((s, p) => s + (p.gia_nhap || 0), 0) + giaNhapPhuKien,
          "Hình Thức Thanh Toán": phuongThucThanhToan,
          "Người Bán": employeeId,
          "Loại Đơn": loaiDon,
          "Hình Thức Vận Chuyển": loaiDon === "Đơn onl" ? hinhThucVanChuyen : "",
          "Lãi": "", // Để trống, không ghi đè công thức
          "Ghi Chú": ghiChu,
          "Giảm Giá": giamGia,
          products: products.map(p => ({
            id: p.id,
            ten_san_pham: p.ten_san_pham,
            loai_may: p.loai_may,
            dung_luong: p.dung_luong,
            imei: p.imei,
            mau_sac: p.mau_sac,
            pin: p.pin,
            tinh_trang_may: p.tinh_trang,
            gia_ban: p.gia_ban,
            gia_nhap: p.gia_nhap,
            so_luong: p.so_luong,
            // Truyền metadata đối tác để API xử lý xoá dòng bên sheet đối tác
            source: p.source || p.nguon || '',
            nguon: p.nguon || p.source || '',
            partner_sheet: p.partner_sheet || p.sheet || '',
            partner_row_index: p.partner_row_index || p.row_index || '',
            ten_doi_tac: p.ten_doi_tac || '',
            sdt_doi_tac: p.sdt_doi_tac || ''
          })),
          accessories: accessories.map(i => ({
            id: i.id,
            ten_phu_kien: i.ten_san_pham,
            gia_ban: i.gia_ban,
            gia_nhap: i.gia_nhap,
            so_luong: i.so_luong
          }))
        };
        try {
          const res = await fetch("/api/ban-hang", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              ...orderData,
              // Truyền cả nguồn hàng tổng quát nếu có máy đối tác trong giỏ
              nguon_hang: products.some(p => String(p.nguon || p.source || '').toLowerCase().includes('đối tác')) ? 'Đối tác' : '',
              coreTotal: thanhToan,
              warrantyTotal: warrantyTotal,
              finalThanhToan: finalThanhToan,
              warrantySelections: cart
                .filter(i => i.type==='product' && i.imei && selectedWarranties[i.imei])
                .map(i => ({ imei: i.imei, packageCode: selectedWarranties[i.imei!] as string }))
            })
          });
          if (!res.ok) throw new Error("API ban-hang lỗi: " + (await res.text()));
          const order = await res.json();
          setCart([]);
          setSelectedCustomer(null);
          setGiamGia(0);
          setGhiChu("");
          setPhuongThucThanhToan("Tiền mặt");
          toast({ title: 'Tạo đơn thành công', description: `Mã: ${order.id_don_hang || order.ma_don_hang || ''}` })
          try { localStorage.removeItem('cart_draft_v1'); localStorage.removeItem('cart_warranty_sel_v1') } catch{}
          setReloadFlag(f => f + 1); // <--- thêm dòng này
        } catch (err) {
          toast({ title: 'Lỗi tạo đơn hàng', description: String(err), variant: 'destructive' as any })
        }
      }
    } catch (e: any) {
      toast({ title: 'Lỗi', description: e.message, variant: 'destructive' as any })
    } finally {
      setIsLoading(false)
    }
  }

  // === ĐƠN ĐẶT CỌC ===
  const depositOrders = depositOrdersState.length > 0
    ? depositOrdersState
    : orders.filter(
        (o) => o.trang_thai === "Chờ thanh toán đủ" || o.loai_don === "Đặt cọc"
      )

  // Hủy đặt cọc: trả sản phẩm về kho + xóa khỏi sheet đặt cọc
  const [cancelingDepositId, setCancelingDepositId] = useState<string|null>(null)
  const handleCancelDeposit = async (maDon: string) => {
    try {
      setCancelingDepositId(maDon)
      const allRows = depositOrders.filter((o: any) => {
        const m = o["Mã Đơn Hàng"] || o["ID Đơn Hàng"] || o["ma_don_hang"];
        return m === maDon;
      });
      const imeis = allRows.map((o: any) => o["IMEI"] || o["imei"]).filter(Boolean);
      if (imeis.length === 0) {
        toast({ title: 'Không tìm thấy IMEI để hủy đặt cọc', variant: 'destructive' as any })
        return
      }
      await fetch("/api/update-product-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productIds: imeis, newStatus: "Còn hàng" })
      });
      await fetch("/api/kho-hang", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ products: allRows })
      });
      await fetch("/api/dat-coc", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productIds: imeis })
      });
      toast({ title: 'Đã hủy đặt cọc', description: 'Sản phẩm đã trả về kho.' })
      setReloadFlag(f => f + 1)
    } catch (e) {
      toast({ title: 'Lỗi khi hủy đặt cọc', description: String(e), variant: 'destructive' as any })
    } finally {
      setCancelingDepositId(null)
    }
  }

  // === SEARCH KHÁCH ===
  useEffect(() => {
    if (!customerSearch) { setCustomerResults([]); return }
    fetch(`/api/khach-hang?search=${encodeURIComponent(customerSearch)}`)
      .then(res => res.json())
      .then(data => {
        const results = Array.isArray(data.data)
          ? data.data.map((kh: any) => ({ ...kh, isDeposit: kh.trang_thai === "Đặt cọc" }))
          : []
        setCustomerResults(results)
      })
      .catch(() => setCustomerResults([]))
  }, [customerSearch, reloadFlag])

  // === UI ===
  return (
    <ProtectedRoute>
      <div className="space-y-6 pb-28 md:pb-0">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="sticky top-0 z-10 bg-white shadow-sm">
            <TabsTrigger value="ban-hang">Bán hàng</TabsTrigger>
            <TabsTrigger value="don-dat-coc">Đơn đặt cọc</TabsTrigger>
          </TabsList>

          {/* Tab bán hàng */}
          <TabsContent value="ban-hang">
            <TabsContent value="ban-hang">
  {/* Thanh điều hướng luồng mobile: Sản phẩm / Giỏ hàng / Thanh toán */}
  {isMobile && (
    <div className="sticky top-0 z-10 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80 border-b px-4 py-2 flex gap-2">
      <Button size="sm" variant={mobileView==='san-pham'? 'default':'outline'} className="flex-1" onClick={()=> setMobileView('san-pham')}>Sản phẩm</Button>
      <Button size="sm" variant={mobileView==='gio-hang'? 'default':'outline'} className="flex-1" onClick={()=> setMobileView('gio-hang')}>Giỏ hàng ({cart.length})</Button>
      <Button size="sm" variant={mobileView==='thanh-toan'? 'default':'outline'} className="flex-1" onClick={()=> setMobileView('thanh-toan')}>Thanh toán</Button>
    </div>
  )}
  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch">
    {/* Tìm kiếm và thêm sản phẩm */}
    <div className="lg:col-span-2 flex flex-col gap-6 h-full">
      {(!isMobile || mobileView==='san-pham') && (
  <Card className="min-h-[220px] h-full flex flex-col overflow-hidden" >
        <CardHeader>
          <CardTitle>Tìm kiếm sản phẩm</CardTitle>
          <CardDescription>Tìm kiếm iPhone và phụ kiện để thêm vào đơn hàng</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="relative mb-4">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Tìm kiếm theo tên, loai_phu_kien, IMEI..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8"
              inputMode="search"
              enterKeyHint="search"
              onKeyDown={(e)=>{ if(e.key==='Enter' && searchResults.length===1){ addToCart(searchResults[0]) } }}
            />
          </div>

            {/* Bộ lọc nhanh: Nguồn & Loại */}
            <div className="flex flex-wrap gap-2 mb-3">
              <div className="flex items-center gap-1">
                <span className="text-xs text-slate-500 mr-1">Nguồn:</span>
                <Button size="sm" variant={filterSource==='all'?'default':'outline'} onClick={()=> setFilterSource('all')}>Tất cả</Button>
                <Button size="sm" variant={filterSource==='inhouse'?'default':'outline'} onClick={()=> setFilterSource('inhouse')}>Trong kho</Button>
                <Button size="sm" variant={filterSource==='partner'?'default':'outline'} onClick={()=> setFilterSource('partner')}>Đối tác</Button>
              </div>
              <div className="flex items-center gap-1">
                <span className="text-xs text-slate-500 mr-1">Loại:</span>
                <Button size="sm" variant={filterType==='all'?'default':'outline'} onClick={()=> setFilterType('all')}>Tất cả</Button>
                <Button size="sm" variant={filterType==='iphone'?'default':'outline'} onClick={()=> setFilterType('iphone')}>iPhone</Button>
                <Button size="sm" variant={filterType==='accessory'?'default':'outline'} onClick={()=> setFilterType('accessory')}>Phụ kiện</Button>
              </div>
            </div>

          {searchResults.length > 0 && (
            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[60vh] overflow-y-auto overflow-x-hidden rounded-lg border mb-4 p-3">
              {searchResults
                .filter((p: any) => {
                  // Lọc theo Nguồn
                  const src = String(p.nguon || p.source || '').toLowerCase()
                  if (filterSource==='inhouse' && src.includes('đối tác')) return false
                  if (filterSource==='partner' && !src.includes('đối tác')) return false
                  // Lọc theo loại
                  const isAccessory = (p.type === 'accessory') || (!!p.loai_phu_kien && !p.imei)
                  if (filterType==='iphone' && isAccessory) return false
                  if (filterType==='accessory' && !isAccessory) return false
                  return true
                })
                .map((product: any) => {
                const isDisabled = product.trang_thai === "Đã đặt cọc" || product.trang_thai === "Đã bán";
                return (
                  <div
                    key={`${product.id || product.imei || product.ten_san_pham}`}
                    role="button"
                    tabIndex={0}
                    aria-disabled={isDisabled}
                    onClick={() => { if (!isDisabled) { addToCart(product); try { (navigator as any).vibrate && navigator.vibrate(10) } catch {} } }}
                    onKeyDown={(e) => { if (!isDisabled && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); addToCart(product) } }}
                    className={`group relative border rounded-xl p-3 pb-10 bg-white shadow-sm hover:shadow-md transition select-none ${isDisabled ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer hover:border-blue-300'}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-medium leading-snug">
                          {product.ten_san_pham || "[Chưa có tên sản phẩm]"}
                          {product.dung_luong ? ` - ${product.dung_luong}` : ""}
                          {product.mau_sac ? ` - ${product.mau_sac}` : ""}
                        </p>
                        <div className="mt-1 flex items-center gap-1 flex-wrap">
                          <Badge variant="outline">{product.imei ? 'iPhone' : 'Phụ kiện'}</Badge>
                          {String(product.nguon || product.source || '').toLowerCase().includes('đối tác') && (
                            <Badge variant="outline" className="border-teal-600 text-teal-700">Đối tác</Badge>
                          )}
                        </div>
                      </div>
                      {/* Giá được dời xuống góc dưới bên phải */}
                    </div>

                    <div className="mt-2 text-sm text-muted-foreground">
                      {product.imei ? (
                        <>
                          {product.loai_may && <div>Loại máy: <span className="text-slate-800">{product.loai_may}</span></div>}
                          <div>IMEI: <span className="font-mono text-slate-800">{product.imei}</span></div>
                        </>
                      ) : (
                        <>
                          {product.loai_phu_kien && <div>Loại: <span className="text-slate-800">{product.loai_phu_kien}</span></div>}
                          <div>
                            {Number(product.so_luong_ton) === 0
                              ? <span className="text-red-600 font-medium">Hết hàng</span>
                              : <>Tồn kho: <span className="text-slate-800">{product.so_luong_ton ?? product.so_luong ?? 0}</span></>}
                          </div>
                        </>
                      )}
                    </div>

                    {product.trang_thai && product.trang_thai !== 'Còn hàng' && (
                      <div className="mt-2 text-xs font-semibold text-orange-600">{product.trang_thai}</div>
                    )}
                    {!isDisabled && (
                      <div className="mt-2 text-[11px] text-slate-400">Chạm để thêm vào giỏ</div>
                    )}
                    {/* Giá ở góc dưới bên phải */}
                    <div className="absolute bottom-3 right-3 text-right font-semibold">
                      {typeof product.gia_ban === 'number' && product.gia_ban > 0
                        ? `₫${product.gia_ban.toLocaleString()}`
                        : <span className="text-red-600">Liên hệ</span>}
                    </div>
                  </div>
                );
              })}
              {/* div trống để tạo khoảng cách cuối cùng, tránh chữ bị đè lên viền */}
              <div className="h-1" />
            </div>
          )}
        </CardContent>
      </Card>
      )}

      {/* Giỏ hàng */}
  {(!isMobile || mobileView==='gio-hang') && (
  <Card className="min-h-[220px] h-full flex flex-col" >
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShoppingCart className="h-5 w-5" />
            Giỏ hàng ({cart.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {cart.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              Giỏ hàng trống
            </p>
          ) : (
            <div className="space-y-4">
              {/* Apply all warranty (4.1) */}
              {cart.filter(i=> i.type==='product' && i.imei).length > 1 && warrantyPackages.length>0 && (
                <div className="flex items-center gap-2 border rounded p-2 bg-slate-50">
                  <select
                    className="text-xs border rounded px-2 py-1 bg-white"
                    defaultValue=""
                    onChange={e=>{
                      const code = e.target.value || null
                      setSelectedWarranties(prev=>{
                        const next = {...prev}; cart.forEach(it=>{ if(it.type==='product' && it.imei) next[it.imei]=code })
                        return next
                      })
                    }}
                  >
                    <option value="">Áp gói cho tất cả...</option>
                    {warrantyPackages.map(p=> <option key={p.code} value={p.code}>{p.code} - {p.price.toLocaleString()}đ</option>)}
                  </select>
                  <button
                    type="button"
                    className="text-[11px] text-red-600 underline"
                    onClick={()=> setSelectedWarranties(prev=>{ const next={...prev}; cart.forEach(it=>{ if(it.imei) next[it.imei]=null }); return next })}
                  >Xóa toàn bộ</button>
                </div>
              )}
              {/* Header cho desktop/tablet, ẩn trên mobile */}
              <div className="hidden sm:grid grid-cols-5 gap-2 font-semibold text-slate-700 mb-2">
                <span>Tên SP</span>
                <span>IMEI</span>
                <span>Giá</span>
                <span>Trạng thái</span>
                <span></span>
              </div>
              {cart.map((item: CartItem) => (
                <div
                  key={`${item.type}-${item.id}`}
                  className="grid grid-cols-1 sm:grid-cols-5 gap-3 sm:gap-2 items-start sm:items-center border rounded-lg p-3 sm:p-2"
                >
                  <div>
                    <p className="font-medium">{item.ten_san_pham}</p>
                    {item.imei && (
                      <p className="text-[11px] text-muted-foreground font-mono">IMEI: {item.imei}</p>
                    )}
                    {String(item.nguon || item.source || '').toLowerCase().includes('đối tác') && (
                      <div className="mt-1">
                        <Badge className="bg-teal-600 text-white">Đối tác</Badge>
                        {(item.ten_doi_tac || item.sdt_doi_tac) && (
                          <span className="ml-2 text-[11px] text-muted-foreground">
                            {(item.ten_doi_tac || '')}{item.ten_doi_tac && item.sdt_doi_tac ? ' • ' : ''}{(item.sdt_doi_tac || '')}
                          </span>
                        )}
                      </div>
                    )}
                    {item.imei && (
                      <div className="mt-1">
                        <select
                          className="text-[11px] border rounded px-1 py-0.5 bg-white"
                          value={selectedWarranties[item.imei] || ''}
                          onChange={e => handleSelectWarranty(item.imei!, e.target.value || null)}
                        >
                          <option value="">Chọn gói bảo hành...</option>
                          {warrantyPackages.map(p => (
                            <option key={p.code} value={p.code}>{p.code}{p.hwMonths?`-${p.hwMonths}T`:''}{p.lifetime?'(Life)':''}</option>
                          ))}
                        </select>
                        {selectedWarranties[item.imei] && (
                          <button
                            type="button"
                            className="ml-2 text-[11px] underline text-blue-600"
                            onClick={() => {
                              if(!item.imei) return
                              setOpenWarrantyInfo(openWarrantyInfo===item.imei ? null : item.imei)
                            }}
                          >Chi tiết</button>
                        )}
                        {openWarrantyInfo===item.imei && selectedWarranties[item.imei] && (
                          <div className="mt-1 p-2 rounded border bg-slate-50 text-[11px] space-y-0.5">
                            {(() => {
                              const pkg = warrantyPackages.find(p=>p.code===selectedWarranties[item.imei!])
                              if(!pkg) return null
                              return (
                                <>
                                  <div className="font-medium">{pkg.name} ({pkg.code})</div>
                                  {pkg.price>0 && <div>Giá: ₫{pkg.price.toLocaleString()}</div>}
                                  <div>1 đổi 1: {pkg.exchangeDays? `${pkg.exchangeDays} ngày`: '—'}</div>
                                  <div>Phần cứng: {pkg.hwMonths? `${pkg.hwMonths} tháng`: '—'}</div>
                                  <div>CNC/Độ sim: {pkg.cncMonths? `${pkg.cncMonths} tháng`: '—'}</div>
                                  <div>Lifetime: {pkg.lifetime? 'Có':'Không'}</div>
                                  {pkg.notes && <div className="italic opacity-80">{pkg.notes}</div>}
                                </>
                              )
                            })()}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="sm:font-mono sm:text-xs hidden sm:block">{item.imei || "-"}</div>
                  {/* Giá: cho mobile đặt ngay dưới tên SP bằng flex-wrap; Desktop vẫn ở cột riêng */}
                  <div className="font-semibold flex items-center gap-1">
                    {editingPriceId === item.id ? (
                      <>
                        <input
                          ref={editPriceRef}
                          className="h-6 w-24 border rounded px-1 text-right text-[13px]"
                          defaultValue={item.gia_ban}
                          autoFocus
                          onBlur={()=> setEditingPriceId(null)}
                          onChange={e=>{
                            const num = Number(e.target.value.replace(/[^\d]/g,'')) || 0
                            setCart(prev=> prev.map(p=> p.id===item.id ? {...p, gia_ban: num} : p))
                          }}
                        />
                        <button type="button" onClick={()=> setEditingPriceId(null)} className="text-green-600"><Check className="h-3 w-3"/></button>
                        <button type="button" onClick={()=> setEditingPriceId(null)} className="text-red-600"><X className="h-3 w-3"/></button>
                      </>
                    ) : (
                      <>
                        <span>₫{(typeof item.gia_ban === 'number'? item.gia_ban : 0).toLocaleString()}</span>
                        {item.type==='product' && <button type="button" onClick={()=> setEditingPriceId(item.id)} className="text-xs text-blue-600" title="Sửa giá"><Pencil className="h-3 w-3"/></button>}
                      </>
                    )}
                  </div>
                  <div>
                    <Badge
                      className={
                        item.trang_thai === "Đã đặt cọc"
                          ? "bg-orange-100 text-orange-800"
                          : item.trang_thai === "Hết hàng"
                          ? "bg-gray-200 text-gray-600"
                          : "bg-green-100 text-green-800"
                      }
                    >
                      {item.trang_thai || "Có sẵn"}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-3 sm:gap-2">
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-10 w-10 sm:h-8 sm:w-8 bg-transparent"
                      onClick={() =>
                        updateQuantity(item.id, item.type, item.so_luong - 1)
                      }
                    >
                      <Minus className="h-5 w-5 sm:h-4 sm:w-4" />
                    </Button>
                    <span className="w-10 sm:w-8 text-center text-base sm:text-sm font-semibold">{item.so_luong}</span>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-10 w-10 sm:h-8 sm:w-8 bg-transparent"
                      onClick={() =>
                        updateQuantity(item.id, item.type, item.so_luong + 1)
                      }
                      disabled={item.so_luong >= (item.max_quantity || 1)}
                    >
                      <Plus className="h-5 w-5 sm:h-4 sm:w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-10 w-10 sm:h-8 sm:w-8 text-destructive"
                      onClick={() => removeFromCart(item.id, item.type)}
                    >
                      <Trash2 className="h-5 w-5 sm:h-4 sm:w-4" />
                    </Button>
                  </div>
                </div>
              ))}
              {cart.some((i) => i.trang_thai === "Đã đặt cọc") && (
                <div className="text-orange-600 text-sm mt-2">
                  Một hoặc nhiều sản phẩm trong giỏ đã được đặt cọc. Vui lòng
                  chuyển sang tab Đơn đặt cọc để xử lý tiếp!
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
  )}
    </div>

    {/* Thông tin đơn hàng */}
    {(!isMobile || mobileView==='thanh-toan') && (
    <div className="space-y-6">
  {/* Khách hàng */}
  <Card className="min-h-[80px] max-h-[200px] flex flex-col" >
        <CardHeader>
          <CardTitle>Khách hàng</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {customerResults.length > 0 && (
            <div className="border rounded bg-white max-h-40 overflow-y-auto">
              {customerResults.map((kh: Customer & { isDeposit?: boolean }) => (
                <div
                  key={kh.id}
                  className={`flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-slate-100 ${
                    kh.isDeposit ? "text-orange-600 font-semibold" : ""
                  }`}
                  onClick={() => {
                    setSelectedCustomer(kh)
                    setCustomerSearch("")
                    setCustomerResults([])
                  }}
                >
                  <span>
                    {kh.ho_ten} ({kh.so_dien_thoai})
                  </span>
                  {kh.isDeposit && (
                    <span title="Khách đang đặt cọc" className="ml-1">
                      🔒
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}

          {selectedCustomer ? (
            <div className="p-3 border rounded-lg">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">{selectedCustomer.ho_ten}</p>
                  <p className="text-sm text-muted-foreground">
                    {selectedCustomer.so_dien_thoai}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedCustomer(null)}
                >
                  Xóa
                </Button>
              </div>
            </div>
          ) : null}

          <div className="flex gap-2 mt-2">
            <Button
              variant="outline"
              className="flex-1 bg-transparent"
              onClick={() => setIsCustomerSelectOpen(true)}
            >
              <User className="mr-2 h-4 w-4" />
              Chọn khách hàng
            </Button>
            <Button
              variant="outline"
              onClick={() => setIsCustomerDialogOpen(true)}
            >
              <Plus className="h-4 w-4" />
            </Button>
            {/* Đã gộp máy đối tác vào Tìm kiếm sản phẩm, bỏ nút riêng */}
          </div>
        </CardContent>
      </Card>

  {/* Thanh toán */}
  <Card className=" flex flex-col" >
        <CardHeader>
          <CardTitle>Thanh toán</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Phương thức thanh toán</label>
            <Select
              value={phuongThucThanhToan}
              onValueChange={setPhuongThucThanhToan}
            >
              <SelectTrigger className="bg-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-white">
                <SelectItem value="Tiền mặt">Tiền mặt</SelectItem>
                <SelectItem value="Chuyển khoản">Chuyển khoản</SelectItem>
                <SelectItem value="Thẻ">Thẻ</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">Giảm giá</label>
              <div className="flex gap-1">
                {['50k','100k','200k','5%','10%'].map(tag => (
                  <button key={tag} type="button" onClick={()=> applyQuickDiscount(tag)} className="text-[11px] px-1.5 py-0.5 border rounded bg-white hover:bg-slate-50">{tag}</button>
                ))}
                <button type="button" onClick={()=> { setGiamGia(0); setGiamGiaInput(''); setDiscountParseMsg(''); }} className="text-[11px] px-1.5 py-0.5 border rounded bg-white hover:bg-slate-50">Reset</button>
              </div>
            </div>
            <Input
              type="text"
              value={giamGiaInput}
              onChange={e=> handleDiscountInput(e.target.value)}
              onBlur={commitDiscount}
              placeholder="Ví dụ: 100k hoặc 10%"
            />
            {/* Bỏ gợi ý ngoài ô theo yêu cầu */}
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Ghi chú</label>
            <Input
              value={ghiChu}
              onChange={(e) => setGhiChu(e.target.value)}
              placeholder="Ghi chú đơn hàng..."
            />
          </div>

          <Separator />

          <div className="space-y-2">
            {cart.some(i=>i.type==='product' && i.imei) && !Object.values(selectedWarranties).some(Boolean) && (
              <div className="text-xs p-2 rounded border bg-amber-50 text-amber-700">
                Gợi ý: Thêm gói bảo hành để tăng giá trị dịch vụ & chăm sóc khách hàng.
              </div>
            )}
            <div className="flex justify-between">
              <span>Tiền hàng:</span>
              <span>₫{tongTien.toLocaleString()}</span>
            </div>
            {warrantyTotal > 0 && (
              <div className="flex justify-between text-blue-700">
                <span>Bảo hành:</span>
                <span>+₫{warrantyTotal.toLocaleString()}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span>Giảm giá:</span>
              <span>-₫{giamGia.toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-lg font-semibold mb-2">
              <span>Thanh toán:</span>
              <span>₫{finalThanhToan.toLocaleString()}</span>
            </div>
          </div>

          {/* Loại đơn + vận chuyển */}
          <div className="flex gap-4">
            <Select value={loaiDon} onValueChange={setLoaiDon}>
              <SelectTrigger className="w-32 bg-white">
                <SelectValue placeholder="Loại đơn" />
              </SelectTrigger>
              <SelectContent className="bg-white">
                <SelectItem value="Đơn onl">Đơn onl</SelectItem>
                <SelectItem value="Đơn off">Đơn off</SelectItem>
              </SelectContent>
            </Select>
            {loaiDon === "Đơn onl" && (
              <Select
                value={hinhThucVanChuyen}
                onValueChange={setHinhThucVanChuyen}
              >
                <SelectTrigger className="w-40 bg-white">
                  <SelectValue placeholder="Hình thức vận chuyển" />
                </SelectTrigger>
                <SelectContent className="bg-white">
                  <SelectItem value="GHTK">GHTK</SelectItem>
                  <SelectItem value="Book Grab">Book Grab</SelectItem>
                  <SelectItem value="Gửi Xe">Gửi Xe</SelectItem>
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Loại thanh toán */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Loại thanh toán</label>
            <Select value={loaiThanhToan} onValueChange={setLoaiThanhToan}>
              <SelectTrigger className="bg-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-white">
                <SelectItem value="Thanh toán đủ">Thanh toán đủ</SelectItem>
                <SelectItem value="Đặt cọc">Đặt cọc</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {loaiThanhToan === "Đặt cọc" && (
            <div className="flex gap-4">
              <div className="flex-1 space-y-2">
                <label className="text-sm font-medium">Số tiền cọc</label>
                <Input
                  type="text"
                  min={0}
                  value={soTienCoc ? `${Math.round(soTienCoc).toLocaleString('vi-VN')}đ` : ''}
                  onChange={(e) => {
                    // Chỉ lấy số, bỏ ký tự khác
                    const raw = e.target.value.replace(/[^\d]/g, "");
                    setSoTienCoc(raw ? Number(raw) : 0);
                  }}
                  placeholder="Nhập số tiền cọc"
                />
              </div>
              <div className="flex-1 space-y-2">
                <label className="text-sm font-medium">Ngày hẹn trả đủ</label>
                <Input
                  type="date"
                  value={ngayHenTraDu}
                  onChange={(e) => setNgayHenTraDu(e.target.value)}
                />
              </div>
            </div>
          )}

          {/* Nút thanh toán: hiển thị trên desktop; mobile sẽ có thanh toán cố định dưới */}
          <Button
            className="hidden md:block w-full bg-blue-600 text-white hover:bg-blue-700"
            onClick={handleCheckout}
            disabled={isLoading || cart.length === 0}
          >
            {isLoading ? "Đang xử lý..." : "Thanh toán"}
          </Button>
        </CardContent>
      </Card>
    </div>
    )}
  </div>
</TabsContent>

          </TabsContent>

          {/* Tab đặt cọc */}
          <TabsContent value="don-dat-coc">
            <Card>
              <CardHeader>
                <CardTitle>Đơn đặt cọc</CardTitle>
                <CardDescription>Chỉ hiển thị đơn đặt cọc</CardDescription>
                <div className="mt-2">
                  <div className="relative">
                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Tìm mã đơn, tên KH, SĐT..."
                      value={depositSearch}
                      onChange={(e)=> setDepositSearch(e.target.value)}
                      className="pl-8"
                      inputMode="search"
                    />
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {/* Gộp các đơn có cùng mã đơn hàng */}
                {(() => {
                  // Gộp theo mã đơn hàng
                  const groupedAll = Object.values(
                    depositOrders.reduce((acc: any, order: any) => {
                      const maDon = order["Mã Đơn Hàng"] || order["ID Đơn Hàng"] || order["ma_don_hang"];
                      if (!maDon) return acc;
                      if (!acc[maDon]) {
                        acc[maDon] = { ...order };
                        acc[maDon]._products = [];
                        acc[maDon]._tien_coc_arr = [];
                        acc[maDon]._con_lai_arr = [];
                      }
                      const giaBan = typeof order["Giá Bán"] === "string" ? parseInt(order["Giá Bán"].replace(/[^\d]/g, "")) || 0 : order["Giá Bán"] || 0;
                      const tienCoc = typeof order["Số Tiền Cọc"] === "string" ? parseInt(order["Số Tiền Cọc"].replace(/[^\d]/g, "")) || 0 : order["Số Tiền Cọc"] || 0;
                      const conLai = typeof order["Số Tiền Còn Lại"] === "string" ? parseInt(order["Số Tiền Còn Lại"].replace(/[^\d]/g, "")) || 0 : order["Số Tiền Còn Lại"] || (giaBan - tienCoc);
                      if (tienCoc) acc[maDon]._tien_coc_arr.push(tienCoc);
                      if (conLai) acc[maDon]._con_lai_arr.push(conLai);
                      acc[maDon]._products.push(order["Tên Sản Phẩm"] || order["ten_san_pham"]);
                      return acc;
                    }, {})
                  ) as any[];

                  const norm = (s: any) => String(s || "").toLowerCase();
                  const filtered = groupedAll.filter((order: any) => {
                    const q = norm(depositSearch);
                    if (!q) return true;
                    const code = norm(order["Mã Đơn Hàng"] || order["ID Đơn Hàng"] || order["ma_don_hang"]);
                    const name = norm(order["Tên Khách Hàng"] || order["ten_khach_hang"]);
                    const phone = norm(order["Số Điện Thoại"] || order["so_dien_thoai"]);
                    const products = norm((order._products || []).join(", "));
                    return code.includes(q) || name.includes(q) || phone.includes(q) || products.includes(q);
                  });

                  if (depositLoading) {
                    return <div className="py-8 text-center text-muted-foreground flex items-center justify-center gap-2"><Loader2 className="h-4 w-4 animate-spin"/> Đang tải...</div>
                  }

                  if (filtered.length === 0) {
                    return <div className="py-8 text-center text-muted-foreground">Không có đơn đặt cọc</div>
                  }

                  if (isMobile) {
                    return (
                      <div className="grid grid-cols-1 gap-3">
                        {filtered.map((order: any, idx: number) => {
                          const now = dayjs();
                          const hanRaw = order["Hạn Thanh Toán"];
                          const han = hanRaw ? dayjs(hanRaw, "YYYY-MM-DD") : null;
                          const ngayDatCocRaw = order["Ngày Đặt Cọc"];
                          const ngayDatCoc = ngayDatCocRaw ? dayjs(ngayDatCocRaw, "DD/MM/YYYY") : null;
                          const tongCoc = (order._tien_coc_arr || []).reduce((s: number, v: number) => s + v, 0);
                          const tongConLai = (order._con_lai_arr || []).reduce((s: number, v: number) => s + v, 0);
                          const isOverdue = han && han.isValid() && han.isBefore(now) && tongConLai > 0;
                          const isPaid = tongConLai <= 0;
                          const key = order["Mã Đơn Hàng"] || order["ID Đơn Hàng"] || idx;
                          const maDon = order["Mã Đơn Hàng"] || order["ID Đơn Hàng"] || order["ma_don_hang"];
                          const handleThanhToanTiep = () => {
                            const allRows = depositOrders.filter((o: any) => {
                              const m = o["Mã Đơn Hàng"] || o["ID Đơn Hàng"] || o["ma_don_hang"];
                              return m === maDon;
                            });
                            const products: CartItem[] = allRows.map((o: any) => ({
                              id: o["IMEI"] || o["ID Máy"] || o["Tên Sản Phẩm"] || o["ten_san_pham"] || o["imei"] || o["id"],
                              type: "product",
                              ten_san_pham: o["Tên Sản Phẩm"] || o["ten_san_pham"] || "",
                              gia_ban: typeof o["Giá Bán"] === "string" ? parseInt(o["Giá Bán"].replace(/[^\d]/g, "")) || 0 : o["Giá Bán"] || 0,
                              gia_nhap: typeof o["Giá Nhập"] === "string" ? parseInt(o["Giá Nhập"].replace(/[^\d]/g, "")) || 0 : o["Giá Nhập"] || 0,
                              so_luong: 1,
                              max_quantity: 1,
                              imei: o["IMEI"] || "",
                              trang_thai: o["Tình Trạng Máy"] || o["tinh_trang_may"] || "",
                              loai_may: o["Loại Máy"] || o["loai_may"] || "",
                              dung_luong: o["Dung Lượng"] || o["dung_luong"] || "",
                              mau_sac: o["Màu Sắc"] || o["mau_sac"] || "",
                              pin: o["Pin (%)"] || o["pin"] || "",
                              tinh_trang: o["Tình Trạng Máy"] || o["tinh_trang_may"] || ""
                            }));
                            setCart(products);
                            setSelectedCustomer({
                              id: order["Số Điện Thoại"] || order["so_dien_thoai"] || "",
                              ho_ten: order["Tên Khách Hàng"] || order["ten_khach_hang"] || "Khách lẻ",
                              so_dien_thoai: order["Số Điện Thoại"] || order["so_dien_thoai"] || ""
                            });
                            setGiamGia(0);
                            setActiveTab('ban-hang');
                            setMobileView('thanh-toan');
                          };
                          return (
                            <div key={key} className={`border rounded-lg p-3 shadow-sm ${isOverdue? 'bg-red-50': isPaid? 'bg-green-50': 'bg-white'}`}>
                              <div className="flex items-start justify-between">
                                <div>
                                  <div className="font-semibold">{maDon}</div>
                                  <div className="text-sm text-slate-600">{order["Tên Khách Hàng"] || order["ten_khach_hang"] || "-"}</div>
                                  <div className="text-xs text-muted-foreground">{order["Số Điện Thoại"] || order["so_dien_thoai"] || "-"}</div>
                                </div>
                                {isOverdue && <Badge className="bg-red-600 text-white">Quá hạn</Badge>}
                                {isPaid && <Badge className="bg-emerald-600 text-white">Đã tất toán</Badge>}
                              </div>
                              <div className="mt-2 text-sm line-clamp-2">{(order._products || []).join(', ')}</div>
                              <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
                                <div>
                                  <div className="text-slate-500">Đã cọc</div>
                                  <div className="font-semibold text-blue-700">₫{tongCoc.toLocaleString()}</div>
                                </div>
                                <div>
                                  <div className="text-slate-500">Còn lại</div>
                                  <div className="font-semibold text-green-700">₫{tongConLai.toLocaleString()}</div>
                                </div>
                              </div>
                              <div className="mt-2 flex items-center justify-between text-xs text-slate-600">
                                <div>Ngày cọc: {ngayDatCoc && ngayDatCoc.isValid() ? ngayDatCoc.format("DD/MM/YYYY") : '-'}</div>
                                <div>Hạn TT: {han && han.isValid() ? han.format("DD/MM/YYYY") : '-'}</div>
                              </div>
                              <div className="mt-3 flex gap-2">
                                {!isPaid && (
                                  <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white flex-1" onClick={handleThanhToanTiep}>Thanh toán tiếp</Button>
                                )}
                                {!isPaid && (
                                  <Button size="sm" className="bg-red-600 hover:bg-red-700 text-white" onClick={()=> handleCancelDeposit(maDon)} disabled={cancelingDepositId===maDon}>
                                    {cancelingDepositId===maDon ? <><Loader2 className="h-4 w-4 animate-spin mr-1"/> Đang hủy</> : 'Hủy đặt cọc'}
                                  </Button>
                                )}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )
                  }

                  // Desktop/tablet: bảng chi tiết
                  return (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-slate-50 border-b">
                          <tr>
                            <th className="text-left px-3 py-2 font-semibold text-slate-700">Mã Đơn Hàng</th>
                            <th className="text-left px-3 py-2 font-semibold text-slate-700">Khách</th>
                            <th className="text-left px-3 py-2 font-semibold text-slate-700">Sản phẩm</th>
                            <th className="text-left px-3 py-2 font-semibold text-slate-700">Tổng đã cọc</th>
                            <th className="text-left px-3 py-2 font-semibold text-slate-700">Tổng còn lại</th>
                            <th className="text-left px-3 py-2 font-semibold text-slate-700">Ngày cọc</th>
                            <th className="text-left px-3 py-2 font-semibold text-slate-700">Hạn TT</th>
                            <th className="text-left px-3 py-2 font-semibold text-slate-700">Thao tác</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filtered.map((order: any, idx: number) => {
                            const now = dayjs();
                            const hanRaw = order["Hạn Thanh Toán"];
                            const han = hanRaw ? dayjs(hanRaw, "YYYY-MM-DD") : null;
                            const ngayDatCocRaw = order["Ngày Đặt Cọc"];
                            const ngayDatCoc = ngayDatCocRaw ? dayjs(ngayDatCocRaw, "DD/MM/YYYY") : null;
                            const tongCoc = (order._tien_coc_arr || []).reduce((s: number, v: number) => s + v, 0);
                            const tongConLai = (order._con_lai_arr || []).reduce((s: number, v: number) => s + v, 0);
                            const isOverdue = han && han.isValid() && han.isBefore(now) && tongConLai > 0;
                            const isPaid = tongConLai <= 0;
                            const key = order["Mã Đơn Hàng"] || order["ID Đơn Hàng"] || idx;
                            const maDon = order["Mã Đơn Hàng"] || order["ID Đơn Hàng"] || order["ma_don_hang"];
                            const handleThanhToanTiep = () => {
                              const allRows = depositOrders.filter((o: any) => {
                                const m = o["Mã Đơn Hàng"] || o["ID Đơn Hàng"] || o["ma_don_hang"];
                                return m === maDon;
                              });
                              const products: CartItem[] = allRows.map((o: any) => ({
                                id: o["IMEI"] || o["ID Máy"] || o["Tên Sản Phẩm"] || o["ten_san_pham"] || o["imei"] || o["id"],
                                type: "product",
                                ten_san_pham: o["Tên Sản Phẩm"] || o["ten_san_pham"] || "",
                                gia_ban: typeof o["Giá Bán"] === "string" ? parseInt(o["Giá Bán"].replace(/[^\d]/g, "")) || 0 : o["Giá Bán"] || 0,
                                gia_nhap: typeof o["Giá Nhập"] === "string" ? parseInt(o["Giá Nhập"].replace(/[^\d]/g, "")) || 0 : o["Giá Nhập"] || 0,
                                so_luong: 1,
                                max_quantity: 1,
                                imei: o["IMEI"] || "",
                                trang_thai: o["Tình Trạng Máy"] || o["tinh_trang_may"] || "",
                                loai_may: o["Loại Máy"] || o["loai_may"] || "",
                                dung_luong: o["Dung Lượng"] || o["dung_luong"] || "",
                                mau_sac: o["Màu Sắc"] || o["mau_sac"] || "",
                                pin: o["Pin (%)"] || o["pin"] || "",
                                tinh_trang: o["Tình Trạng Máy"] || o["tinh_trang_may"] || ""
                              }));
                              setCart(products);
                              setSelectedCustomer({
                                id: order["Số Điện Thoại"] || order["so_dien_thoai"] || "",
                                ho_ten: order["Tên Khách Hàng"] || order["ten_khach_hang"] || "Khách lẻ",
                                so_dien_thoai: order["Số Điện Thoại"] || order["so_dien_thoai"] || ""
                              });
                              setGiamGia(0);
                              setActiveTab("ban-hang");
                            };
                            return (
                              <tr
                                key={key}
                                className={`border-b hover:bg-slate-50 transition ${isOverdue ? "bg-red-50" : isPaid ? "bg-green-50" : ""}`}
                              >
                                <td className="align-middle text-left px-3 py-2 font-semibold">{maDon}</td>
                                <td className="align-middle text-left px-3 py-2">
                                  <div className="font-semibold text-slate-800">{order["Tên Khách Hàng"] || order["ten_khach_hang"] || "-"}</div>
                                  <div className="text-xs text-muted-foreground">{order["Số Điện Thoại"] || order["so_dien_thoai"] || "-"}</div>
                                </td>
                                <td className="align-middle text-left px-3 py-2">{(order._products || []).join(", ")}</td>
                                <td className="align-middle text-left px-3 py-2 font-semibold text-blue-700">₫{tongCoc.toLocaleString()}</td>
                                <td className="align-middle text-left px-3 py-2 font-semibold text-green-700">₫{tongConLai.toLocaleString()}</td>
                                <td className="align-middle text-left px-3 py-2">{ngayDatCoc && ngayDatCoc.isValid() ? ngayDatCoc.format("DD/MM/YYYY") : "-"}</td>
                                <td className="align-middle text-left px-3 py-2">{han && han.isValid() ? han.format("DD/MM/YYYY") : "-"}</td>
                                <td className="align-middle text-left px-3 py-2">
                                  <div className="flex gap-2">
                                    {!isPaid && (
                                      <Button
                                        size="sm"
                                        className="bg-green-500 hover:bg-green-600 text-white rounded px-4 py-1 font-semibold shadow"
                                        onClick={handleThanhToanTiep}
                                      >
                                        Thanh toán tiếp
                                      </Button>
                                    )}
                                    {!isPaid && (
                                      <Button
                                        size="sm"
                                        className="bg-red-500 hover:bg-red-600 text-white rounded px-4 py-1 font-semibold shadow"
                                        onClick={() => handleCancelDeposit(maDon)}
                                        disabled={cancelingDepositId===maDon}
                                      >
                                        {cancelingDepositId===maDon ? <><Loader2 className="h-4 w-4 animate-spin mr-1"/> Đang hủy</> : 'Hủy đặt cọc'}
                                      </Button>
                                    )}
                                    {isPaid && (
                                      <Button size="sm" variant="default">Chuyển sang đơn bán</Button>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  );
                })()}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Dialogs */}
      <CustomerDialog
        isOpen={isCustomerDialogOpen}
        onClose={() => setIsCustomerDialogOpen(false)}
        onSuccess={(customer) => {
          const c = customer as any;
          setSelectedCustomer({
            id: c.sdt,
            ho_ten: c.ten_khach,
            so_dien_thoai: c.sdt,
          })
          setIsCustomerDialogOpen(false)
          setIsCustomerSelectOpen(false); // Đóng luôn dialog chọn khách hàng nếu đang mở
          reloadCustomers();
        }}
      />
      <CustomerSelectDialog
        isOpen={isCustomerSelectOpen}
        onClose={() => setIsCustomerSelectOpen(false)}
        onSelect={(customer) => {
          setSelectedCustomer(customer)
          setIsCustomerSelectOpen(false)
        }}
      />
      {/* Bỏ PartnerSelectDialog: đã gộp vào search */}
      {/* Sticky mobile checkout bar */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 border-t bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80 px-3 py-[10px]" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 10px)' }}>
        <div className="max-w-screen-md mx-auto flex items-center justify-between gap-3">
          <div className="text-sm">
            <div className="text-slate-500">Thanh toán</div>
            <div className="text-xl font-bold">₫{finalThanhToan.toLocaleString()}</div>
          </div>
          {mobileView === 'san-pham' && (
            <Button
              className="flex-1 bg-blue-600 text-white hover:bg-blue-700"
              onClick={() => setMobileView('gio-hang')}
              disabled={cart.length === 0}
            >
              {`Giỏ hàng (${cart.length})`}
            </Button>
          )}
          {mobileView === 'gio-hang' && (
            <Button
              className="flex-1 bg-blue-600 text-white hover:bg-blue-700"
              onClick={() => setMobileView('thanh-toan')}
              disabled={cart.length === 0}
            >
              Thanh toán
            </Button>
          )}
          {mobileView === 'thanh-toan' && (
            <Button
              className="flex-1 bg-blue-600 text-white hover:bg-blue-700"
              onClick={handleCheckout}
              disabled={isLoading || cart.length === 0}
            >
              {isLoading ? "Đang xử lý..." : "Thanh toán"}
            </Button>
          )}
        </div>
      </div>
    </ProtectedRoute>
  )
}
