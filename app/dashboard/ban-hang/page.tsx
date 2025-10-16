"use client"

import { useState, useEffect, useRef, useMemo } from "react"
import { ProtectedRoute } from "@/components/auth/protected-route"
import { CustomerDialog } from "@/components/ban-hang/customer-dialog"
import { CustomerSelectDialog } from "@/components/ban-hang/customer-select-dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Search, Plus, Minus, Trash2, User, ShoppingCart, Loader2, Pencil, Check, X, Lock, Globe, Battery, Copy, CheckCircle } from "lucide-react"
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
  serial?: string
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
  const [filterType, setFilterType] = useState<"all" | "iphone" | "ipad" | "accessory">("all")
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
          // Hỗ trợ cả 2 dạng payload: { data: [header, ...rows] } hoặc { data: { header, rows } }
          let orders: any[] = []
          const payload = data?.data
          if (Array.isArray(payload) && Array.isArray(payload[0])) {
            const [header, ...rows] = payload as any[]
            orders = rows.map((row: any[]) => {
              const obj: Record<string, any> = {}
              ;(header as string[]).forEach((key: string, idx: number) => { obj[key] = row[idx] })
              return obj
            })
          } else if (payload?.header && payload?.rows) {
            const header = payload.header
            const rows = payload.rows
            orders = rows.map((row: any[]) => {
              const obj: Record<string, any> = {}
              ;(header as string[]).forEach((key: string, idx: number) => { obj[key] = row[idx] })
              return obj
            })
          }
          setDepositOrders(orders)
        } else {
          setDepositOrders([])
        }
      } catch {
        setDepositOrders([])
      } finally {
        setDepositLoading(false)
      }
    };
    fetchDepositOrders();
  }, [activeTab, reloadFlag]);
  // Lấy tổng đơn đặt cọc ngay khi vào trang để hiện badge
  useEffect(() => {
    const fetchOnce = async () => {
      try {
        const res = await fetch("/api/dat-coc")
        if (res.ok) {
          const data = await res.json()
          let orders: any[] = []
          const payload = data?.data
          if (Array.isArray(payload) && Array.isArray(payload[0])) {
            const [header, ...rows] = payload as any[]
            orders = rows.map((row: any[]) => {
              const obj: Record<string, any> = {}
              ;(header as string[]).forEach((key: string, idx: number) => { obj[key] = row[idx] })
              return obj
            })
          }
          setDepositOrders(orders)
        }
      } catch {}
    }
    fetchOnce()
  }, [])

  // Đếm tổng số đơn đặt cọc (theo mã đơn duy nhất, bỏ trạng thái hủy)
  const depositOrderCount = useMemo(() => {
    try {
      const uniq = new Set<string>()
      for (const o of depositOrdersState) {
        const status = (o["Trạng Thái"] || o["trang_thai"] || o["Trạng thái"] || o["status"] || "").toLowerCase();
        if (status === "đã thanh toán" || status === "đã tất toán") continue;
        const ma = (o["Mã Đơn Hàng"] || o["ID Đơn Hàng"] || o["ma_don_hang"] || "").toString().trim();
        if (ma) uniq.add(ma);
      }
      return uniq.size;
    } catch { return 0 }
  }, [depositOrdersState])
  // State to hold kho hàng products
  const [khoHangProducts, setKhoHangProducts] = useState<any[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  const [searchResults, setSearchResults] = useState<any[]>([])
  const [cart, setCart] = useState<CartItem[]>([])
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)
  const [giamGia, setGiamGia] = useState(0)
  // Thanh toán: hỗ trợ nhiều phương thức + trả góp
  const [cashEnabled, setCashEnabled] = useState(false)
  const [cashAmount, setCashAmount] = useState(0)
  const [transferEnabled, setTransferEnabled] = useState(false)
  const [transferAmount, setTransferAmount] = useState(0)
  const [cardEnabled, setCardEnabled] = useState(false)
  const [cardAmount, setCardAmount] = useState(0)
  const [installmentEnabled, setInstallmentEnabled] = useState(false)
  const [installmentType, setInstallmentType] = useState<'' | 'Góp iCloud' | 'Thẻ tín dụng' | 'Mira'>('')
  const [installmentDown, setInstallmentDown] = useState(0)
  const [installmentLoan, setInstallmentLoan] = useState(0)
  const [loaiDon, setLoaiDon] = useState("")
  const [hinhThucVanChuyen, setHinhThucVanChuyen] = useState("")
  const [diaChiNhan, setDiaChiNhan] = useState("")
  const [ghiChu, setGhiChu] = useState("")
  const [copiedImei, setCopiedImei] = useState<string | null>(null)
  const [justAddedKey, setJustAddedKey] = useState<string | null>(null)
  // Discount input string (5.2)
  const [giamGiaInput, setGiamGiaInput] = useState("")
  const [discountParseMsg, setDiscountParseMsg] = useState<string>("")
  const [isLoading, setIsLoading] = useState(false)
  const [isCustomerDialogOpen, setIsCustomerDialogOpen] = useState(false)
  const [isCustomerSelectOpen, setIsCustomerSelectOpen] = useState(false)
  const [orders, setOrders] = useState<any[]>([])
  const [currentDepositOrderId, setCurrentDepositOrderId] = useState<string | null>(null)
  const [customerSearch, setCustomerSearch] = useState("")
  const [customerResults, setCustomerResults] = useState<any[]>([])
  // Máy đối tác cache để lọc nhanh trong tìm kiếm
  const [partnerProducts, setPartnerProducts] = useState<any[]>([])
  // Cache phụ kiện để tránh gọi API lặp khi query ngắn
  const [accessoryProducts, setAccessoryProducts] = useState<any[]>([])
  // Desktop search table UX enhancements
  type SortKey = 'san_pham' | 'imei_loai' | 'nguon' | 'trang_thai' | 'gia'
  const [sortKey, setSortKey] = useState<SortKey>('san_pham')
  const [sortOrder, setSortOrder] = useState<'asc'|'desc'>('asc')
  const [selectedIndex, setSelectedIndex] = useState<number>(-1)
  const tableContainerRef = useRef<HTMLDivElement|null>(null)
  const [isSearching, setIsSearching] = useState(false)
  // Persist search & filters
  useEffect(() => {
    try {
      const savedQ = localStorage.getItem('bh_search_query')
      const savedSrc = localStorage.getItem('bh_filter_source') as any
  const savedType = localStorage.getItem('bh_filter_type') as any
      if (savedQ !== null) setSearchQuery(savedQ)
      if (savedSrc === 'all' || savedSrc === 'inhouse' || savedSrc === 'partner') setFilterSource(savedSrc)
  if (savedType === 'all' || savedType === 'iphone' || savedType === 'ipad' || savedType === 'accessory') setFilterType(savedType)
    } catch {}
    // run once
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  useEffect(() => { try { localStorage.setItem('bh_search_query', searchQuery) } catch{} }, [searchQuery])
  useEffect(() => { try { localStorage.setItem('bh_filter_source', filterSource) } catch{} }, [filterSource])
  useEffect(() => { try { localStorage.setItem('bh_filter_type', filterType) } catch{} }, [filterType])
  // Reset row selection when query changes
  useEffect(() => { setSelectedIndex(-1) }, [searchQuery])
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
  const [selectedWarranties, setSelectedWarranties] = useState<Record<string,string|null>>({}) // deviceId (IMEI/Serial) -> packageCode
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

  function handleSelectWarranty(deviceId: string, pkgCode: string | null) {
    setSelectedWarranties(prev => ({ ...prev, [deviceId]: pkgCode }))
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
        setIsSearching(false)
        setSearchResults([
          ...khoHangProducts,
          ...partnerProducts,
          ...accessoryProducts,
        ])
        return
      }
      try {
        setIsSearching(true)
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
          item.serial?.toLowerCase().includes(qLower) ||
          (item.loai_phu_kien?.toLowerCase().includes(qLower) ?? false)
        ))
        const filteredPartner = partnerProducts.filter((item) => (
          item.ten_san_pham?.toLowerCase().includes(qLower) ||
          item.imei?.toLowerCase().includes(qLower) ||
          item.serial?.toLowerCase().includes(qLower) ||
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
      } finally {
        setIsSearching(false)
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
              serial: p.serial || p['Serial'] || '',
              'Màu Sắc': p.mau_sac,
              'Pin (%)': p.pin,
              'Tình Trạng Máy': p.tinh_trang_may,
              ghi_chu: p.ghi_chu ?? p['Ghi Chú'] ?? ''
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
            id: p.imei || p.serial || p.id,
            type: 'product',
            ten_san_pham: p.model || '',
            gia_ban: typeof p.gia_goi_y_ban === 'number' ? p.gia_goi_y_ban : 0,
            gia_nhap: typeof p.gia_chuyen === 'number' ? p.gia_chuyen : 0,
            so_luong: 1,
            max_quantity: 1,
            imei: p.imei || '',
            serial: p.serial || '',
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
            gia_ban: product.gia_ban,
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
        const isPartner = String(product.nguon || product.source || '').toLowerCase().includes('đối tác')
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
            "Tình Trạng Máy": product.tinh_trang
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
      imei_initial: p.imei || '',
      imei_confirmed: (p.imei ? true : false) as any,
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
  const isWarrantyEligible = (item: CartItem): boolean => {
    if (item.type !== 'product') return false
    const isPartner = String(item.nguon || item.source || '').toLowerCase().includes('đối tác')
    const isIpad = String(item.ten_san_pham || '').toLowerCase().includes('ipad') || String(item.loai_may || '').toLowerCase().includes('ipad')
    if (isIpad) {
      const hasId = !!(item.imei || item.serial)
      if (!hasId) return false
      if (isPartner && item.imei && !(item as any).imei_confirmed && !(item as any).imei_initial) return false
      return true
    }
    if (!isPartner) return !!item.imei
    return !!(item.imei && (((item as any).imei_confirmed) || ((item as any).imei_initial)))
  }
  const tongTien = cart.reduce((sum, item) => sum + item.gia_ban * item.so_luong, 0)
  const thanhToan = tongTien - giamGia // (chưa cộng phí bảo hành)
  const warrantyTotal = cart.reduce((sum, i) => {
    if (!isWarrantyEligible(i)) return sum
    const key = (i.imei || i.serial || i.id) as string
    if (!key) return sum
    const code = selectedWarranties[key]
    if (!code) return sum
    const pkg = warrantyPackages.find(p => p.code === code)
    return sum + (pkg?.price || 0)
  }, 0)
  // Cơ sở tính giảm giá: tổng tiền hàng + phí bảo hành trước giảm
  const discountBase = Math.max(tongTien + warrantyTotal, 0)
  const finalThanhToan = Math.max(tongTien + warrantyTotal - giamGia, 0)
  const expectedCollect = loaiThanhToan === 'Đặt cọc' ? Math.max(Number(soTienCoc)||0, 0) : finalThanhToan
  // Tổng thanh toán ngay (không bao gồm phần góp): Tiền mặt + Chuyển khoản + Thẻ
  const immediateSum = (cashEnabled ? (cashAmount||0) : 0)
    + (transferEnabled ? (transferAmount||0) : 0)
    + (cardEnabled ? (cardAmount||0) : 0)
  // Logic trả góp: Trả trước = immediateSum. Tổng đã nhập = Trả trước + Góp (không cộng lại Trả trước lần nữa)
  const sumPayments = Math.max(0, immediateSum + (installmentEnabled ? (installmentLoan||0) : 0))
  // Nếu có trả góp, yêu cầu Trả trước == (Tiền mặt + Chuyển khoản + Thẻ)
  const mustMatchDownPayment = !installmentEnabled || ((installmentDown||0) === immediateSum)
  const paymentParts: string[] = []
  if (cashEnabled && cashAmount>0) paymentParts.push(`Tiền mặt: ₫${cashAmount.toLocaleString('vi-VN')}`)
  if (transferEnabled && transferAmount>0) paymentParts.push(`Chuyển khoản: ₫${transferAmount.toLocaleString('vi-VN')}`)
  if (cardEnabled && cardAmount>0) paymentParts.push(`Thẻ: ₫${cardAmount.toLocaleString('vi-VN')}`)
  if (installmentEnabled && (installmentDown>0 || installmentLoan>0)) {
    const label = installmentType || 'Trả góp'
    const parts: string[] = []
    if (installmentDown>0) parts.push(`Trả trước ₫${installmentDown.toLocaleString('vi-VN')}`)
    if (installmentLoan>0) parts.push(`Góp ₫${installmentLoan.toLocaleString('vi-VN')}`)
    paymentParts.push(`${label}: ${parts.join(' + ')}`)
  }
  const paymentSummary = paymentParts.join(' | ')
  const paymentsArray = [
    cashEnabled && cashAmount>0 ? { method: 'Tiền mặt', amount: cashAmount } : null,
    transferEnabled && transferAmount>0 ? { method: 'Chuyển khoản', amount: transferAmount } : null,
    cardEnabled && cardAmount>0 ? { method: 'Thẻ', amount: cardAmount } : null,
  ].filter(Boolean) as any[]
  if (installmentEnabled && (installmentDown>0 || installmentLoan>0)) {
    paymentsArray.push({ method: 'Trả góp', provider: installmentType || undefined, downPayment: installmentDown||0, loanAmount: installmentLoan||0, amount: (installmentDown||0)+(installmentLoan||0) })
  }

  // Kết quả tìm kiếm sau khi áp bộ lọc Nguồn/Loại, dùng chung cho mobile cards + desktop table
  const filteredSearchResults = useMemo(() => {
    const isIpad = (p: any) => {
      const name = String(p.ten_san_pham || '').toLowerCase()
      const loai = String(p.loai_may || p['Loại Máy'] || '').toLowerCase()
      return name.includes('ipad') || loai.includes('ipad')
    }
    return searchResults.filter((p: any) => {
      const src = String(p.nguon || p.source || '').toLowerCase()
      if (filterSource==='inhouse' && src.includes('đối tác')) return false
      if (filterSource==='partner' && !src.includes('đối tác')) return false
      const isAccessory = (p.type === 'accessory') || (!!p.loai_phu_kien && !p.imei && !p.serial)
      if (filterType==='iphone') {
        if (isAccessory) return false
        if (isIpad(p)) return false
      }
      if (filterType==='ipad') {
        if (!isIpad(p)) return false
      }
      if (filterType==='accessory' && !isAccessory) return false
      return true
    })
  }, [searchResults, filterSource, filterType])

  // Sort results based on column and order
  const sortedSearchResults = useMemo(() => {
    const arr = [...filteredSearchResults]
  const isProductItem = (p: any) => (p.type === 'product') || (!!p.imei) || (!!p.serial)
  const typeRank = (p: any) => isProductItem(p) ? 0 : 1
    const getSource = (p: any) => String(p.nguon || p.source || '').toLowerCase().includes('đối tác') ? 'Đối tác' : 'Trong kho'
    const getGia = (p: any) => (typeof p.gia_ban === 'number' ? p.gia_ban : 0)
    const getTrangThai = (p: any) => p.trang_thai || 'Còn hàng'
    const getImeiLoai = (p: any) => (p.imei ? String(p.imei) : (p.serial ? String(p.serial) : String(p.loai_phu_kien || '-')))
    const getTen = (p: any) => String(p.ten_san_pham || '')
    const cmp = (a: any, b: any) => {
  const typeDiff = typeRank(a) - typeRank(b)
      if (typeDiff !== 0) return typeDiff
      let va: any = ''
      let vb: any = ''
      switch (sortKey) {
        case 'san_pham': va = getTen(a); vb = getTen(b); break
        case 'imei_loai': va = getImeiLoai(a); vb = getImeiLoai(b); break
        case 'nguon': va = getSource(a); vb = getSource(b); break
        case 'trang_thai': va = getTrangThai(a); vb = getTrangThai(b); break
        case 'gia': va = getGia(a); vb = getGia(b); break
      }
      if (typeof va === 'string' && typeof vb === 'string') {
        va = va.toLowerCase(); vb = vb.toLowerCase()
        if (va < vb) return -1
        if (va > vb) return 1
        return 0
      }
      return (va as number) - (vb as number)
    }
    arr.sort((a,b) => sortOrder==='asc' ? cmp(a,b) : cmp(b,a))
    return arr
  }, [filteredSearchResults, sortKey, sortOrder])

  function toggleSort(k: SortKey){
    if (sortKey === k) setSortOrder(prev => prev==='asc' ? 'desc' : 'asc')
    else { setSortKey(k); setSortOrder('asc') }
  }

  // Ensure selected row is visible on keyboard navigation
  useEffect(() => {
    if (selectedIndex < 0) return
    const el = tableContainerRef.current?.querySelector(`[data-index="${selectedIndex}"]`) as HTMLElement | null
    if (el) el.scrollIntoView({ block: 'nearest' })
  }, [selectedIndex])

  // highlight helper for search terms
  function escapeRegExp(str: string){
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  }
  function highlight(text: string, q: string){
    const s = (q || '').trim()
    if (!s) return text
    try {
      const re = new RegExp(`(${escapeRegExp(s)})`, 'ig')
      const parts = text.split(re)
      return parts.map((p, i) => re.test(p) ? <mark key={i} className="bg-yellow-100 rounded px-0.5">{p}</mark> : <span key={i}>{p}</span>)
    } catch {
      return text
    }
  }

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
    // Quy tắc: Nếu có trả góp, Trả trước phải bằng tổng thanh toán ngay (Tiền mặt + Chuyển khoản + Thẻ)
    if (installmentEnabled && ((installmentDown||0) !== ((cashEnabled ? (cashAmount||0) : 0) + (transferEnabled ? (transferAmount||0) : 0) + (cardEnabled ? (cardAmount||0) : 0)))) {
      const immediate = (cashEnabled ? (cashAmount||0) : 0) + (transferEnabled ? (transferAmount||0) : 0) + (cardEnabled ? (cardAmount||0) : 0)
      toast({
        title: 'Trả trước chưa khớp',
        description: `Trả trước ₫${(installmentDown||0).toLocaleString('vi-VN')} phải bằng tổng Tiền mặt + Chuyển khoản + Thẻ: ₫${immediate.toLocaleString('vi-VN')}`,
        variant: 'destructive' as any
      })
      try { setMobileView('thanh-toan') } catch {}
      return
    }
    // Validate tổng tiền phải khớp tổng phương thức thanh toán
    const expected = expectedCollect
    if (Math.abs(sumPayments - expected) > 0) {
      toast({ title: 'Tổng phương thức thanh toán không khớp', description: `Cần thu: ₫${expected.toLocaleString('vi-VN')} • Đã nhập: ₫${sumPayments.toLocaleString('vi-VN')}`, variant: 'destructive' as any })
      try { setMobileView('thanh-toan') } catch {}
      return
    }
    // YÊU CẦU IMEI CHO MÁY ĐỐI TÁC CHỈ KHI THANH TOÁN ĐỦ (không áp cho Đặt cọc)
    if (loaiThanhToan !== 'Đặt cọc') {
      const partnerMissingImei = cart.some(
        (i) => i.type === 'product' && !i.imei && !i.serial && String(i.nguon || i.source || '').toLowerCase().includes('đối tác')
      )
      if (partnerMissingImei) {
        toast({
          title: 'Thiếu mã máy cho máy đối tác',
          description: 'Vui lòng nhập IMEI hoặc Serial cho máy nguồn Đối tác trước khi xuất đơn.',
          variant: 'destructive' as any,
        })
        try { setMobileView('gio-hang') } catch {}
        return
      }
    }
    setIsLoading(true)
    try {
      const products = cart.filter((i) => i.type === "product")
      const accessories = cart.filter((i) => i.type === "accessory")
      const giaNhapPhuKien = accessories.reduce((s, i) => s + (i.gia_nhap || 0) * i.so_luong, 0);
      let employeeId = "";
      if (typeof window !== "undefined") {
        employeeId = localStorage.getItem("employeeId") || "";
      }

      if (loaiThanhToan === "Đặt cọc") {
        // Flow Đặt cọc: chỉ đổi trạng thái → 'Đã đặt cọc' (hàng nội bộ), KHÔNG xóa khỏi kho, ghi vào sheet Đặt Cọc
        try {
          const internalImeis = products
            .filter(p => !String(p.nguon || p.source || '').toLowerCase().includes('đối tác'))
            .map(p => p.imei || p.serial || p.id)
          if (internalImeis.length > 0) {
            const resStatus = await fetch("/api/update-product-status", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ productIds: internalImeis, newStatus: "Đã đặt cọc" })
            });
            if (!resStatus.ok) throw new Error("API update-product-status lỗi: " + (await resStatus.text()));
          }
        } catch (err) {
          toast({ title: 'Lỗi cập nhật trạng thái', description: String(err), variant: 'destructive' as any })
          setIsLoading(false); return;
        }
        // Ghi vào sheet Đặt Cọc
        try {
          const soTienCocNum = Math.max(0, Number(soTienCoc) || 0)
          const tongThanhToan = finalThanhToan
          const conLai = Math.max(0, tongThanhToan - soTienCocNum)
          const body = {
            ten_khach_hang: selectedCustomer?.ho_ten || "Khách lẻ",
            so_dien_thoai: selectedCustomer?.so_dien_thoai || "",
            products: products.map(p => ({
              ten_san_pham: p.ten_san_pham,
              loai_may: p.loai_may,
              dung_luong: p.dung_luong,
              pin: p.pin,
              mau_sac: p.mau_sac,
              imei: p.imei,
              serial: p.serial,
              tinh_trang_may: p.tinh_trang || p.tinh_trang_may,
              gia_ban: p.gia_ban,
              gia_nhap: p.gia_nhap,
            })),
            phu_kien: accessories.length
              ? accessories
                  .map(pk => {
                    const typePrefix = pk.loai_phu_kien ? pk.loai_phu_kien + ' ' : ''
                    const qty = pk.so_luong && pk.so_luong > 1 ? ` x${pk.so_luong}` : ''
                    return `${typePrefix}${pk.ten_san_pham}${qty}`
                  })
                  .join(", ")
              : "",
            hinh_thuc_thanh_toan: paymentSummary,
            payments: paymentsArray,
            so_tien_coc: soTienCocNum,
            so_tien_con_lai: conLai,
            han_thanh_toan: ngayHenTraDu || "",
            nguoi_ban: employeeId,
            loai_don: "Đặt cọc",
            ngay_dat_coc: new Date().toLocaleDateString("vi-VN"),
            ghi_chu: ghiChu,
          }
          const res = await fetch("/api/dat-coc", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body)
          })
          if (!res.ok) throw new Error("API dat-coc lỗi: " + (await res.text()))
          const dc = await res.json()
          // Xóa sản phẩm khỏi kho cho hàng nội bộ ngay khi đặt cọc
          const internalImeisForDelete = products
            .filter(p => !String(p.nguon || p.source || '').toLowerCase().includes('đối tác'))
            .map(p => p.imei || p.serial || p.id)
            .filter(Boolean)
          if (internalImeisForDelete.length > 0) {
            try {
              const resDel = await fetch("/api/delete-product-from-kho", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ productIds: internalImeisForDelete })
              });
              if (!resDel.ok) throw new Error("API delete-product-from-kho lỗi: " + (await resDel.text()));
            } catch (err) {
              toast({ title: 'Lỗi xóa sản phẩm khỏi kho (đặt cọc)', description: String(err), variant: 'destructive' as any })
            }
          }
          setCart([])
          setGiamGia(0)
          setGhiChu("")
          setCurrentDepositOrderId(dc.id_don_hang || dc.id || null)
          try { localStorage.removeItem('cart_draft_v1'); localStorage.removeItem('cart_warranty_sel_v1') } catch{}
          toast({ title: 'Đặt cọc thành công', description: `Mã: ${dc.id_don_hang || dc.id || ''}` })
          setActiveTab('don-dat-coc')
          setReloadFlag(f => f + 1)
        } catch (err) {
          toast({ title: 'Lỗi tạo đơn đặt cọc', description: String(err), variant: 'destructive' as any })
        }
      } else {
        // Flow Thanh toán đủ: như cũ → đổi trạng thái 'Đã bán', xoá khỏi kho, ghi vào Ban_Hang
        // Cập nhật trạng thái sản phẩm thành 'Đã bán'
        try {
          const internalImeis = products
            .filter(p => !String(p.nguon || p.source || '').toLowerCase().includes('đối tác'))
            .map(p => p.imei || p.serial || p.id)
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
        // Xóa sản phẩm khỏi kho cho hàng nội bộ
        const internalImeisForDelete = products
          .filter(p => !String(p.nguon || p.source || '').toLowerCase().includes('đối tác'))
          .map(p => p.imei || p.serial || p.id)
          .filter(Boolean)
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
        const orderData: any = {
          "Ngày Xuất": new Date().toLocaleDateString("vi-VN"),
          "Tên Khách Hàng": selectedCustomer?.ho_ten || "Khách lẻ",
          "Số Điện Thoại": selectedCustomer?.so_dien_thoai || "",
          "Phụ Kiện": accessories.length
            ? accessories
                .map(pk => {
                  const typePrefix = pk.loai_phu_kien ? pk.loai_phu_kien + ' ' : ''
                  const qty = pk.so_luong && pk.so_luong > 1 ? ` x${pk.so_luong}` : ''
                  return `${typePrefix}${pk.ten_san_pham}${qty}`
                })
                .join(", ")
            : "",
          // Giá Bán & Thanh Toan (cốt lõi) chỉ phản ánh tiền hàng sau giảm giá (không gồm bảo hành)
          "Giá Bán": thanhToan,
          "Thanh Toan": thanhToan,
          "Giá Nhập": products.reduce((s, p) => s + (p.gia_nhap || 0), 0) + giaNhapPhuKien,
          "Hình Thức Thanh Toán": paymentSummary,
          "Người Bán": employeeId,
          "Loại Đơn": loaiDon,
          "Hình Thức Vận Chuyển": loaiDon === "Đơn onl" ? hinhThucVanChuyen : "",
          "Lãi": "",
          "Ghi Chú": ghiChu,
          "Giảm Giá": giamGia,
          products: products.map(p => ({
            id: p.id,
            ten_san_pham: p.ten_san_pham,
            loai_may: p.loai_may,
            dung_luong: p.dung_luong,
            imei: p.imei,
            serial: p.serial,
            mau_sac: p.mau_sac,
            pin: p.pin,
            tinh_trang_may: p.tinh_trang,
            gia_ban: p.gia_ban,
            gia_nhap: p.gia_nhap,
            so_luong: p.so_luong,
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
            loai: i.loai_phu_kien || i.loai || '',
            gia_ban: i.gia_ban,
            gia_nhap: i.gia_nhap,
            so_luong: i.so_luong
          }))
        }
        try {
          const res = await fetch("/api/ban-hang", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              ...orderData,
              nguon_hang: products.some(p => String(p.nguon || p.source || '').toLowerCase().includes('đối tác')) ? 'Đối tác' : '',
              coreTotal: thanhToan,
              warrantyTotal: warrantyTotal,
              finalThanhToan: finalThanhToan,
              hinh_thuc_thanh_toan: paymentSummary,
              payments: paymentsArray,
              // Thông tin giao hàng (đơn online)
              dia_chi_nhan: loaiDon === 'Đơn onl' ? diaChiNhan : '',
              "Địa Chỉ Nhận": loaiDon === 'Đơn onl' ? diaChiNhan : '',
              khach_hang: {
                ten: selectedCustomer?.ho_ten || 'Khách lẻ',
                so_dien_thoai: selectedCustomer?.so_dien_thoai || '',
                dia_chi: loaiDon === 'Đơn onl' ? diaChiNhan : ''
              },
              warrantySelections: cart
                .filter(i => i.type==='product' && selectedWarranties[(i.imei || i.serial || i.id) as string])
                .map(i => ({ imei: i.imei || '', serial: i.serial || '', packageCode: selectedWarranties[(i.imei || i.serial || i.id) as string] as string }))
            })
          });
          if (!res.ok) throw new Error("API ban-hang lỗi: " + (await res.text()));
          const order = await res.json();
          setCart([]);
          setSelectedCustomer(null);
          setGiamGia(0);
          setGhiChu("");
          setDiaChiNhan("");
          // Reset payment inputs
          setCashAmount(0); setTransferAmount(0); setCardAmount(0);
          setInstallmentEnabled(false); setInstallmentType(''); setInstallmentDown(0); setInstallmentLoan(0);
          // Nếu là tiếp tục thanh toán từ đơn đặt cọc, cập nhật trạng thái đơn đặt cọc
          try {
            if (currentDepositOrderId) {
              await fetch('/api/dat-coc', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ orderId: currentDepositOrderId, newStatus: 'Đã thanh toán' })
              })
            }
          } catch {}
          setCurrentDepositOrderId(null)
          toast({ title: 'Tạo đơn thành công', description: `Mã: ${order.id_don_hang || order.ma_don_hang || ''}` })
          try { localStorage.removeItem('cart_draft_v1'); localStorage.removeItem('cart_warranty_sel_v1') } catch{}
          setReloadFlag(f => f + 1);
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
  const depositOrders = (depositOrdersState.length > 0
    ? depositOrdersState
    : orders.filter(
        (o) => o.trang_thai === "Chờ thanh toán đủ" || o.loai_don === "Đặt cọc"
      )
  ).filter(
    (o) => {
      // Trạng thái có thể là "Đã thanh toán" hoặc "Đã tất toán" hoặc các biến thể
      const status = (o["Trạng Thái"] || o["trang_thai"] || o["Trạng thái"] || o["status"] || "").toLowerCase();
      return status !== "đã thanh toán" && status !== "đã tất toán";
    }
  );

  // Hủy đặt cọc: trả sản phẩm về kho + xóa khỏi sheet đặt cọc
  const [cancelingDepositId, setCancelingDepositId] = useState<string|null>(null)
  const handleCancelDeposit = async (maDon: string) => {
    try {
      setCancelingDepositId(maDon)
      const allRows = depositOrders.filter((o: any) => {
        const m = o["Mã Đơn Hàng"] || o["ID Đơn Hàng"] || o["ma_don_hang"];
        return m === maDon;
      });
      const productIds = allRows.map((o: any) => o["IMEI"] || o["Serial"] || o["ID Máy"] || o["imei"] || o["serial"] || o["id"]).filter(Boolean);
      if (productIds.length === 0) {
        toast({ title: 'Không tìm thấy mã máy để hủy đặt cọc', variant: 'destructive' as any })
        return
      }
      await fetch("/api/update-product-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productIds, newStatus: "Còn hàng" })
      });
      await fetch("/api/kho-hang", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ products: allRows })
      });
      await fetch("/api/dat-coc", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId: maDon, newStatus: "Hủy đặt cọc" })
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
            <TabsTrigger
              value="ban-hang"
              className="data-[state=active]:bg-blue-100 data-[state=active]:text-blue-700 data-[state=active]:border-blue-500 focus-visible:ring-2 focus-visible:ring-blue-500"
            >
              Bán hàng
            </TabsTrigger>
            <TabsTrigger
              value="don-dat-coc"
              className="relative data-[state=active]:bg-blue-100 data-[state=active]:text-blue-700 data-[state=active]:border-blue-500 focus-visible:ring-2 focus-visible:ring-blue-500"
            >
              <span>Đơn đặt cọc</span>
              {depositOrderCount > 0 && (
                <span
                  className="ml-2 inline-flex items-center justify-center min-w-5 h-5 px-1.5 rounded-full text-[11px] font-semibold bg-blue-600 text-white"
                  aria-label={`Tổng ${depositOrderCount} đơn đặt cọc`}
                >
                  {depositOrderCount}
                </span>
              )}
            </TabsTrigger>
          </TabsList>

          {/* Tab bán hàng */}
          <TabsContent value="ban-hang">
            <TabsContent value="ban-hang">
  {/* Thanh điều hướng luồng mobile: Sản phẩm / Giỏ hàng / Thanh toán */}
  {isMobile && (
    <div className="sticky top-0 z-10 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80 border-b px-4 py-2 flex gap-2">
      <Button
        size="sm"
        variant={mobileView==='san-pham'? 'default':'outline'}
        className={`flex-1 ${mobileView==='san-pham' ? 'bg-blue-600 text-white hover:bg-blue-700' : 'hover:text-blue-700 hover:border-blue-300 active:bg-blue-50'}`}
        onClick={()=> setMobileView('san-pham')}
      >Sản phẩm</Button>
      <Button
        size="sm"
        variant={mobileView==='gio-hang'? 'default':'outline'}
        className={`flex-1 ${mobileView==='gio-hang' ? 'bg-blue-600 text-white hover:bg-blue-700' : 'hover:text-blue-700 hover:border-blue-300 active:bg-blue-50'}`}
        onClick={()=> setMobileView('gio-hang')}
      >Giỏ hàng ({cart.length})</Button>
      <Button
        size="sm"
        variant={mobileView==='thanh-toan'? 'default':'outline'}
        className={`flex-1 ${mobileView==='thanh-toan' ? 'bg-blue-600 text-white hover:bg-blue-700' : 'hover:text-blue-700 hover:border-blue-300 active:bg-blue-50'}`}
        onClick={()=> setMobileView('thanh-toan')}
      >Thanh toán</Button>
    </div>
  )}
  <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,2.25fr)_minmax(0,0.75fr)] gap-6 items-start">
    {/* Tìm kiếm và thêm sản phẩm */}
    <div className="flex flex-col gap-6">
      {(!isMobile || mobileView==='san-pham') && (
  <Card className="min-h-[220px] h-full flex flex-col overflow-hidden lg:h-[600px]" >
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
              onKeyDown={(e)=>{
                const n = sortedSearchResults.length
                if (e.key === 'ArrowDown') { e.preventDefault(); setSelectedIndex(prev => Math.min(prev < 0 ? 0 : prev + 1, n - 1)) }
                else if (e.key === 'ArrowUp') { e.preventDefault(); setSelectedIndex(prev => Math.max(prev - 1, -1)) }
                else if (e.key === 'Enter') {
                  if (selectedIndex >= 0 && sortedSearchResults[selectedIndex]) {
                    addToCart(sortedSearchResults[selectedIndex]); setSelectedIndex(-1)
                  } else if (n === 1) { addToCart(sortedSearchResults[0]) }
                }
              }}
            />
          </div>

            {/* Bộ lọc nhanh: Nguồn & Loại */}
            <div className="flex flex-wrap items-center gap-2 mb-3">
              <div className="flex items-center gap-1">
                <span className="text-xs text-slate-500 mr-1">Nguồn:</span>
                <Button size="sm" variant={filterSource==='all'?'default':'outline'}
                  className={filterSource==='all' ? 'bg-blue-600 text-white hover:bg-blue-700' : 'hover:text-blue-700 hover:border-blue-300 active:bg-blue-50'}
                  onClick={()=> setFilterSource('all')}>Tất cả</Button>
                <Button size="sm" variant={filterSource==='inhouse'?'default':'outline'}
                  className={filterSource==='inhouse' ? 'bg-blue-600 text-white hover:bg-blue-700' : 'hover:text-blue-700 hover:border-blue-300 active:bg-blue-50'}
                  onClick={()=> setFilterSource('inhouse')}>Trong kho</Button>
                <Button size="sm" variant={filterSource==='partner'?'default':'outline'}
                  className={filterSource==='partner' ? 'bg-blue-600 text-white hover:bg-blue-700' : 'hover:text-blue-700 hover:border-blue-300 active:bg-blue-50'}
                  onClick={()=> setFilterSource('partner')}>Đối tác</Button>
              </div>
              <div className="flex items-center gap-1">
                <span className="text-xs text-slate-500 mr-1">Loại:</span>
                <Button size="sm" variant={filterType==='all'?'default':'outline'}
                  className={filterType==='all' ? 'bg-blue-600 text-white hover:bg-blue-700' : 'hover:text-blue-700 hover:border-blue-300 active:bg-blue-50'}
                  onClick={()=> setFilterType('all')}>Tất cả</Button>
                <Button size="sm" variant={filterType==='iphone'?'default':'outline'}
                  className={filterType==='iphone' ? 'bg-blue-600 text-white hover:bg-blue-700' : 'hover:text-blue-700 hover:border-blue-300 active:bg-blue-50'}
                  onClick={()=> setFilterType('iphone')}>iPhone</Button>
                <Button size="sm" variant={filterType==='ipad'?'default':'outline'}
                  className={filterType==='ipad' ? 'bg-blue-600 text-white hover:bg-blue-700' : 'hover:text-blue-700 hover:border-blue-300 active:bg-blue-50'}
                  onClick={()=> setFilterType('ipad')}>iPad</Button>
                <Button size="sm" variant={filterType==='accessory'?'default':'outline'}
                  className={filterType==='accessory' ? 'bg-blue-600 text-white hover:bg-blue-700' : 'hover:text-blue-700 hover:border-blue-300 active:bg-blue-50'}
                  onClick={()=> setFilterType('accessory')}>Phụ kiện</Button>
              </div>
            </div>

          <div className="flex-1 overflow-y-hidden min-h-0">
          {(isSearching || searchResults.length > 0) && (
            <>
              {/* Mobile: Card grid */}
              <div className="md:hidden mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[60vh] overflow-y-auto overflow-x-hidden rounded-lg border mb-4 p-3 pb-20 min-h-0">
                {sortedSearchResults.map((product: any) => {
                  const isDisabled = product.trang_thai === "Đã đặt cọc" || product.trang_thai === "Đã bán";
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
                      onClick={() => { if (!isDisabled) { addToCart(product); try { (navigator as any).vibrate && navigator.vibrate(10) } catch {} } }}
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
                            <Badge variant="outline">{isAccessoryItem ? 'Phụ kiện' : 'iPhone'}</Badge>
                            {String(product.nguon || product.source || '').toLowerCase().includes('đối tác') && (
                              <Badge variant="outline" className="border-teal-600 text-teal-700">Đối tác</Badge>
                            )}
                            {String(product.ghi_chu || '').toLowerCase().includes('sale') && (
                              <Badge variant="outline" className="border-red-600 text-red-700">Sale</Badge>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="mt-2 text-sm text-muted-foreground">
                        {!isAccessoryItem ? (
                          <>
                            {product.loai_may && <div>Loại máy: <span className="text-slate-800">{product.loai_may}</span></div>}
                            {hasPin && <div>Pin: <span className="text-slate-800">{formattedPin}</span></div>}
                            {tinhTrang && <div>Tình trạng: <span className="text-slate-800">{tinhTrang}</span></div>}
                            {(product.imei || product.serial) && (
                              <div>{product.imei ? 'IMEI' : 'Serial'}: <span className="font-mono text-slate-800">{product.imei || product.serial}</span></div>
                            )}
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
                      <div className="absolute bottom-3 right-3 text-right font-semibold">
                        {typeof product.gia_ban === 'number' && product.gia_ban > 0
                          ? `₫${product.gia_ban.toLocaleString()}`
                          : <span className="text-slate-500 italic">Liên hệ</span>}
                      </div>
                    </div>
                  );
                })}
                <div className="h-1" />
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
                      <TableHead className="w-[30%]">
                        <button className="flex items-center gap-1" onClick={()=> toggleSort('san_pham')}>
                          Sản phẩm {sortKey==='san_pham' && <span>{sortOrder==='asc'?'▲':'▼'}</span>}
                        </button>
                      </TableHead>
                      <TableHead className="w-[14%]">Ghi chú</TableHead>
                      <TableHead className="w-[20%]">
                        <button className="flex items-center gap-1" onClick={()=> toggleSort('imei_loai')}>
                          IMEI/Serial / Loại {sortKey==='imei_loai' && <span>{sortOrder==='asc'?'▲':'▼'}</span>}
                        </button>
                      </TableHead>
                      <TableHead className="w-[28%] text-center">Chi tiết</TableHead>
                      <TableHead className="w-[12%]">
                        <button className="flex items-center gap-1" onClick={()=> toggleSort('trang_thai')}>
                          Trạng thái {sortKey==='trang_thai' && <span>{sortOrder==='asc'?'▲':'▼'}</span>}
                        </button>
                      </TableHead>
                      <TableHead className="text-right">
                        <button className="flex items-center gap-1 ml-auto" onClick={()=> toggleSort('gia')}>
                          Giá {sortKey==='gia' && <span>{sortOrder==='asc'?'▲':'▼'}</span>}
                        </button>
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {/* Skeleton loading rows */}
                    {isSearching && sortedSearchResults.length === 0 && (
                      Array.from({ length: 8 }).map((_, i) => (
                        <TableRow key={`skeleton-${i}`}>
                          <TableCell className="w-[30%]"><div className="h-4 w-3/4 bg-slate-200 rounded animate-pulse"/></TableCell>
                          <TableCell className="w-[14%]"><div className="h-4 w-16 bg-slate-200 rounded animate-pulse"/></TableCell>
                          <TableCell className="w-[20%]"><div className="h-4 w-28 bg-slate-200 rounded animate-pulse"/></TableCell>
                          <TableCell className="w-[28%]"><div className="h-4 w-48 bg-slate-200 rounded animate-pulse"/></TableCell>
                          <TableCell className="w-[12%]"><div className="h-4 w-24 bg-slate-200 rounded animate-pulse"/></TableCell>
                          <TableCell className="text-right"><div className="h-4 w-24 bg-slate-200 rounded ml-auto animate-pulse"/></TableCell>
                        </TableRow>
                      ))
                    )}
                    {sortedSearchResults.map((product: any, idx: number) => {
                      const isDisabled = product.trang_thai === 'Đã đặt cọc' || product.trang_thai === 'Đã bán'
                      const isAccessory = (product.type==='accessory') || (!!product.loai_phu_kien && !product.imei && !product.serial)
                      const source = String(product.nguon || product.source || '').toLowerCase().includes('đối tác') ? 'Đối tác' : 'Trong kho'
                      const loaiMay = product.loai_may || product['Loại Máy'] || ''
                      const rawPin = product.pin ?? product['Pin (%)']
                      const hasPin = rawPin !== undefined && rawPin !== null && String(rawPin).trim() !== ''
                      const formattedPin = !hasPin ? '' : typeof rawPin === 'number' ? `${rawPin}%` : String(rawPin)
                      const tinhTrang = product.tinh_trang || product['Tình Trạng Máy'] || product.trang_thai || ''
                      return (
                        <TableRow
                          key={`${product.id || product.imei || product.serial || product.ten_san_pham}`}
                          data-index={idx}
                          className={`${isDisabled ? 'opacity-60' : 'cursor-pointer hover:bg-blue-50/50 active:bg-blue-50'} ${idx===selectedIndex ? 'bg-blue-50' : ''} ${justAddedKey === (product.id || product.imei || product.serial) ? 'animate-pulse bg-green-50' : ''} odd:bg-slate-50/30`}
                          onClick={() => { if (!isDisabled) { addToCart(product); setJustAddedKey(product.id || product.imei || product.serial || null); setTimeout(()=> setJustAddedKey(null), 500); } }}
                        >
                          <TableCell className="px-3 py-2">
                            <div className="font-medium line-clamp-2">
                              {highlight(product.ten_san_pham || '[Chưa có tên sản phẩm]', searchQuery)}
                              {product.dung_luong ? ` - ${product.dung_luong}` : ''}
                              {product.mau_sac ? ` - ${product.mau_sac}` : ''}
                            </div>
                            <div className="mt-1 flex items-center gap-2 text-xs">
                              <Badge variant="outline">{isAccessory ? 'Phụ kiện' : ((String(product.ten_san_pham||'').toLowerCase().includes('ipad') || String(product.loai_may||'').toLowerCase().includes('ipad')) ? 'iPad' : 'iPhone')}</Badge>
                              {source === 'Đối tác' && <Badge variant="outline" className="border-teal-600 text-teal-700" title={`${product.ten_doi_tac || ''}${product.ten_doi_tac && product.sdt_doi_tac ? ' • ' : ''}${product.sdt_doi_tac || ''}`.trim() || 'Đối tác'}>Đối tác</Badge>}
                            </div>
                          </TableCell>
                          <TableCell className="px-3 py-2 text-xs align-top">
                            {(() => {
                              const note = String(product.ghi_chu || '').trim()
                              const isSale = /sale/i.test(note)
                              if (!note) return <span className="text-slate-400">-</span>
                              if (isSale) return <Badge className="bg-red-100 text-red-700">Sale</Badge>
                              return <span className="text-slate-700">{note}</span>
                            })()}
                          </TableCell>
                          <TableCell className="font-mono text-xs px-3 py-2">
                            {(product.imei || product.serial) ? (
                              <button
                                type="button"
                                onClick={async (e) => { e.stopPropagation(); const v = product.imei || product.serial; try { await navigator.clipboard.writeText(v) } catch {}; setCopiedImei(v); toast({ title: product.imei ? 'Đã sao chép IMEI' : 'Đã sao chép Serial', description: v }); setTimeout(()=> setCopiedImei(null), 1000) }}
                                className="inline-flex items-center gap-1 underline decoration-dotted hover:text-blue-700"
                                title="Click để sao chép IMEI/Serial"
                              >
                                <Copy className="h-3 w-3"/>
                                {copiedImei === (product.imei || product.serial) ? 'Đã sao chép' : highlight(String(product.imei || product.serial), searchQuery)}
                              </button>
                            ) : (
                              <span>{highlight(String(product.loai_phu_kien || '-'), searchQuery)}</span>
                            )}
                          </TableCell>
                          <TableCell className="px-3 py-2 text-xs md:text-center">
                            {isAccessory ? (
                              <div className="flex items-center gap-3 justify-start md:justify-center">
                                {typeof product.so_luong_ton !== 'undefined' && (
                                  <span className="text-slate-500">Tồn: <span className="text-slate-700 font-medium">{product.so_luong_ton}</span></span>
                                )}
                              </div>
                            ) : (
                              <div className="grid items-center gap-2 text-slate-700 overflow-hidden md:text-center" style={{gridTemplateColumns: '84px 110px minmax(0,1fr)'}}>
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 whitespace-nowrap md:justify-self-center">
                                  {String(loaiMay || '').toLowerCase().includes('lock') ? <Lock className="h-3 w-3"/> : <Globe className="h-3 w-3"/>}
                                  {highlight(String(loaiMay || '-'), searchQuery)}
                                </span>
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 whitespace-nowrap md:justify-self-center">
                                  <Battery className="h-3 w-3"/>
                                  {hasPin ? formattedPin : '-'}
                                </span>
                                {tinhTrang && (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 min-w-0" title={String(tinhTrang)}>
                                    <span className="truncate block">{highlight(String(tinhTrang), searchQuery)}</span>
                                  </span>
                                )}
                              </div>
                            )}
                          </TableCell>
                          <TableCell className="px-3 py-2 text-sm whitespace-nowrap">
                            <Badge className={
                              product.trang_thai === 'Đã đặt cọc' ? 'bg-orange-100 text-orange-800' :
                              product.trang_thai === 'Đã bán' ? 'bg-gray-200 text-gray-600' : 'bg-green-100 text-green-800'
                            }>
                              {product.trang_thai || 'Còn hàng'}
                            </Badge>
                          </TableCell>
                          <TableCell className="px-3 py-2 text-right text-sm font-semibold">
                            {typeof product.gia_ban === 'number' && product.gia_ban > 0 ? `₫${product.gia_ban.toLocaleString()}` : <span className="text-slate-500 italic">Liên hệ</span>}
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
          </div>
        </CardContent>
      </Card>
      )}

      {/* Giỏ hàng */}
  {(!isMobile || mobileView==='gio-hang') && (
  <Card className="min-h-[220px] h-full w-full flex flex-col lg:min-h-[360px] lg:self-stretch" >
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShoppingCart className="h-5 w-5" />
            Giỏ hàng ({cart.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col h-full">
          {cart.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-1 text-muted-foreground text-sm">
              <span>Giỏ hàng đang trống</span>
              <span className="text-xs text-slate-500">Chọn sản phẩm và bấm "Thêm" để đưa vào giỏ</span>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto space-y-3 pr-1">
              {/* Apply all warranty (4.1) */}
              {cart.filter(i=> isWarrantyEligible(i as any)).length > 1 && warrantyPackages.length>0 && (
                <div className="flex items-center gap-2 border rounded p-2 bg-slate-50">
                  <select
                    className="text-xs border rounded px-2 py-1 bg-white"
                    defaultValue=""
                    onChange={e=>{
                      const code = e.target.value || null
                      setSelectedWarranties(prev=>{
                        const next = {...prev}; cart.forEach(it=>{ if(isWarrantyEligible(it as any)){ const key = (it.imei || it.serial || it.id) as string; if (key) next[key]=code } })
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
                    onClick={()=> setSelectedWarranties(prev=>{ const next={...prev}; cart.forEach(it=>{ if(isWarrantyEligible(it as any)){ const key=(it.imei||it.serial||it.id) as string; if (key) next[key]=null } }); return next })}
                  >Xóa toàn bộ</button>
                </div>
              )}
              {/* Header cho desktop/tablet, ẩn trên mobile */}
              {/* (Đã bỏ tiêu đề: Tên SP, Thông tin, Giá, Trạng thái theo yêu cầu) */}
              {cart.map((item: CartItem) => (
                <div
                  key={`${item.type}-${item.id}`}
                  className="grid grid-cols-1 sm:grid-cols-[1.4fr_1fr_0.9fr_0.9fr_auto] gap-2 items-start sm:items-center border rounded-lg p-3 sm:p-2.5"
                >
                  <div>
                    <p className="font-medium">{item.ten_san_pham}</p>
                    {(item.imei || item.serial) && (
                      <p className="text-[11px] text-muted-foreground font-mono">{item.imei ? 'IMEI' : 'Serial'}: {item.imei || item.serial}</p>
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
                    {String(item.nguon || item.source || '').toLowerCase().includes('đối tác') && item.type==='product' && (
                      <div className="mt-1 flex items-center gap-3 flex-wrap">
                        <input
                          placeholder="Nhập IMEI hoặc Serial..."
                          className="h-7 w-56 border rounded px-2 text-[12px] font-mono"
                          defaultValue={item.imei || item.serial || ''}
                          onBlur={(e)=>{
                            const valRaw = (e.target.value || '').trim()
                            const val = valRaw.replace(/\s/g,'')
                            setCart(prev=> prev.map(p=> {
                              if (p.id===item.id && p.type===item.type) {
                                const prevId = (p.imei || p.serial || '')
                                const changed = prevId !== (val || '')
                                const next: any = { ...p, imei_confirmed: changed ? false : (p as any).imei_confirmed }
                                // simple heuristic: if all digits and length >= 10 treat as IMEI, else Serial
                                if (/^\d{10,}$/.test(val)) { next.imei = val; next.serial = '' }
                                else { next.serial = val; next.imei = '' }
                                return next
                              }
                              return p
                            }))
                          }}
                        />
                        {/* Hiệu ứng động khi xác nhận IMEI */}
                        <button
                          type="button"
                          className={`inline-flex items-center gap-1 text-[12px] ${item.imei ? 'text-slate-700' : 'text-slate-400 cursor-not-allowed'}`}
                          onClick={async ()=>{
                            if(!item.imei) return
                            setCart(prev=> prev.map(p=> (p.id===item.id && p.type===item.type) ? { ...p, imei_loading: true } : p))
                            // Nếu là hàng Đối tác và có metadata sheet/row_index thì ghi IMEI vào sheet ngay khi xác nhận
                            const isPartner = String(item.nguon || item.source || '').toLowerCase().includes('đối tác')
                            const sheet = (item as any).partner_sheet || (item as any).sheet
                            const rowIndex = (item as any).partner_row_index || (item as any).row_index
                            if (isPartner && sheet && rowIndex) {
                              try {
                                const res = await fetch('/api/doi-tac/confirm-imei', {
                                  method: 'POST',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({ sheet, row_index: Number(rowIndex), imei: item.imei, createIdMay: true })
                                })
                                if (res.ok) {
                                  const data = await res.json()
                                  // Force refresh partner list so next time we search it's up-to-date
                                  try {
                                    await fetch('/api/doi-tac/hang-order?refresh=1', { cache: 'no-store' })
                                  } catch {}
                                  setCart(prev=> prev.map(p=> {
                                    if (p.id===item.id && p.type===item.type) {
                                      const next: any = { ...p, imei_confirmed: !(p as any).imei_confirmed, imei_loading: false }
                                      if (data?.id_may) next.id_may = data.id_may
                                      return next
                                    }
                                    return p
                                  }))
                                  // Cập nhật lại kết quả tìm kiếm hiện tại để phản ánh IMEI đã có
                                  try {
                                    setSearchResults(prev => prev.map((prod: any) => {
                                      if ((prod.partner_row_index || prod.row_index) === rowIndex && (prod.partner_sheet || prod.sheet) === sheet) {
                                        return { ...prod, imei: item.imei }
                                      }
                                      return prod
                                    }))
                                  } catch {}
                                } else {
                                  const msg = await res.text()
                                  toast({ title: 'Lỗi ghi IMEI vào sheet', description: msg, variant: 'destructive' as any })
                                  setCart(prev=> prev.map(p=> (p.id===item.id && p.type===item.type) ? { ...p, imei_loading: false } : p))
                                }
                              } catch (e: any) {
                                toast({ title: 'Lỗi ghi IMEI vào sheet', description: e?.message || String(e), variant: 'destructive' as any })
                                setCart(prev=> prev.map(p=> (p.id===item.id && p.type===item.type) ? { ...p, imei_loading: false } : p))
                              }
                            } else {
                              setCart(prev=> prev.map(p=> (p.id===item.id && p.type===item.type) ? { ...p, imei_confirmed: !(p as any).imei_confirmed, imei_loading: false } : p))
                            }
                          }}
                          title={(item.imei || item.serial) ? 'Xác nhận mã máy' : 'Nhập IMEI/Serial trước'}
                          disabled={!!(item as any).imei_loading}
                        >
                          {(item as any).imei_loading ? (
                            <svg className="animate-spin h-4 w-4 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"></path></svg>
                          ) : (
                            <CheckCircle className={`h-4 w-4 ${ (item as any).imei_confirmed ? 'text-green-600' : 'text-slate-400' }`} />
                          )}
                          <span></span>
                        </button>
                      </div>
                    )}
                    {(() => {
                      if (item.type !== 'product') return false
                      const isPartner = String(item.nguon || item.source || '').toLowerCase().includes('đối tác')
                      const isIpad = String(item.ten_san_pham || '').toLowerCase().includes('ipad') || String(item.loai_may || '').toLowerCase().includes('ipad')
                      if (isIpad) {
                        const hasId = !!(item.imei || item.serial)
                        if (!hasId) return false
                        if (isPartner && item.imei && !(item as any).imei_confirmed && !(item as any).imei_initial) return false
                        return true
                      }
                      if (!isPartner) return !!item.imei
                      return !!(item.imei && (((item as any).imei_confirmed) || ((item as any).imei_initial)))
                    })() && (
                      <div className="mt-1">
                        <select
                          className="text-[11px] border rounded px-1 py-0.5 bg-white"
                          value={selectedWarranties[(item.imei || item.serial || item.id) as string] || ''}
                          onChange={e => handleSelectWarranty((item.imei || item.serial || item.id) as string, e.target.value || null)}
                        >
                          <option value="">Chọn gói bảo hành...</option>
                          {warrantyPackages.map(p => (
                            <option key={p.code} value={p.code}>{p.code}{p.hwMonths?`-${p.hwMonths}T`:''}{p.lifetime?'(Life)':''}</option>
                          ))}
                        </select>
                        {selectedWarranties[(item.imei || item.serial || item.id) as string] && (
                          <button
                            type="button"
                            className="ml-2 text-[11px] underline text-blue-600"
                            onClick={() => {
                              const key=(item.imei||item.serial||item.id) as string
                              if(!key) return
                              setOpenWarrantyInfo(openWarrantyInfo===key ? null : key)
                            }}
                          >Chi tiết</button>
                        )}
                        {(() => { const key=(item.imei||item.serial||item.id) as string; return openWarrantyInfo===key && selectedWarranties[key] })() && (
                          <div className="mt-1 p-2 rounded border bg-slate-50 text-[11px] space-y-0.5">
                            {(() => {
                              const key=(item.imei||item.serial||item.id) as string
                              const sel = selectedWarranties[key] as string
                              const pkg = warrantyPackages.find(p=>p.code===sel)
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
                  <div className="text-[11px] text-muted-foreground space-y-1 hidden sm:block">
                    {item.type === 'accessory' ? (
                      <>
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
                        {!item.loai_phu_kien && !item.mau_sac && <div>-</div>}
                      </>
                    ) : (
                      <>
                        {item.loai_may && <div>Loại: <span className="text-slate-700">{item.loai_may}</span></div>}
                        {item.pin && <div>Pin: <span className="text-slate-700">{item.pin}</span></div>}
                        {item.tinh_trang && <div>Tình trạng: <span className="text-slate-700">{item.tinh_trang}</span></div>}
                        {!item.loai_may && !item.pin && !item.tinh_trang && <div>-</div>}
                      </>
                    )}
                  </div>
                  {/* Giá: cho mobile đặt ngay dưới tên SP bằng flex-wrap; Desktop vẫn ở cột riêng */}
                  <div className="font-semibold flex items-center gap-1 tabular-nums text-left sm:text-center sm:justify-center sm:justify-self-center">
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
                  <div className="text-left sm:text-center sm:justify-self-center">
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
  <div className="space-y-6 lg:max-w-[520px]">
  {/* Khách hàng */}
  <Card className="min-h-[80px] flex flex-col" >
        <CardHeader>
          <CardTitle>Khách hàng</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
              {customerResults.length > 0 && (
            <div className="border rounded bg-white max-h-56 overflow-y-auto">
              {customerResults.map((kh: Customer & { isDeposit?: boolean }) => (
                <div
                  key={kh.id}
                      className={`flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-blue-50 active:bg-blue-100 ${
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
            <div className="p-3 border rounded-lg bg-white">
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
              className="flex-1 bg-white"
              onClick={() => setIsCustomerSelectOpen(true)}
            >
              <User className="mr-2 h-4 w-4" />
              Chọn khách hàng
            </Button>
            {/* Bỏ nút '+' tạo nhanh: việc tạo sẽ xuất hiện trong dialog khi không tìm thấy SĐT */}
          </div>
        </CardContent>
      </Card>

  {/* Thanh toán */}
  <Card className="flex flex-col" >
        <CardHeader>
          <CardTitle>Thanh toán</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Phương thức thanh toán</label>
            <div className="grid grid-cols-1 gap-2">
              {/* Each row uses a fixed label column (w-28) and a flexible input column to keep fields aligned */}
              <div className="flex items-center gap-3">
                <label className="inline-flex items-center gap-2 select-none w-28">
                  <input
                    type="checkbox"
                    className="h-4 w-4 appearance-none rounded-full border border-slate-400 bg-white checked:bg-blue-600 checked:border-blue-600 transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1"
                    checked={cashEnabled}
                    onChange={(e)=> { setCashEnabled(e.target.checked); if (!e.target.checked) setCashAmount(0) }}
                    aria-label="Tiền mặt"
                  />
                  <span className="text-sm">Tiền mặt</span>
                </label>
                <div className="flex-1">
                  {cashEnabled && (
                    <Input
                      placeholder="₫0"
                      value={cashAmount ? cashAmount.toLocaleString('vi-VN') : ''}
                      onChange={(e)=> setCashAmount(Number(e.target.value.replace(/[^\d]/g,''))||0)}
                      className="bg-white"
                    />
                  )}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <label className="inline-flex items-center gap-2 select-none w-28">
                  <input
                    type="checkbox"
                    className="h-4 w-4 appearance-none rounded-full border border-slate-400 bg-white checked:bg-blue-600 checked:border-blue-600 transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1"
                    checked={transferEnabled}
                    onChange={(e)=> { setTransferEnabled(e.target.checked); if (!e.target.checked) setTransferAmount(0) }}
                    aria-label="Chuyển khoản"
                  />
                  <span className="text-sm">Chuyển khoản</span>
                </label>
                <div className="flex-1">
                  {transferEnabled && (
                    <Input
                      placeholder="₫0"
                      value={transferAmount ? transferAmount.toLocaleString('vi-VN') : ''}
                      onChange={(e)=> setTransferAmount(Number(e.target.value.replace(/[^\d]/g,''))||0)}
                      className="bg-white"
                    />
                  )}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <label className="inline-flex items-center gap-2 select-none w-28">
                  <input
                    type="checkbox"
                    className="h-4 w-4 appearance-none rounded-full border border-slate-400 bg-white checked:bg-blue-600 checked:border-blue-600 transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1"
                    checked={cardEnabled}
                    onChange={(e)=> { setCardEnabled(e.target.checked); if (!e.target.checked) setCardAmount(0) }}
                    aria-label="Thẻ"
                  />
                  <span className="text-sm">Thẻ</span>
                </label>
                <div className="flex-1">
                  {cardEnabled && (
                    <Input
                      placeholder="₫0"
                      value={cardAmount ? cardAmount.toLocaleString('vi-VN') : ''}
                      onChange={(e)=> setCardAmount(Number(e.target.value.replace(/[^\d]/g,''))||0)}
                      className="bg-white"
                    />
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <label className="inline-flex items-center gap-2 select-none w-28">
                  <input
                    type="checkbox"
                    className="h-4 w-4 appearance-none rounded-full border border-slate-400 bg-white checked:bg-blue-600 checked:border-blue-600 transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1"
                    checked={installmentEnabled}
                    onChange={(e)=> setInstallmentEnabled(e.target.checked)}
                    aria-label="Trả góp"
                  />
                  <span className="text-sm">Trả góp</span>
                </label>
                <div className="flex-1">
                  {installmentEnabled && (
                    <Select value={installmentType} onValueChange={(v:any)=> setInstallmentType(v)}>
                      <SelectTrigger className="bg-white w-44"><SelectValue placeholder="Chọn loại"/></SelectTrigger>
                      <SelectContent className="bg-white">
                        <SelectItem value="Góp iCloud">Góp iCloud</SelectItem>
                        <SelectItem value="Thẻ tín dụng">Thẻ tín dụng</SelectItem>
                        <SelectItem value="Mira">Mira</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                </div>
              </div>
              {installmentEnabled && (
                <div className="grid grid-cols-1 gap-2">
                  <div className="flex items-center gap-3">
                    <span className="w-28 text-sm text-slate-600">Trả trước</span>
                    <div className="flex-1">
                      <Input
                        placeholder="₫0"
                        value={installmentDown ? installmentDown.toLocaleString('vi-VN') : ''}
                        onChange={(e)=> setInstallmentDown(Number(e.target.value.replace(/[^\d]/g,''))||0)}
                        className="bg-white"
                      />
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="w-28 text-sm text-slate-600">Góp</span>
                    <div className="flex-1">
                      <Input
                        placeholder="₫0"
                        value={installmentLoan ? installmentLoan.toLocaleString('vi-VN') : ''}
                        onChange={(e)=> setInstallmentLoan(Number(e.target.value.replace(/[^\d]/g,''))||0)}
                        className="bg-white"
                      />
                    </div>
                  </div>
                </div>
              )}
              <div className="text-xs text-slate-600">
                <div className="mt-1">
                  Tổng đã nhập: <span className="font-semibold">₫{sumPayments.toLocaleString('vi-VN')}</span> • Cần thu: <span className="font-semibold">₫{expectedCollect.toLocaleString('vi-VN')}</span>
                  {sumPayments !== expectedCollect && (
                    <span className="ml-2 text-red-600">(chưa khớp – vui lòng điều chỉnh)</span>
                  )}
                  {installmentEnabled && !mustMatchDownPayment && (
                    <div className="text-red-600 text-xs mt-1">
                      Trả trước phải bằng tổng Tiền mặt + Chuyển khoản + Thẻ (hiện tại: Trả trước ₫{(installmentDown||0).toLocaleString('vi-VN')} ≠ Thanh toán ngay ₫{immediateSum.toLocaleString('vi-VN')})
                    </div>
                  )}
                </div>
              </div>
              {paymentSummary && (
                <div className="text-xs text-slate-500">Tổng hợp: {paymentSummary}</div>
              )}
            </div>
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
            {cart.some(i=>i.type==='product') && !Object.values(selectedWarranties).some(Boolean) && (
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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Select value={loaiDon} onValueChange={setLoaiDon}>
              <SelectTrigger className="bg-white">
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
                <SelectTrigger className="bg-white">
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

          {loaiDon === "Đơn onl" && (
            <div className="space-y-2 mt-2">
              <label className="text-sm font-medium">Địa chỉ nhận</label>
              <Input
                placeholder="Số nhà, đường, phường/xã, quận/huyện, tỉnh/thành phố"
                value={diaChiNhan}
                onChange={(e)=> setDiaChiNhan(e.target.value)}
                className="bg-white"
              />
            </div>
          )}

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
                              id: o["IMEI"] || o["Serial"] || o["ID Máy"] || o["Tên Sản Phẩm"] || o["ten_san_pham"] || o["imei"] || o["serial"] || o["id"],
                              type: "product",
                              ten_san_pham: o["Tên Sản Phẩm"] || o["ten_san_pham"] || "",
                              gia_ban: typeof o["Giá Bán"] === "string" ? parseInt(o["Giá Bán"].replace(/[^\d]/g, "")) || 0 : o["Giá Bán"] || 0,
                              gia_nhap: typeof o["Giá Nhập"] === "string" ? parseInt(o["Giá Nhập"].replace(/[^\d]/g, "")) || 0 : o["Giá Nhập"] || 0,
                              so_luong: 1,
                              max_quantity: 1,
                              imei: o["IMEI"] || "",
                              serial: o["Serial"] || "",
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
                            setLoaiThanhToan('Thanh toán đủ');
                            setCurrentDepositOrderId(maDon || null)
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
                                id: o["IMEI"] || o["Serial"] || o["ID Máy"] || o["Tên Sản Phẩm"] || o["ten_san_pham"] || o["imei"] || o["serial"] || o["id"],
                                type: "product",
                                ten_san_pham: o["Tên Sản Phẩm"] || o["ten_san_pham"] || "",
                                gia_ban: typeof o["Giá Bán"] === "string" ? parseInt(o["Giá Bán"].replace(/[^\d]/g, "")) || 0 : o["Giá Bán"] || 0,
                                gia_nhap: typeof o["Giá Nhập"] === "string" ? parseInt(o["Giá Nhập"].replace(/[^\d]/g, "")) || 0 : o["Giá Nhập"] || 0,
                                so_luong: 1,
                                max_quantity: 1,
                                imei: o["IMEI"] || "",
                                serial: o["Serial"] || "",
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
                              setLoaiThanhToan('Thanh toán đủ');
                              setCurrentDepositOrderId(maDon || null)
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
