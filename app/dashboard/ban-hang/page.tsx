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
import ImagePicker from '@/components/tele/ImagePicker'

import { CartItem, WarrantyPackageUI, Customer } from "@/lib/types/ban-hang"
import { CartItemList } from "@/components/ban-hang/cart-item-list"
import { SearchArea } from "@/components/ban-hang/search-area"


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

  // Đếm tổng số đơn đặt cọc (theo mã đơn duy nhất, chỉ tính trạng thái Đặt cọc)
  const depositOrderCount = useMemo(() => {
    try {
      const uniq = new Set<string>()
      for (const o of depositOrdersState) {
        const status = (o["Trạng Thái"] || o["trang_thai"] || o["Trạng thái"] || o["status"] || "").toString().trim().toLowerCase();
        if (status !== "đặt cọc") continue;
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
  const [depositAmountAlreadyPaid, setDepositAmountAlreadyPaid] = useState(0)
  const [customerSearch, setCustomerSearch] = useState("")

  const [customerResults, setCustomerResults] = useState<any[]>([])
  // Máy kho ngoài cache để lọc nhanh trong tìm kiếm
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
  const [uploadedReceipt, setUploadedReceipt] = useState<any>(null)
  const [receiptBase64, setReceiptBase64] = useState<string | null>(null)
  const [receiptBlob, setReceiptBlob] = useState<Blob | null>(null)
  const [receiptBlobs, setReceiptBlobs] = useState<Blob[] | null>(null)
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

  // Fetch cache (kho hàng, phụ kiện, kho ngoài) khi vào trang hoặc sau khi reloadFlag thay đổi
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
            .filter((p: any) => p.trang_thai === 'Còn hàng' || p.trang_thai === 'Đang CNC')
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
              giam_gia: p.giam_gia ?? 0,
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

        // Kho ngoài
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
            source: 'Kho ngoài',
            nguon: 'Kho ngoài',
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

  // === CHECKOUT ===
  const isWarrantyEligible = (item: CartItem): boolean => {
    if (item.type !== 'product') return false
    const isPartner = String(item.nguon || item.source || '').toLowerCase().includes('kho ngoài')
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
  
  // Tính toán Giảm giá động
  let computedGiamGia = 0;
  let computedDiscountMsg = '';
  if (giamGiaInput) {
    const s = giamGiaInput.trim().toLowerCase();
    if (s.endsWith('%')) {
      const pct = parseFloat(s.replace('%', ''));
      if (!isNaN(pct) && pct > 0 && pct <= 100) {
        computedGiamGia = discountBase * (pct / 100);
        computedDiscountMsg = `Giảm ${pct}% (-₫${computedGiamGia.toLocaleString('vi-VN')})`;
      } else {
        computedDiscountMsg = 'Phần trăm không hợp lệ';
      }
    } else if (s.endsWith('k') || s.endsWith('tr')) {
      let multiplier = 1000;
      if (s.endsWith('tr')) multiplier = 1000000;
      const numStr = s.replace(/k|tr/g, '');
      const num = parseFloat(numStr);
      if (!isNaN(num) && num > 0) {
        computedGiamGia = num * multiplier;
        computedDiscountMsg = `Giảm ₫${computedGiamGia.toLocaleString('vi-VN')}`;
      } else {
        computedDiscountMsg = 'Số tiền giảm không hợp lệ';
      }
    } else {
      const num = parseFloat(s.replace(/[^\d]/g, ''));
      if (!isNaN(num) && num > 0) {
         computedGiamGia = num;
         computedDiscountMsg = `Giảm ₫${computedGiamGia.toLocaleString('vi-VN')}`;
      }
    }
  }

  const giamGiaToUse = computedGiamGia > 0 ? computedGiamGia : giamGia;
  
  const finalThanhToan = Math.max(tongTien + warrantyTotal - giamGiaToUse - (currentDepositOrderId ? depositAmountAlreadyPaid : 0), 0)
  const expectedCollect = loaiThanhToan === 'Đặt cọc' ? Math.max(Number(soTienCoc)||0, 0) : finalThanhToan

  
  // Handlers cho input Giảm giá
  const handleDiscountPreset = (preset: string) => {
    if (preset === 'Reset') {
      setGiamGiaInput(''); setGiamGia(0); setDiscountParseMsg('');
    } else {
      setGiamGiaInput(preset);
    }
  };
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
      const src = String(p.nguon || p.source || "").toLowerCase()
      const isPartner = !!src.match(/kho ngoài|kho ngoài/i)
      const isAccessory = (p.type === "accessory") || (!!p.loai_phu_kien && !p.imei && !p.serial)
      if (filterSource === "inhouse" && (isPartner || isAccessory)) return false
      if (filterSource === "partner" && (!isPartner || isAccessory)) return false
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
    const getSource = (p: any) => {
      const src = String(p.nguon || p.source || '').toLowerCase()
      return (src.match(/kho ngoài|kho ngoài/i)) ? 'Kho ngoài' : 'Kho trong'
    }
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
        (i) => i.type === 'product' && !i.imei && !i.serial && String(i.nguon || i.source || '').toLowerCase().includes('kho ngoài')
      )
      if (partnerMissingImei) {
        toast({
          title: 'Thiếu mã máy cho máy kho ngoài',
          description: 'Vui lòng nhập IMEI hoặc Serial cho máy nguồn Kho ngoài trước khi xuất đơn.',
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
            .filter(p => !String(p.nguon || p.source || '').toLowerCase().includes('kho ngoài'))
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
            loai_don: loaiDon,
            loai_don_ban: loaiDon,
            hinh_thuc_van_chuyen: loaiDon === "Đơn onl" ? hinhThucVanChuyen : "",
            dia_chi_nhan: loaiDon === "Đơn onl" ? diaChiNhan : "",
            "Địa Chỉ Nhận": loaiDon === "Đơn onl" ? diaChiNhan : "",
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
            .filter(p => !String(p.nguon || p.source || '').toLowerCase().includes('kho ngoài'))
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
            .filter(p => !String(p.nguon || p.source || '').toLowerCase().includes('kho ngoài'))
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
          .filter(p => !String(p.nguon || p.source || '').toLowerCase().includes('kho ngoài'))
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
          "Giảm Giá": giamGiaToUse,
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
          // Declare uploadedReceiptLocal here for use in both API and Telegram
          let uploadedReceiptLocal: any = uploadedReceipt || null;
          const res = await fetch("/api/ban-hang", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              ...orderData,
              receipt_image: uploadedReceiptLocal || null,
              skipTelegram: true,
              nguon_hang: products.some(p => String(p.nguon || p.source || '').toLowerCase().includes('kho ngoài')) ? 'Kho ngoài' : '',
              coreTotal: thanhToan,
              warrantyTotal: warrantyTotal,
              finalThanhToan: finalThanhToan,
              hinh_thuc_thanh_toan: paymentSummary,
              payments: paymentsArray,
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
          // Sau khi đã có mã đơn hàng, gửi thông báo Telegram với mã đơn hàng thực tế
          if (order && (order.id_don_hang || order.ma_don_hang) && loaiThanhToan !== "Đặt cọc") {
            // Only declare these once
            const orderInfoForMsg = {
              ...orderData,
              ma_don_hang: order.id_don_hang || order.ma_don_hang,
              // Bổ sung các key phổ biến để formatOrderMessage luôn lấy đúng
              employeeName: employeeId,
              nhan_vien_ban: employeeId,
              final_total: finalThanhToan,
              tong_tien: finalThanhToan,
              total: finalThanhToan,
              dia_chi_nhan: loaiDon === 'Đơn onl' ? diaChiNhan : '',
              address: loaiDon === 'Đơn onl' ? diaChiNhan : '',
              shippingAddress: loaiDon === 'Đơn onl' ? diaChiNhan : '',
              hinh_thuc_van_chuyen: loaiDon === 'Đơn onl' ? hinhThucVanChuyen : '',
              shipping_method: loaiDon === 'Đơn onl' ? hinhThucVanChuyen : '',
              phuong_thuc_thanh_toan: paymentSummary,
              paymentMethod: paymentSummary,
              payments: paymentsArray,
              customerName: selectedCustomer?.ho_ten || 'Khách lẻ',
              customerPhone: selectedCustomer?.so_dien_thoai || '',
              // Đảm bảo khach_hang có đầy đủ thông tin
              khach_hang: {
                ten: selectedCustomer?.ho_ten || 'Khách lẻ',
                ho_ten: selectedCustomer?.ho_ten || 'Khách lẻ',
                so_dien_thoai: selectedCustomer?.so_dien_thoai || '',
                sdt: selectedCustomer?.so_dien_thoai || '',
                dia_chi: loaiDon === 'Đơn onl' ? diaChiNhan : ''
              }
            };
            const derivedOrderType = loaiDon?.toLowerCase?.() ? (loaiDon.toLowerCase().includes('onl') ? 'online' : 'offline') : undefined;
            try {
              // Gửi thông báo Telegram đầy đủ sau khi đã có mã đơn hàng
              await fetch('/api/telegram/send-message', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ orderInfo: orderInfoForMsg, orderType: derivedOrderType })
              });
              // Gửi ảnh lên Telegram (nếu có) sau khi đã có mã đơn hàng
              if (receiptBlobs && receiptBlobs.length > 0) {
                const form = new FormData();
                receiptBlobs.forEach((b, idx) => {
                  const file = b instanceof File ? b : new File([b], `receipt_${idx + 1}.jpg`, { type: (b as any).type || 'image/jpeg' });
                  form.append('photo', file, file.name);
                });
                if (derivedOrderType) form.append('orderType', derivedOrderType);
                const upRes = await fetch('/api/telegram/send-photo', {
                  method: 'POST',
                  body: form
                });
                if (!upRes.ok) throw new Error('Upload ảnh thất bại: ' + (await upRes.text()));
                const upJson = await upRes.json();
                const results = upJson?.results || (upJson?.result ? [upJson.result] : upJson || null);
                uploadedReceiptLocal = results;
                setUploadedReceipt(uploadedReceiptLocal);
              } else if (receiptBlob) {
                const form = new FormData();
                const file = receiptBlob instanceof File ? receiptBlob : new File([receiptBlob], 'receipt.jpg', { type: (receiptBlob as any).type || 'image/jpeg' });
                form.append('photo', file, file.name);
                const upRes = await fetch('/api/telegram/send-photo', {
                  method: 'POST',
                  body: form
                });
                if (!upRes.ok) throw new Error('Upload ảnh thất bại: ' + (await upRes.text()));
                const upJson = await upRes.json();
                uploadedReceiptLocal = upJson?.result || upJson || null;
                setUploadedReceipt(uploadedReceiptLocal);
              }
            } catch (err: any) {
              toast({ title: 'Lỗi gửi thông báo/ảnh Telegram', description: String(err), variant: 'destructive' as any });
              setIsLoading(false);
              return;
            }
          }
          setCart([]);
          setSelectedCustomer(null);
          setGiamGia(0);
          setGhiChu("");
          setDiaChiNhan("");
          setCashAmount(0); setTransferAmount(0); setCardAmount(0);
          setInstallmentEnabled(false); setInstallmentType(''); setInstallmentDown(0); setInstallmentLoan(0);
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
          setDepositAmountAlreadyPaid(0)

          toast({ title: 'Tạo đơn thành công', description: `Mã: ${order.id_don_hang || order.ma_don_hang || ''}` })
          try { localStorage.removeItem('cart_draft_v1'); localStorage.removeItem('cart_warranty_sel_v1') } catch{}
          setReloadFlag(f => f + 1);
          try { setReceiptBlob(null); setReceiptBase64(null); setReceiptBlobs(null); setUploadedReceipt(null) } catch {}
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
      const restoredProducts = allRows.map((o: any) => ({
        ...o,
        trang_thai: "Còn hàng",
        trang_thai_kho: "Kho Ngoài",
        tinh_trang: o["Tình Trạng Máy"] || o["tinh_trang_may"] || o["Trạng Thái Máy"] || ""
      }));
      await fetch("/api/update-product-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productIds, newStatus: "Còn hàng" })
      });
      await fetch("/api/kho-hang", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ products: restoredProducts })
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
              className="data-[state=active]:bg-blue-100 data-[state=active]:text-blue-700 data-[state=active]:border-blue-500"
            >
              Bán hàng
            </TabsTrigger>
            <TabsTrigger
              value="don-dat-coc"
              className="relative data-[state=active]:bg-blue-100 data-[state=active]:text-blue-700 data-[state=active]:border-blue-500"
            >
              <span>Đơn đặt cọc</span>
              {depositOrderCount > 0 && (
                <span className="ml-2 inline-flex items-center justify-center min-w-5 h-5 px-1.5 rounded-full text-[11px] font-semibold bg-blue-600 text-white">
                  {depositOrderCount}
                </span>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="ban-hang">
            {isMobile && (
              <div className="sticky top-0 z-10 bg-white/95 backdrop-blur border-b px-4 py-2 flex gap-2">
                <Button size="sm" variant={mobileView==='san-pham'? 'default':'outline'} className="flex-1" onClick={()=> setMobileView('san-pham')}>Sản phẩm</Button>
                <Button size="sm" variant={mobileView==='gio-hang'? 'default':'outline'} className="flex-1" onClick={()=> setMobileView('gio-hang')}>Giỏ hàng ({cart.length})</Button>
                <Button size="sm" variant={mobileView==='thanh-toan'? 'default':'outline'} className="flex-1" onClick={()=> setMobileView('thanh-toan')}>Thanh toán</Button>
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,2.25fr)_minmax(0,0.75fr)] gap-6 items-start mt-4">
              <div className="flex flex-col gap-6">
                <SearchArea
                  isMobile={isMobile}
                  mobileView={mobileView}
                  searchQuery={searchQuery}
                  setSearchQuery={setSearchQuery}
                  isSearching={isSearching}
                  searchResults={searchResults}
                  sortedSearchResults={sortedSearchResults}
                  selectedIndex={selectedIndex}
                  setSelectedIndex={setSelectedIndex}
                  addToCart={addToCart}
                  filterSource={filterSource}
                  setFilterSource={setFilterSource}
                  filterType={filterType}
                  setFilterType={setFilterType}
                  toggleSort={toggleSort}
                  sortKey={sortKey}
                  sortOrder={sortOrder}
                  tableContainerRef={tableContainerRef}
                  highlight={highlight}
                  justAddedKey={justAddedKey}
                  setJustAddedKey={setJustAddedKey}
                  copiedImei={copiedImei}
                  setCopiedImei={setCopiedImei}
                  editingPriceId={editingPriceId}
                  setEditingPriceId={setEditingPriceId}
                  editPriceRef={editPriceRef}
                  setCart={setCart}
                  toast={toast}
                />

                {(!isMobile || mobileView === 'gio-hang') && (
                  <Card className="min-h-[220px] h-full w-full flex flex-col lg:min-h-[360px]">
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
                        <CartItemList
                          cart={cart}
                          setCart={setCart}
                          updateQuantity={updateQuantity}
                          removeFromCart={removeFromCart}
                          isWarrantyEligible={isWarrantyEligible}
                          warrantyPackages={warrantyPackages}
                          selectedWarranties={selectedWarranties}
                          setSelectedWarranties={setSelectedWarranties}
                          setEditingPriceId={setEditingPriceId}
                        />
                      )}
                    </CardContent>
                  </Card>
                )}
              </div>

              {(!isMobile || mobileView === 'thanh-toan') && (
                <div className="space-y-6 lg:max-w-[520px]">
                  {/* Khách hàng */}
                  <Card>
                    <CardHeader><CardTitle>Khách hàng</CardTitle></CardHeader>
                    <CardContent className="space-y-4">
                      {customerResults.length > 0 && (
                        <div className="border rounded bg-white max-h-56 overflow-y-auto">
                          {customerResults.map((kh: Customer & { isDeposit?: boolean }) => (
                            <div
                              key={kh.id}
                              className={`flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-blue-50 ${kh.isDeposit ? "text-orange-600 font-semibold" : ""}`}
                              onClick={() => { setSelectedCustomer(kh); setCustomerSearch(""); setCustomerResults([]); }}
                            >
                              <span>{kh.ho_ten} ({kh.so_dien_thoai})</span>
                              {kh.isDeposit && <span title="Khách đang đặt cọc" className="ml-1">🔒</span>}
                            </div>
                          ))}
                        </div>
                      )}
                      {selectedCustomer ? (
                        <div className="p-3 border rounded-lg bg-white flex items-center justify-between">
                          <div>
                            <p className="font-medium">{selectedCustomer.ho_ten}</p>
                            <p className="text-sm text-muted-foreground">{selectedCustomer.so_dien_thoai}</p>
                          </div>
                          <Button variant="ghost" size="sm" onClick={() => setSelectedCustomer(null)}>Xóa</Button>
                        </div>
                      ) : (
                        <div className="flex gap-2">
                          <Button variant="outline" className="flex-1 bg-white" onClick={() => setIsCustomerSelectOpen(true)}>
                            <User className="mr-2 h-4 w-4" /> Chọn khách hàng
                          </Button>
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* Thanh toán */}
                  <Card>
                    <CardHeader><CardTitle>Thanh toán</CardTitle></CardHeader>
                    <CardContent className="space-y-4">
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <label className="text-sm font-medium">Phương thức thanh toán</label>
                          <div className="space-y-3">
                            <div className="flex items-center gap-3">
                              <label className="flex items-center gap-2 cursor-pointer w-28">
                                <input type="checkbox" className="rounded-full w-4 h-4 accent-blue-600" checked={cashEnabled} onChange={(e) => { setCashEnabled(e.target.checked); if (!e.target.checked) setCashAmount(0); }} />
                                <span className="text-sm">Tiền mặt</span>
                              </label>
                              {cashEnabled && <Input className="flex-1" placeholder="₫0" value={cashAmount ? cashAmount.toLocaleString('vi-VN') : ''} onChange={(e) => setCashAmount(Number(e.target.value.replace(/[^\d]/g, '')) || 0)} />}
                            </div>
                            <div className="flex items-center gap-3">
                              <label className="flex items-center gap-2 cursor-pointer w-28">
                                <input type="checkbox" className="rounded-full w-4 h-4 accent-blue-600" checked={transferEnabled} onChange={(e) => { setTransferEnabled(e.target.checked); if (!e.target.checked) setTransferAmount(0); }} />
                                <span className="text-sm">Chuyển khoản</span>
                              </label>
                              {transferEnabled && <Input className="flex-1" placeholder="₫0" value={transferAmount ? transferAmount.toLocaleString('vi-VN') : ''} onChange={(e) => setTransferAmount(Number(e.target.value.replace(/[^\d]/g, '')) || 0)} />}
                            </div>
                            <div className="flex items-center gap-3">
                              <label className="flex items-center gap-2 cursor-pointer w-28">
                                <input type="checkbox" className="rounded-full w-4 h-4 accent-blue-600" checked={cardEnabled} onChange={(e) => { setCardEnabled(e.target.checked); if (!e.target.checked) setCardAmount(0); }} />
                                <span className="text-sm">Thẻ</span>
                              </label>
                              {cardEnabled && <Input className="flex-1" placeholder="₫0" value={cardAmount ? cardAmount.toLocaleString('vi-VN') : ''} onChange={(e) => setCardAmount(Number(e.target.value.replace(/[^\d]/g, '')) || 0)} />}
                            </div>
                            <div className="space-y-2">
                              <div className="flex items-center gap-3">
                                <label className="flex items-center gap-2 cursor-pointer w-28">
                                  <input type="checkbox" className="rounded-full w-4 h-4 accent-blue-600" checked={installmentEnabled} onChange={(e) => { setInstallmentEnabled(e.target.checked); if (!e.target.checked) { setInstallmentDown(0); setInstallmentLoan(0); setInstallmentType(''); } }} />
                                  <span className="text-sm">Trả góp</span>
                                </label>
                                {installmentEnabled && (
                                  <Select value={installmentType} onValueChange={(val: any) => setInstallmentType(val)}>
                                    <SelectTrigger className="flex-1"><SelectValue placeholder="Chọn đối tác..." /></SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="Góp iCloud">Góp iCloud</SelectItem>
                                      <SelectItem value="Thẻ tín dụng">Thẻ tín dụng</SelectItem>
                                      <SelectItem value="Mira">Mira</SelectItem>
                                      <SelectItem value="HDSaison">HDSaison</SelectItem>
                                      <SelectItem value="HomeCredit">HomeCredit</SelectItem>
                                    </SelectContent>
                                  </Select>
                                )}
                              </div>
                              {installmentEnabled && (
                                <div className="flex items-center gap-3 pl-7">
                                  <div className="flex-1 space-y-1">
                                    <label className="text-xs text-muted-foreground">Trả trước (Khách đưa)</label>
                                    <Input placeholder="₫0" value={installmentDown ? installmentDown.toLocaleString('vi-VN') : ''} onChange={(e) => setInstallmentDown(Number(e.target.value.replace(/[^\d]/g, '')) || 0)} />
                                  </div>
                                  <div className="flex-1 space-y-1">
                                    <label className="text-xs text-muted-foreground">Góp (Khoản vay)</label>
                                    <Input placeholder="₫0" value={installmentLoan ? installmentLoan.toLocaleString('vi-VN') : ''} onChange={(e) => setInstallmentLoan(Number(e.target.value.replace(/[^\d]/g, '')) || 0)} />
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                          
                          <p className="text-xs text-muted-foreground pt-1">
                            Tổng đã nhập: ₫{sumPayments.toLocaleString('vi-VN')} • Cần thu: ₫{expectedCollect.toLocaleString('vi-VN')}
                          </p>
                        </div>
                        
                        <Separator />

                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <label className="text-sm font-medium">Giảm giá</label>
                            <div className="flex items-center gap-1">
                              {['50k', '100k', '200k', '5%', '10%'].map(pres => (
                                <button key={pres} type="button" onClick={() => handleDiscountPreset(pres)} className="px-2 py-1 text-[11px] border rounded hover:bg-slate-100">{pres}</button>
                              ))}
                              <button type="button" onClick={() => handleDiscountPreset('Reset')} className="px-2 py-1 text-[11px] border rounded hover:bg-slate-100">Reset</button>
                            </div>
                          </div>
                          <Input
                            placeholder="Ví dụ: 100k hoặc 10%"
                            value={giamGiaInput}
                            onChange={(e) => { setGiamGiaInput(e.target.value); if(!e.target.value.trim()){ setGiamGia(0); setDiscountParseMsg(''); } }}
                          />
                          {(computedDiscountMsg || discountParseMsg) && <p className="text-xs text-blue-600 font-medium">{computedDiscountMsg || discountParseMsg}</p>}
                        </div>

                        <div className="space-y-2">
                          <label className="text-sm font-medium">Ghi chú</label>
                          <Input
                            placeholder="Ghi chú đơn hàng..."
                            value={ghiChu}
                            onChange={(e) => setGhiChu(e.target.value)}
                          />
                        </div>

                        <Separator />

                        <div className="space-y-2">
                          <div className="flex justify-between text-sm">
                            <span>Tiền hàng:</span>
                            <span>₫{tongTien.toLocaleString()}</span>
                          </div>
                          {warrantyTotal > 0 && (
                            <div className="flex justify-between text-sm text-blue-700">
                              <span>Bảo hành:</span>
                              <span>+₫{warrantyTotal.toLocaleString()}</span>
                            </div>
                          )}
                          <div className="flex justify-between text-sm">
                            <span>Giảm giá:</span>
                            <span>-₫{giamGiaToUse.toLocaleString()}</span>
                          </div>
                          {currentDepositOrderId && depositAmountAlreadyPaid > 0 && (
                            <div className="flex justify-between text-sm text-emerald-600 font-medium">
                              <span>Sẵn có (Tiền cọc):</span>
                              <span>-₫{depositAmountAlreadyPaid.toLocaleString()}</span>
                            </div>
                          )}

                          <div className="flex items-center justify-between font-bold text-lg mt-2">
                            <span>Thanh toán:</span>
                            <span>₫{finalThanhToan.toLocaleString()}</span>
                          </div>
                        </div>

                        <Separator />
                        
                        <div className="space-y-4">
                          <div className="flex items-center gap-3">
                            <Select value={loaiDon} onValueChange={setLoaiDon}>
                              <SelectTrigger className="flex-1"><SelectValue placeholder="Loại đơn" /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="Đơn onl">Đơn onl</SelectItem>
                                <SelectItem value="Đơn off">Đơn off</SelectItem>
                              </SelectContent>
                            </Select>
                            
                            {loaiDon === 'Đơn onl' && (
                              <Select value={hinhThucVanChuyen} onValueChange={setHinhThucVanChuyen}>
                                <SelectTrigger className="flex-1"><SelectValue placeholder="Hình thức vận chuyển" /></SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="GHTK">GHTK</SelectItem>
                                  <SelectItem value="Book Grab">Book Grab</SelectItem>
                                  <SelectItem value="Gửi Xe">Gửi Xe</SelectItem>
                                </SelectContent>
                              </Select>
                            )}
                          </div>

                          {loaiDon === 'Đơn onl' && (
                            <div className="space-y-2">
                              <label className="text-sm font-medium">Địa chỉ nhận</label>
                              <Input placeholder="Số nhà, đường, phường/xã, quận/huyện, tỉnh/thành phố" value={diaChiNhan} onChange={(e) => setDiaChiNhan(e.target.value)} />
                            </div>
                          )}
                        </div>

                        <div className="space-y-2">
                          <label className="text-sm font-medium">Loại thanh toán</label>
                          <Select value={loaiThanhToan} onValueChange={setLoaiThanhToan}>
                            <SelectTrigger><SelectValue placeholder="Chọn loại thanh toán..." /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Thanh toán đủ">Thanh toán đủ</SelectItem>
                              <SelectItem value="Đặt cọc">Đặt cọc</SelectItem>
                            </SelectContent>
                          </Select>
                          {loaiThanhToan === 'Đặt cọc' && (
                            <div className="pt-2 space-y-3 p-3 border rounded bg-orange-50/50">
                              <div className="space-y-1">
                                <label className="text-xs font-semibold text-orange-800">Khách đặt cọc trước (₫)</label>
                                <Input type="number" placeholder="Ví dụ: 500000" value={soTienCoc || ''} onChange={(e) => setSoTienCoc(Number(e.target.value))} className="border-orange-200" />
                              </div>
                              <div className="space-y-1">
                                <label className="text-xs font-semibold text-orange-800">Hẹn ngày trả đủ</label>
                                <Input type="date" value={ngayHenTraDu} onChange={(e) => setNgayHenTraDu(e.target.value)} className="border-orange-200" />
                              </div>
                              <div className="pt-1 text-sm font-medium text-orange-800 flex justify-between">
                                <span>Còn lại phải thu:</span>
                                <span>₫{Math.max(0, finalThanhToan - (soTienCoc||0)).toLocaleString()}</span>
                              </div>
                            </div>
                          )}
                        </div>

                        {loaiThanhToan !== 'Đặt cọc' && (
                          <div className="space-y-2">
                            <label className="text-sm font-medium">Đính kèm ảnh (hóa đơn / biên nhận)</label>
                            <ImagePicker onSelectBlobs={setReceiptBlobs} />
                            {receiptBlobs && receiptBlobs.length > 0 && <p className="text-xs text-muted-foreground mt-1">Gửi {receiptBlobs.length} ảnh kèm thông báo</p>}
                          </div>
                        )}

                        <Button className="w-full bg-blue-600 hover:bg-blue-700 h-12 text-lg mt-4" disabled={isLoading || cart.length === 0} onClick={handleCheckout}>
                          {isLoading ? <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Đang xử lý</> : "Thanh toán"}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="don-dat-coc">
            <Card>
              <CardHeader className="space-y-4">
                <div>
                  <CardTitle>Đơn đặt cọc</CardTitle>
                  <p className="text-sm text-muted-foreground mt-1">Chỉ hiển thị đơn đặt cọc</p>
                </div>
                <div className="relative w-full">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input placeholder="Tìm mã đơn, tên KH, SDT..." value={depositSearch} onChange={(e) => setDepositSearch(e.target.value)} className="pl-9 w-full" />
                </div>
              </CardHeader>
              <CardContent>
                {(() => {
                   const filtered = depositOrdersState.filter(o => {
                      const status = (o["Trạng Thái"] || o["trang_thai"] || o["Trạng thái"] || o["status"] || "").toString().trim().toLowerCase();
                      if (status !== "đặt cọc") return false;
                      const m = o["Mã Đơn Hàng"] || o["ID Đơn Hàng"] || o["ma_don_hang"] || "";
                      const k = o["Tên Khách Hàng"] || o["ten_khach_hang"] || "";
                      return String(m).toLowerCase().includes(depositSearch.toLowerCase()) || String(k).toLowerCase().includes(depositSearch.toLowerCase());
                   });
                   if (depositLoading) return <div className="p-8 text-center text-slate-500">Đang tải...</div>;
                   if (filtered.length === 0) return <div className="p-8 text-center text-slate-500">Không tìm thấy đơn nào.</div>;
                   return (
                     <div className="overflow-x-auto">
                       <Table>
                         <TableHeader>
                           <TableRow className="bg-slate-50">
                             <TableHead>
                               <div className="flex items-center gap-2">
                                 Mã Đơn Hàng
                                 <Badge variant="secondary" className="bg-blue-100 text-blue-700 hover:bg-blue-100 py-0 leading-none h-5">
                                   {filtered.length}
                                 </Badge>
                               </div>
                             </TableHead>
                             <TableHead>Khách</TableHead>
                             <TableHead>Sản phẩm</TableHead>
                             <TableHead>IMEI</TableHead>
                             <TableHead>Trạng thái máy</TableHead>
                             <TableHead>Tổng đã cọc</TableHead>
                             <TableHead>Tổng còn lại</TableHead>
                             <TableHead>Ngày cọc</TableHead>
                             <TableHead>Hạn TT</TableHead>
                             <TableHead>Thao tác</TableHead>
                           </TableRow>
                         </TableHeader>
                         <TableBody>
                           {filtered.map((order, i) => {
                             const maDon = order["Mã Đơn Hàng"] || order["ID Đơn Hàng"] || order["ma_don_hang"] || "-";
                             const tenKhach = order["Tên Khách Hàng"] || order["ten_khach_hang"] || "-";
                             const sdtKhach = order["Số Điện Thoại"] || order["so_dien_thoai"] || "";
                             const sanPhamBase = order["Tên Sản Phẩm"] || order["ten_san_pham"] || "-";
                             const mauSac = order["Màu Sắc"] || order["mau_sac"] || "";
                             const sanPham = mauSac ? `${sanPhamBase} (${mauSac})` : sanPhamBase;
                             const imei = order["IMEI"] || order["imei"] || "-";
                             const trangThaiMay = order["Tình Trạng Máy"] || order["tinh_trang_may"] || "-";
                             
                             let tongDaCoc = order["Số Tiền Cọc"] || order["so_tien_coc"] || 0;
                             if (typeof tongDaCoc === 'string') tongDaCoc = Number(tongDaCoc.replace(/[^\d]/g, '')) || 0;
                             
                             let tongConLai = order["Số Tiền Còn Lại"] || order["Còn Lại"] || order["so_tien_con_lai"] || 0;
                             if (typeof tongConLai === 'string') tongConLai = Number(tongConLai.replace(/[^\d]/g, '')) || 0;
                             
                             const ngayCocRaw = order["Ngày Đặt Cọc"] || order["Ngày Cọc"] || order["Ngày Xuất"] || order["ngay_xuat"];
                             let ngayCoc = "-";
                             if (ngayCocRaw) {
                               const d = dayjs(ngayCocRaw, ["DD/MM/YYYY", "D/M/YYYY", "YYYY-MM-DD"]);
                               ngayCoc = d.isValid() ? d.format("DD/MM/YYYY") : ngayCocRaw;
                             }
                             
                             const hanRaw = order["Hạn Thanh Toán"] || order["han_thanh_toan"];
                             let han = "-";
                             if (hanRaw) {
                               const d = dayjs(hanRaw, ["DD/MM/YYYY", "D/M/YYYY", "YYYY-MM-DD"]);
                               han = d.isValid() ? d.format("DD/MM/YYYY") : hanRaw;
                             }

                             return (
                               <TableRow key={i}>
                                 <TableCell className="font-medium whitespace-nowrap">{maDon}</TableCell>
                                 <TableCell>
                                    <div className="font-medium">{tenKhach}</div>
                                    <div className="text-xs text-muted-foreground">{sdtKhach}</div>
                                 </TableCell>
                                 <TableCell className="min-w-[200px]">{sanPham}</TableCell>
                                 <TableCell className="whitespace-nowrap">{imei}</TableCell>
                                 <TableCell>
                                    <span className="bg-slate-100 text-slate-700 px-2 py-1 rounded text-xs whitespace-nowrap">{trangThaiMay}</span>
                                 </TableCell>
                                 <TableCell className="text-blue-600 font-semibold whitespace-nowrap align-middle">
                                    <span>₫{tongDaCoc.toLocaleString('vi-VN')}</span>
                                 </TableCell>
                                 <TableCell className="text-emerald-600 font-semibold whitespace-nowrap align-middle">
                                    <span className="border-b border-emerald-600/30 pb-0.5">₫{tongConLai.toLocaleString('vi-VN')}</span>
                                 </TableCell>
                                 <TableCell className="whitespace-nowrap">{ngayCoc}</TableCell>
                                 <TableCell className="whitespace-nowrap">{han}</TableCell>
                                 <TableCell>
                                   <div className="flex items-center gap-2">
                                     <Button size="sm" className="bg-emerald-500 hover:bg-emerald-600 text-white whitespace-nowrap h-8 px-3" onClick={() => {
                                        const allRows = depositOrdersState.filter(o => (o["Mã Đơn Hàng"] || o["ID Đơn Hàng"] || o["ma_don_hang"]) === maDon);
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
                                          id: sdtKhach,
                                          ho_ten: tenKhach,
                                          so_dien_thoai: sdtKhach
                                        });
                                         // Tính tổng tiền đã cọc từ tất cả các dòng của đơn này
                                         const totalPaid = allRows.reduce((sum, o: any) => {
                                           let val = o["Số Tiền Cọc"] || o["so_tien_coc"] || 0;
                                           if (typeof val === 'string') val = Number(String(val).replace(/[^\d]/g, '')) || 0;
                                           return sum + (Number(val) || 0);
                                         }, 0);

                                         setCurrentDepositOrderId(maDon || null);
                                         setDepositAmountAlreadyPaid(totalPaid || 0);
                                         setLoaiThanhToan("Thanh toán đủ");
                                         toast({ title: 'Đã tải đơn đặt cọc', description: `Đã cọc: ₫${(totalPaid || 0).toLocaleString('vi-VN')}. Vui lòng thanh toán số còn lại.` });

                                        setActiveTab("ban-hang");
                                     }}>Thanh toán tiếp</Button>
                                     <Button size="sm" variant="destructive" className="bg-red-500 hover:bg-red-600 whitespace-nowrap h-8 px-3" onClick={async () => {
                                        if (!confirm(`Bạn có chắc muốn hủy đơn đặt cọc ${maDon}?`)) return;
                                        handleCancelDeposit(maDon);
                                     }}>Hủy đặt cọc</Button>
                                   </div>
                                 </TableCell>
                               </TableRow>
                             );
                           })}
                         </TableBody>
                       </Table>
                     </div>
                   );
                })()}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      <CustomerDialog
        isOpen={isCustomerDialogOpen}
        onClose={() => setIsCustomerDialogOpen(false)}
        onSuccess={(customer) => {
          const c = customer as any;
          setSelectedCustomer({ id: c.sdt, ho_ten: c.ten_khach, so_dien_thoai: c.sdt });
          setIsCustomerDialogOpen(false);
          setIsCustomerSelectOpen(false);
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
