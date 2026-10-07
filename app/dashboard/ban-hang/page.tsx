"use client"

import { useState, useEffect, useRef, useMemo } from "react"
import { ProtectedRoute, getAuthHeaders } from "@/components/auth/protected-route"
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

import { CartItem, WarrantyPackageUI, Customer, SortKey } from "@/lib/types/ban-hang"
import { computeDynamicDiscount } from "@/lib/ban-hang/discount"
import { isWarrantyEligible, computeCartSubtotal, computeWarrantyTotal } from "@/lib/ban-hang/totals"
import { useCart } from "@/hooks/ban-hang/use-cart"
import { useAuthMe } from "@/hooks/use-auth-me"
import { useDiscount } from "@/hooks/ban-hang/use-discount"
import { CustomerCard } from "@/components/ban-hang/customer-card"
import { MobileCheckoutBar } from "@/components/ban-hang/mobile-checkout-bar"
import { PaymentColumn } from "@/components/ban-hang/payment-column"
import { DepositOrdersTab } from "@/components/ban-hang/deposit-orders-tab"
import { CartItemList } from "@/components/ban-hang/cart-item-list"
import { SearchArea } from "@/components/ban-hang/search-area"
import { AdvancedFilterBar } from "@/components/ban-hang/advanced-filter-bar"
import { normalizeVi } from "@/lib/ban-hang/quick-accessories"
import { useSellableCatalog } from "@/hooks/ban-hang/use-sellable-catalog"
import { isAccessoryItem } from "@/lib/catalog/normalize"
import { useInventoryStore, MAX_PRICE } from "@/lib/store/inventory-store"
import { useFilterPersistence } from "@/hooks/use-filter-persistence"
import { useQueryClient } from "@tanstack/react-query"
// === Gộp từ trang Kho hàng (trang /dashboard/kho-hang đã bỏ, redirect về đây) ===
import { InventoryStats } from "@/components/kho-hang/inventory-tabs"
import { ManageTabs, MANAGE_TABS, type ManageTab } from "@/components/kho-hang/manage-tabs"
import { ProductDialog } from "@/components/kho-hang/product-dialog"
import { SendCNCDialog } from "@/components/kho-hang/send-cnc-dialog"
import { SendPartnerDialog } from "@/components/kho-hang/send-partner-dialog"
import { RefreshButton } from "@/components/ui/refresh-button"
import { PullToRefresh } from "@/components/ui/pull-to-refresh"
import { useInventoryActions } from "@/hooks/use-inventory-actions"
import { useInventoryData, useCNCData, useBaoHanhHistory, useAccessoriesData } from "@/hooks/use-inventory-data"
import { isConHangProduct } from "@/lib/utils/inventory-helpers"
import { buildCustomerQuoteList, copyTextToClipboard } from "@/lib/utils/customer-quote"
import { toast as sonnerToast } from "sonner"
import { ListChecks } from "lucide-react"


export default function BanHangPage() {
  const { toast } = useToast()
  const isMobile = useIsMobile()
  const { me } = useAuthMe()
  const isManager = me?.role === "quan_ly"
  const [mobileView, setMobileView] = useState<"san-pham" | "gio-hang" | "thanh-toan">("san-pham")
  // Bộ lọc dùng CHUNG với trang Kho hàng (useInventoryStore) — xem lib/store/inventory-store.ts.
  const BH_MAX_PRICE = MAX_PRICE
  const {
    searchTerm: searchQuery, setSearchTerm: setSearchQuery,
    sourceFilter: filterSource, setSourceFilter: setFilterSource,
    filterType, setFilterType,
    productNameFilter,
    loaiMayFilter,
    colorFilter,
    capacityFilter,
    pinFilter,
    priceRange,
    resetFilters: resetAdvancedFilters,
  } = useInventoryStore()
  // Nhớ bộ lọc giữa các lần vào trang (localStorage, nạp sau mount)
  useFilterPersistence()
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
  // ===== Quản lý kho (gộp từ trang Kho hàng) =====
  const [manageTab, setManageTab] = useState<ManageTab>("dang-cnc")
  const [isEditMode, setIsEditMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [isProductDialogOpen, setIsProductDialogOpen] = useState(false)
  const [selectedProduct, setSelectedProduct] = useState<any>(null)
  const [isSendCNCDialogOpen, setIsSendCNCDialogOpen] = useState(false)
  const [isSendPartnerDialogOpen, setIsSendPartnerDialogOpen] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
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
  const [searchResults, setSearchResults] = useState<any[]>([])
  // Giỏ hàng + chọn bảo hành tách sang hook useCart (giữ nguyên hành vi load/persist/mutators)
  const {
    cart, setCart,
    addToCart, addPartnerItemToCart, updateQuantity, removeFromCart,
    warrantyPackages, warrantyPkgLoading,
    selectedWarranties, setSelectedWarranties, handleSelectWarranty,
  } = useCart({ toast, setSearchQuery, setActiveTab })
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)
  // Giảm giá tách sang hook useDiscount (giữ nguyên hành vi)
  const {
    giamGia, setGiamGia,
    giamGiaInput, setGiamGiaInput,
    discountParseMsg, setDiscountParseMsg,
    handleDiscountInput, commitDiscount, applyQuickDiscount, handleDiscountPreset,
  } = useDiscount()
  // Thanh toán: hỗ trợ nhiều phương thức + trả góp
  const [cashEnabled, setCashEnabled] = useState(false)
  const [cashAmount, setCashAmount] = useState(0)
  const [transferEnabled, setTransferEnabled] = useState(false)
  const [transferAmount, setTransferAmount] = useState(0)
  const [cardEnabled, setCardEnabled] = useState(false)
  const [cardAmount, setCardAmount] = useState(0)
  // Thu máy cũ (khách lên đời): tính như một phương thức thanh toán
  const [thuMayEnabled, setThuMayEnabled] = useState(false)
  const [thuMayAmount, setThuMayAmount] = useState(0)
  const [thuMayTenSanPham, setThuMayTenSanPham] = useState("")
  const [thuMayLoaiMay, setThuMayLoaiMay] = useState("")
  const [thuMayImei, setThuMayImei] = useState("")
  // Thu máy "xuống đời": giá thu máy cũ > tiền máy mới -> shop trả lại phần chênh cho khách.
  const [traKhachMethod, setTraKhachMethod] = useState<'Tiền mặt' | 'Chuyển khoản'>('Tiền mặt')
  const [installmentEnabled, setInstallmentEnabled] = useState(false)
  const [installmentType, setInstallmentType] = useState<'' | 'Góp iCloud' | 'Thẻ tín dụng' | 'Mira'>('')
  const [installmentDown, setInstallmentDown] = useState(0)
  const [installmentLoan, setInstallmentLoan] = useState(0)
  const [loaiDon, setLoaiDon] = useState("Đơn off")
  const [hinhThucVanChuyen, setHinhThucVanChuyen] = useState("")
  const [diaChiNhan, setDiaChiNhan] = useState("")
  const [ghiChu, setGhiChu] = useState("")
  const [maGhtk, setMaGhtk] = useState("")
  // Tiền thu hộ COD (chỉ dùng khi vận chuyển GHTK) — tính như một phương thức thanh toán
  const [codAmount, setCodAmount] = useState(0)

  // Hình thức vận chuyển: GHTK kèm luôn mã đơn -> "GHTK - 1990038382" để lưu thẳng vào sheet.
  const buildShipMethod = () => {
    if (loaiDon !== "Đơn onl") return ""
    const code = maGhtk.trim()
    if (hinhThucVanChuyen === "GHTK" && code) return `GHTK - ${code}`
    return hinhThucVanChuyen
  }
  const [copiedImei, setCopiedImei] = useState<string | null>(null)
  const [justAddedKey, setJustAddedKey] = useState<string | null>(null)
  // Discount input string (5.2)
  // giamGiaInput/discountParseMsg chuyển sang hook useDiscount
  const [isLoading, setIsLoading] = useState(false)
  const [isCustomerDialogOpen, setIsCustomerDialogOpen] = useState(false)
  const [isCustomerSelectOpen, setIsCustomerSelectOpen] = useState(false)
  const [orders, setOrders] = useState<any[]>([])
  const [currentDepositOrderId, setCurrentDepositOrderId] = useState<string | null>(null)
  const [depositAmountAlreadyPaid, setDepositAmountAlreadyPaid] = useState(0)
  const [depositPaymentSummary, setDepositPaymentSummary] = useState("")
  const [customerSearch, setCustomerSearch] = useState("")

  const [customerResults, setCustomerResults] = useState<any[]>([])
  // Catalog (máy kho shop / máy kho ngoài / phụ kiện) dùng chung React Query cache với
  // trang Kho hàng -> mở 2 trang chỉ đọc sheet 1 lượt. allAccessoryProducts gồm cả hàng
  // tồn = 0 để checkbox phụ kiện kèm máy trong giỏ vẫn hiện (nhưng khoá khi hết).
  const {
    khoHangProducts,
    partnerProducts,
    accessoryProducts,
    allAccessoryProducts,
  } = useSellableCatalog()
  // Desktop search table UX enhancements
  const [sortKey, setSortKey] = useState<SortKey>('san_pham')
  const [sortOrder, setSortOrder] = useState<'asc'|'desc'>('asc')
  const [selectedIndex, setSelectedIndex] = useState<number>(-1)
  const tableContainerRef = useRef<HTMLDivElement|null>(null)
  const [isSearching, setIsSearching] = useState(false)
  // Persist search & filters
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
  /* ===== Warranty state (packages/loading/selectedWarranties chuyển sang useCart) ===== */
  const [openWarrantyInfo, setOpenWarrantyInfo] = useState<string|null>(null)
  // Inline edit price (3.1)
  const [editingPriceId, setEditingPriceId] = useState<string|null>(null)
  const editPriceRef = useRef<HTMLInputElement|null>(null)
  // Abort previous search requests when user keeps typing
  const searchAbortRef = useRef<AbortController | null>(null)
  // load/persist giỏ hàng + chọn bảo hành + load gói BH đã chuyển sang useCart

  // Discount parser handlers chuyển sang hook useDiscount

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

        // Ưu tiên dữ liệu cache (kho/đối tác/phụ kiện) vì đầy đủ field (nguon, serial, ...);
        // kết quả từ /api/search-products chỉ bổ sung máy không có sẵn trong cache.
        const allProducts = [...filteredKho, ...filteredPartner, ...filteredAccessories, ...results]
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

  /* =================== Quản lý kho: actions + thống kê =================== */
  const queryClient = useQueryClient()
  const { toggleDangXuLy, isTogglingDangXuLy, bulkUpdateNguon } = useInventoryActions()
  const { data: invResRaw } = useInventoryData()
  const { data: cncResRaw } = useCNCData()
  const { data: bhResRaw } = useBaoHanhHistory()
  const { data: accResRaw } = useAccessoriesData()

  const inventoryStats = useMemo(() => {
    const rawInventory: any[] = invResRaw?.data || []
    const cncProducts: any[] = cncResRaw?.data || []
    const baoHanhHistory: any[] = bhResRaw?.data || []
    const accessories: any[] = accResRaw?.data || []
    return {
      soSanPhamCon: rawInventory.filter(isConHangProduct).length,
      soSanPhamCNC: cncProducts.filter((p: any) => p.trang_thai === "Đang CNC").length,
      soSanPhamBH: baoHanhHistory.length,
      soSanPhamDoiTac: rawInventory.filter((p: any) => p.trang_thai === "Giao đối tác").length,
      soPhuKienDaHet: accessories.filter((a: any) => parseInt(a.so_luong_ton) <= 0).length,
      soPhuKienSapHet: accessories.filter((a: any) => {
        const q = parseInt(a.so_luong_ton)
        return q > 0 && q <= 5
      }).length,
    }
  }, [invResRaw, cncResRaw, bhResRaw, accResRaw])

  // Máy trong kho hệ thống (có trong sheet Kho_Hang) mới chỉnh/CNC/giao đối tác được.
  const allInventoryProducts: any[] = invResRaw?.data || []

  const handleSelectMachine = (id: string) =>
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))

  const clearMachineSelection = () => {
    setSelectedIds([])
    setIsEditMode(false)
  }

  const handleRefreshAll = async () => {
    setRefreshing(true)
    try {
      // Bust cache server (TTL 15s) trước để chắc chắn lấy dữ liệu mới nhất từ sheet
      await fetch("/api/kho-hang?refresh=1", { cache: "no-store" }).catch(() => {})
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["inventory"] }),
        queryClient.invalidateQueries({ queryKey: ["partner-inventory"] }),
        queryClient.invalidateQueries({ queryKey: ["cnc-inventory"] }),
        queryClient.invalidateQueries({ queryKey: ["accessories-inventory"] }),
        queryClient.invalidateQueries({ queryKey: ["baohanh-history"] }),
        queryClient.invalidateQueries({ queryKey: ["hang-doi-tac"] }),
      ])
      sonnerToast.success("Đã làm mới dữ liệu")
    } catch {
      sonnerToast.error("Lỗi khi làm mới dữ liệu")
    } finally {
      setRefreshing(false)
    }
  }

  // reloadFlag là tín hiệu "vừa ghi xong đơn" -> làm mới catalog qua React Query.
  // Bỏ qua lần render đầu vì query đã tự fetch khi mount.
  const didMountRef = useRef(false)
  useEffect(() => {
    if (!didMountRef.current) { didMountRef.current = true; return }
    queryClient.invalidateQueries({ queryKey: ["inventory"] })
    queryClient.invalidateQueries({ queryKey: ["accessories-inventory"] })
    queryClient.invalidateQueries({ queryKey: ["partner-inventory"] })
  }, [reloadFlag, queryClient])

  // === CART === addToCart/addPartnerItemToCart/updateQuantity/removeFromCart chuyển sang useCart

  // === CHECKOUT ===
  // isWarrantyEligible/computeCartSubtotal/computeWarrantyTotal tách sang lib/ban-hang/totals.ts
  const tongTien = computeCartSubtotal(cart)
  const thanhToan = tongTien - giamGia // (chưa cộng phí bảo hành)
  const warrantyTotal = computeWarrantyTotal(cart, selectedWarranties, warrantyPackages)
  // Cơ sở tính giảm giá: tổng tiền hàng + phí bảo hành trước giảm
  const discountBase = Math.max(tongTien + warrantyTotal, 0)
  
  // Tính toán Giảm giá động (logic tách sang lib/ban-hang/discount.ts, giữ nguyên hành vi)
  const { amount: computedGiamGia, msg: computedDiscountMsg } = computeDynamicDiscount(giamGiaInput, discountBase);

  const giamGiaToUse = computedGiamGia > 0 ? computedGiamGia : giamGia;
  
  const finalThanhToan = Math.max(tongTien + warrantyTotal - giamGiaToUse - (currentDepositOrderId ? depositAmountAlreadyPaid : 0), 0)
  const expectedCollect = loaiThanhToan === 'Đặt cọc' ? Math.max(Number(soTienCoc)||0, 0) : finalThanhToan

  
  // handleDiscountPreset chuyển sang hook useDiscount
  // Tổng thanh toán ngay (không bao gồm phần góp): Tiền mặt + Chuyển khoản + Thẻ + Thu máy
  const immediateSum = (cashEnabled ? (cashAmount||0) : 0)
    + (transferEnabled ? (transferAmount||0) : 0)
    + (cardEnabled ? (cardAmount||0) : 0)
    + (thuMayEnabled ? (thuMayAmount||0) : 0)
  // COD chỉ áp dụng khi đơn onl + vận chuyển GHTK
  const codActive = loaiDon === 'Đơn onl' && hinhThucVanChuyen === 'GHTK'
  const codToUse = codActive ? (codAmount || 0) : 0
  // Thu máy xuống đời: phần dư sau khi trừ hết tiền đơn là tiền shop phải trả lại khách.
  // Chỉ mở khi có thu máy, để việc gõ dư tiền mặt/chuyển khoản vẫn báo lệch như cũ.
  const grossPayments = immediateSum + (installmentEnabled ? (installmentLoan||0) : 0) + codToUse
  const tienTraKhach = (thuMayEnabled && (thuMayAmount||0) > 0)
    ? Math.max(0, grossPayments - expectedCollect)
    : 0
  // Logic trả góp: Trả trước = immediateSum. Tổng đã nhập = Trả trước + Góp + COD (thu hộ GHTK)
  const sumPayments = Math.max(0, grossPayments - tienTraKhach)
  // Nếu có trả góp, yêu cầu Trả trước == (Tiền mặt + Chuyển khoản + Thẻ + Thu máy - Trả lại khách)
  const mustMatchDownPayment = !installmentEnabled || ((installmentDown||0) === (immediateSum - tienTraKhach))
  const paymentParts: string[] = []
  const parseStoredDepositPayments = (summary: string) => {
    return String(summary || "")
      .split("|")
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const amountMatch = part.match(/(\d[\d.]*)/)
        const amount = amountMatch ? Number(String(amountMatch[1]).replace(/\D/g, "")) || 0 : 0
        const normalized = normalizeVi(part)
        if (!amount) return null
        if (normalized.includes("tien mat")) return { method: "Tiền mặt (cọc trước)", amount }
        if (normalized.includes("chuyen khoan")) return { method: "Chuyển khoản (cọc trước)", amount }
        if (normalized.includes("the")) return { method: "Thẻ (cọc trước)", amount }
        return { method: "Đặt cọc trước", amount }
      })
      .filter(Boolean) as Array<{ method: string; amount: number }>
  }
  if (cashEnabled && cashAmount>0) paymentParts.push(`Tiền mặt: ₫${cashAmount.toLocaleString('vi-VN')}`)
  if (transferEnabled && transferAmount>0) paymentParts.push(`Chuyển khoản: ₫${transferAmount.toLocaleString('vi-VN')}`)
  if (cardEnabled && cardAmount>0) paymentParts.push(`Thẻ: ₫${cardAmount.toLocaleString('vi-VN')}`)
  if (thuMayEnabled && thuMayAmount>0) paymentParts.push(`Thu máy: ₫${thuMayAmount.toLocaleString('vi-VN')}`)
  if (codActive && codToUse>0) paymentParts.push(`COD (GHTK): ₫${codToUse.toLocaleString('vi-VN')}`)
  if (tienTraKhach>0) paymentParts.push(`Trả lại khách - ${traKhachMethod}: ₫${tienTraKhach.toLocaleString('vi-VN')}`)
  if (installmentEnabled && (installmentDown>0 || installmentLoan>0)) {
    const label = installmentType || 'Trả góp'
    const parts: string[] = []
    if (installmentDown>0) parts.push(`Trả trước ₫${installmentDown.toLocaleString('vi-VN')}`)
    if (installmentLoan>0) parts.push(`Góp ₫${installmentLoan.toLocaleString('vi-VN')}`)
    paymentParts.push(`${label}: ${parts.join(' + ')}`)
  }
  const depositSummaryLabel =
    currentDepositOrderId && depositAmountAlreadyPaid > 0
      ? `Đặt cọc trước: ${depositPaymentSummary || `₫${depositAmountAlreadyPaid.toLocaleString('vi-VN')}`}`
      : ""
  if (depositSummaryLabel) paymentParts.push(depositSummaryLabel)
  const paymentSummary = paymentParts.join(' | ')
  // Thông tin máy thu cũ -> gộp vào Ghi chú (để hiện trong Telegram)
  const thuMayNote = thuMayEnabled
    ? `[Thu máy cũ] ${[thuMayTenSanPham.trim(), thuMayLoaiMay.trim()].filter(Boolean).join(' - ')}${thuMayImei.trim() ? ` | IMEI: ${thuMayImei.trim()}` : ''} | Giá thu: ₫${(thuMayAmount || 0).toLocaleString('vi-VN')}${tienTraKhach > 0 ? ` | Shop trả lại khách ₫${tienTraKhach.toLocaleString('vi-VN')} (${traKhachMethod})` : ''}`
    : ''
  const ghiChuFull = [ghiChu.trim(), thuMayNote].filter(Boolean).join(' | ')
  const paymentsArray = [
    cashEnabled && cashAmount>0 ? { method: 'Tiền mặt', amount: cashAmount } : null,
    transferEnabled && transferAmount>0 ? { method: 'Chuyển khoản', amount: transferAmount } : null,
    cardEnabled && cardAmount>0 ? { method: 'Thẻ', amount: cardAmount } : null,
    thuMayEnabled && thuMayAmount>0 ? { method: 'Thu máy', amount: thuMayAmount } : null,
    codActive && codToUse>0 ? { method: 'COD', amount: codToUse } : null,
    tienTraKhach>0 ? { method: `Trả lại khách - ${traKhachMethod}`, amount: tienTraKhach } : null,
  ].filter(Boolean) as any[]
  if (installmentEnabled && (installmentDown>0 || installmentLoan>0)) {
    paymentsArray.push({ method: 'Trả góp', provider: installmentType || undefined, downPayment: installmentDown||0, loanAmount: installmentLoan||0, amount: (installmentDown||0)+(installmentLoan||0) })
  }
  if (currentDepositOrderId && depositAmountAlreadyPaid > 0) {
    const parsedDepositPayments = parseStoredDepositPayments(depositPaymentSummary)
    if (parsedDepositPayments.length > 0) {
      paymentsArray.push(...parsedDepositPayments)
    } else {
      paymentsArray.push({
        method: 'Đặt cọc trước',
        amount: depositAmountAlreadyPaid,
      })
    }
  }

  // Tập định danh các máy đã có trong giỏ (để tô màu ở bảng tìm kiếm)
  const cartProductKeys = useMemo(() => {
    const s = new Set<string>()
    for (const it of cart) {
      if (it.type !== 'product') continue
      if (it.id) s.add(String(it.id))
      if (it.imei) s.add(String(it.imei))
      if (it.serial) s.add(String(it.serial))
    }
    return s
  }, [cart])

  // Kết quả tìm kiếm sau khi áp bộ lọc Nguồn/Loại + bộ lọc nâng cao, dùng chung cho mobile cards + desktop table
  const filteredSearchResults = useMemo(() => {
    const isIpad = (p: any) => {
      const name = String(p.ten_san_pham || '').toLowerCase()
      const loai = String(p.loai_may || p['Loại Máy'] || '').toLowerCase()
      return name.includes('ipad') || loai.includes('ipad')
    }
    const [minP, maxP] = priceRange
    const isSimGhep = (p: any) => {
      const t = normalizeVi(`${p.loai_phu_kien || ''} ${p.ten_san_pham || ''}`)
      return t.includes('sim ghep') || t.includes('simghep')
    }
    return searchResults.filter((p: any) => {
      const src = String(p.nguon || p.source || "").toLowerCase()
      const isPartner = !!src.match(/kho ngoài|kho ngoài/i)
      // Tab "Phụ kiện": hiện tất cả phụ kiện bán riêng
      if (filterType === 'phu_kien') {
        if (!isAccessoryItem(p)) return false
        const gia = Number(p.gia_ban || 0)
        if (productNameFilter !== "all" && p.ten_san_pham !== productNameFilter) return false
        if (minP > 0 && gia < minP) return false
        if (maxP > 0 && maxP < BH_MAX_PRICE && gia > maxP) return false
        return true
      }
      // Tab "Sim ghép": chỉ hiện phụ kiện sim ghép, bỏ qua các bộ lọc dành cho máy
      if (filterType === 'sim_ghep') return isAccessoryItem(p) && isSimGhep(p)
      // Các tab còn lại: phụ kiện không hiển thị (đã chuyển sang tích kèm máy trong giỏ)
      if (isAccessoryItem(p)) return false
      if (filterSource === "kho" && isPartner) return false
      if (filterSource === "doi_tac" && !isPartner) return false
      if (filterType==='iphone') {
        if (isIpad(p)) return false
      }
      if (filterType==='ipad') {
        if (!isIpad(p)) return false
      }

      // Bộ lọc tên sản phẩm (áp cho cả máy lẫn phụ kiện)
      if (productNameFilter !== "all" && p.ten_san_pham !== productNameFilter) return false

      // Khoảng giá (áp cho tất cả)
      const gia = Number(p.gia_ban || 0)
      if (minP > 0 && gia < minP) return false
      if (maxP > 0 && maxP < BH_MAX_PRICE && gia > maxP) return false

      // Loại máy (Lock / Quốc tế)
      if (loaiMayFilter !== "all") {
        const type = String(p.loai_may || p['Loại Máy'] || "").toLowerCase()
        if (loaiMayFilter === "Lock") {
          if (!type.includes("lock")) return false
        } else {
          if (!(type.includes("qte") || type.includes("qt") || type.includes("quoc te") || type.includes("quốc tế"))) return false
        }
      }
      // Màu
      if (colorFilter !== "all" && (p.mau_sac || p['Màu Sắc']) !== colorFilter) return false
      // Dung lượng
      if (capacityFilter !== "all" && (p.dung_luong || p['Dung Lượng']) !== capacityFilter) return false
      // Pin
      if (pinFilter !== "all") {
        const pinVal = parseInt(String(p.pin ?? p['Pin (%)'] ?? "0").replace(/[^\d]/g, ''))
        if (!pinVal) return false
        if (pinFilter === "100" && pinVal !== 100) return false
        if (pinFilter === "9x" && !(pinVal >= 90 && pinVal < 100)) return false
        if (pinFilter === "8x" && !(pinVal >= 80 && pinVal < 90)) return false
        if (pinFilter === "7x" && !(pinVal >= 70 && pinVal < 80)) return false
        if (pinFilter === "lt70" && !(pinVal < 70)) return false
      }
      return true
    })
  }, [searchResults, filterSource, filterType, productNameFilter, loaiMayFilter, colorFilter, capacityFilter, pinFilter, priceRange])

  // Tùy chọn động cho dropdown (lấy từ máy trong kết quả tìm kiếm, có cross-filter giống Kho hàng)
  const advancedFilterOptions = useMemo(() => {
    const phones = searchResults.filter((p: any) => {
      if (isAccessoryItem(p)) return false
      const src = String(p.nguon || p.source || "").toLowerCase()
      const isPartner = !!src.match(/kho ngoài|kho ngoài/i)
      if (filterSource === "kho" && isPartner) return false
      if (filterSource === "doi_tac" && !isPartner) return false
      return true
    })
    const matchName = (p: any) => productNameFilter === "all" || p.ten_san_pham === productNameFilter
    const matchColor = (p: any) => colorFilter === "all" || (p.mau_sac || p['Màu Sắc']) === colorFilter
    const matchCap = (p: any) => capacityFilter === "all" || (p.dung_luong || p['Dung Lượng']) === capacityFilter
    const sortVi = (a: string, b: string) => a.localeCompare(b, "vi", { sensitivity: "base" })

    const productNames = Array.from(new Set(
      phones.filter((p) => matchColor(p) && matchCap(p)).map((p: any) => p.ten_san_pham).filter(Boolean)
    )) as string[]
    const colors = Array.from(new Set(
      phones.filter((p) => matchName(p) && matchCap(p)).map((p: any) => p.mau_sac || p['Màu Sắc']).filter(Boolean)
    )) as string[]
    const capacities = Array.from(new Set(
      phones.filter((p) => matchName(p) && matchColor(p)).map((p: any) => p.dung_luong || p['Dung Lượng']).filter(Boolean)
    )) as string[]

    return {
      productNames: productNames.sort(sortVi),
      colors: colors.sort(sortVi),
      capacities: capacities.sort(sortVi),
    }
  }, [searchResults, filterSource, productNameFilter, colorFilter, capacityFilter])

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

  // Chỉ MÁY trong danh sách đã lọc — dùng cho "Copy tổng" và chọn hàng loạt
  // (phụ kiện không có IMEI/Serial và được quản lý ở tab Xử lý > Tồn phụ kiện).
  const machineResults = useMemo(
    () => sortedSearchResults.filter((p: any) => !!(p.imei || p.serial)),
    [sortedSearchResults],
  )

  // Hành động quản lý (CNC / giao đối tác / đang xử lý / chuyển kho) chỉ áp được cho máy
  // nằm trong sheet Kho_Hang. Máy kho ngoài vẫn bán được nhưng không chọn hàng loạt được.
  const manageableIds = useMemo(() => {
    const ids = new Set(allInventoryProducts.map((p: any) => String(p.id)))
    return machineResults.filter((p: any) => ids.has(String(p.id))).map((p: any) => String(p.id))
  }, [machineResults, allInventoryProducts])

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
    // Đơn online GHTK: bắt buộc Mã đơn GHTK. Tiền thu hộ COD được phép = 0
    // (khách đã thanh toán trước, shipper không thu hộ).
    if (loaiDon === 'Đơn onl' && hinhThucVanChuyen === 'GHTK') {
      if (!maGhtk.trim()) {
        toast({ title: 'Thiếu mã đơn GHTK', description: 'Vui lòng nhập Mã đơn hàng GHTK cho đơn online.', variant: 'destructive' as any })
        try { setMobileView('thanh-toan') } catch {}
        return
      }
      if (codAmount < 0) {
        toast({ title: 'Tiền thu hộ COD không hợp lệ', description: 'Tiền thu hộ COD không được âm.', variant: 'destructive' as any })
        try { setMobileView('thanh-toan') } catch {}
        return
      }
    }
    // Quy tắc: Nếu có trả góp, Trả trước phải bằng tổng thanh toán ngay (Tiền mặt + Chuyển khoản + Thẻ + Thu máy)
    if (installmentEnabled && ((installmentDown||0) !== ((cashEnabled ? (cashAmount||0) : 0) + (transferEnabled ? (transferAmount||0) : 0) + (cardEnabled ? (cardAmount||0) : 0) + (thuMayEnabled ? (thuMayAmount||0) : 0)))) {
      const immediate = (cashEnabled ? (cashAmount||0) : 0) + (transferEnabled ? (transferAmount||0) : 0) + (cardEnabled ? (cardAmount||0) : 0) + (thuMayEnabled ? (thuMayAmount||0) : 0)
      toast({
        title: 'Trả trước chưa khớp',
        description: `Trả trước ₫${(installmentDown||0).toLocaleString('vi-VN')} phải bằng tổng Tiền mặt + Chuyển khoản + Thẻ + Thu máy: ₫${immediate.toLocaleString('vi-VN')}`,
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
            .filter(p => !String(p.id || '').startsWith('DT-'))
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
            hinh_thuc_van_chuyen: buildShipMethod(),
            dia_chi_nhan: loaiDon === "Đơn onl" ? diaChiNhan : "",
            "Địa Chỉ Nhận": loaiDon === "Đơn onl" ? diaChiNhan : "",
            ngay_dat_coc: new Date().toLocaleDateString("vi-VN"),
            ghi_chu: ghiChuFull,
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
            .filter(p => !String(p.id || '').startsWith('DT-'))
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
          setGiamGiaInput("")
          setGhiChu("")
          setMaGhtk("")
          setCashEnabled(false); setTransferEnabled(false); setCardEnabled(false); setThuMayEnabled(false)
          setCashAmount(0); setTransferAmount(0); setCardAmount(0); setThuMayAmount(0); setCodAmount(0)
          setThuMayTenSanPham(""); setThuMayLoaiMay(""); setThuMayImei(""); setTraKhachMethod("Tiền mặt")
          setInstallmentEnabled(false); setInstallmentType(''); setInstallmentDown(0); setInstallmentLoan(0)
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
            .filter(p => !String(p.id || '').startsWith('DT-'))
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
          .filter(p => !String(p.id || '').startsWith('DT-'))
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
          "Hình Thức Vận Chuyển": buildShipMethod(),
          "Lãi": "",
          "Ghi Chú": ghiChuFull,
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
            nguon_nhap: p.nguon_nhap || '',
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
              nguon_hang: products.some(p => String(p.nguon || p.source || '').toLowerCase().includes('kho ngoài')) ? 'Kho ngoài' : '',
              coreTotal: thanhToan,
              warrantyTotal: warrantyTotal,
              grossTotal: tongTien + warrantyTotal - giamGiaToUse,
              finalThanhToan: finalThanhToan,
              so_tien_coc: depositAmountAlreadyPaid,
              is_settlement: !!currentDepositOrderId,
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
          // Trừ tồn phụ kiện là best-effort ở server (đơn đã ghi xong rồi) nên phải
          // báo rõ cho nhân viên khi trừ không thành, tránh tồn kho lệch âm thầm.
          if (Array.isArray(order?.phuKienWarnings) && order.phuKienWarnings.length > 0) {
            toast({
              title: 'Tồn phụ kiện chưa trừ đúng',
              description: order.phuKienWarnings.join(' • '),
              variant: 'destructive' as any,
            })
          }
          if (order && (order.id_don_hang || order.ma_don_hang) && loaiThanhToan !== "Đặt cọc") {
            const derivedOrderType = loaiDon?.toLowerCase?.() ? (loaiDon.toLowerCase().includes('onl') ? 'online' : 'offline') : undefined;
            try {
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
              toast({ title: 'Lỗi gửi ảnh Telegram', description: String(err), variant: 'destructive' as any });
            }
          }
          setCart([]);
          setSelectedCustomer(null);
          setGiamGia(0);
          setGhiChu("")
          setMaGhtk("");
          setDiaChiNhan("");
          setCashEnabled(false); setTransferEnabled(false); setCardEnabled(false); setThuMayEnabled(false);
          setCashAmount(0); setTransferAmount(0); setCardAmount(0); setThuMayAmount(0); setCodAmount(0);
          setThuMayTenSanPham(""); setThuMayLoaiMay(""); setThuMayImei(""); setTraKhachMethod("Tiền mặt");
          setInstallmentEnabled(false); setInstallmentType(''); setInstallmentDown(0); setInstallmentLoan(0);
          setGiamGiaInput("");
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
          setDepositPaymentSummary("")

          toast({ title: 'Tạo đơn thành công', description: `Mã: ${order.id_don_hang || order.ma_don_hang || ''}` })
          if (order?.telegram?.success === false) {
            toast({
              title: 'Cảnh báo Telegram',
              description: `Đơn đã tạo nhưng Telegram lỗi: ${String(order.telegram.error || 'Không rõ lỗi')}`,
              variant: 'destructive' as any,
            })
          }
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
      <PullToRefresh onRefresh={handleRefreshAll}>
      <div className="space-y-6 pb-28 md:pb-0">
        {/* Thẻ số liệu chỉ hiện trên desktop: trên mobile ưu tiên ô tìm kiếm để bán hàng. */}
        {!isMobile && <InventoryStats
          {...inventoryStats}
          onNavigate={(target) => {
            if (target === "san-pham") { setActiveTab("ban-hang"); return }
            setActiveTab("xu-ly")
            setManageTab(target)
          }}
        />}

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="z-30 bg-card shadow-sm">
            <TabsTrigger
              value="ban-hang"
              className="data-[state=active]:bg-blue-100 data-[state=active]:text-blue-700 data-[state=active]:border-blue-500"
            >
              Bán hàng &amp; Kho
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
            <TabsTrigger
              value="xu-ly"
              className="data-[state=active]:bg-blue-100 data-[state=active]:text-blue-700 data-[state=active]:border-blue-500"
            >
              Xử lý
            </TabsTrigger>
          </TabsList>

          <TabsContent value="ban-hang">
            {isMobile && (
              <div className="sticky top-0 z-30 bg-card border-b px-4 py-2 flex gap-2">
                <Button size="sm" variant={mobileView==='san-pham'? 'default':'outline'} className="flex-1" onClick={()=> setMobileView('san-pham')}>Sản phẩm</Button>
                <Button size="sm" variant={mobileView==='gio-hang'? 'default':'outline'} className="flex-1" onClick={()=> setMobileView('gio-hang')}>Giỏ hàng ({cart.length})</Button>
                <Button size="sm" variant={mobileView==='thanh-toan'? 'default':'outline'} className="flex-1" onClick={()=> setMobileView('thanh-toan')}>Thanh toán</Button>
              </div>
            )}

            {/* Toolbar quản lý kho — gộp từ trang Kho hàng cũ */}
            {(!isMobile || mobileView === 'san-pham') && (
              <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap gap-2">
                  <Button
                    onClick={() => { setSelectedProduct(null); setIsProductDialogOpen(true) }}
                    className="bg-emerald-600 hover:bg-emerald-700 shadow-sm"
                  >
                    <Plus className="w-4 h-4 mr-2" /> Nhập hàng
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    title="Chọn hàng loạt"
                    className={isEditMode ? "bg-blue-50 text-blue-600 border-blue-200" : ""}
                    onClick={() => { setIsEditMode(!isEditMode); setSelectedIds([]) }}
                  >
                    <ListChecks className="w-4 h-4" />
                  </Button>
                  <RefreshButton onRefresh={handleRefreshAll} loading={refreshing} className="h-10 w-10" />
                  <Button
                    variant="outline"
                    className="border-sky-300 text-sky-700 hover:bg-sky-50 hover:text-sky-700 dark:border-sky-500/40 dark:text-sky-400 dark:hover:bg-sky-500/10 dark:hover:text-sky-300"
                    title="Copy tin báo khách toàn bộ danh sách đã lọc"
                    disabled={!machineResults.length}
                    onClick={async () => {
                      if (!machineResults.length) { sonnerToast.error("Không có máy nào trong danh sách để copy"); return }
                      const ok = await copyTextToClipboard(buildCustomerQuoteList(machineResults))
                      if (ok) sonnerToast.success(`Đã copy ${machineResults.length} máy để báo khách`)
                      else sonnerToast.error("Không copy được, thử lại giúp mình")
                    }}
                  >
                    <Copy className="w-4 h-4 mr-2" /> Copy tổng ({machineResults.length})
                  </Button>
                </div>

                {isEditMode && selectedIds.length > 0 && (
                  <div className="flex flex-wrap items-center gap-2 animate-in fade-in slide-in-from-left-2">
                    <Badge variant="secondary" className="h-9 rounded-md px-3">Đã chọn {selectedIds.length}</Badge>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-9 border-amber-300 text-amber-700 hover:bg-amber-50 hover:text-amber-700 dark:border-amber-500/40 dark:text-amber-400 dark:hover:bg-amber-500/10"
                      onClick={() => setIsSendCNCDialogOpen(true)}
                    >
                      Gửi CNC
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-9 border-purple-300 text-purple-700 hover:bg-purple-50 hover:text-purple-700 dark:border-purple-500/40 dark:text-purple-400 dark:hover:bg-purple-500/10"
                      onClick={() => setIsSendPartnerDialogOpen(true)}
                    >
                      Giao đối tác
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-9 border-yellow-300 text-yellow-700 hover:bg-yellow-50 hover:text-yellow-700 dark:border-yellow-500/40 dark:text-yellow-400 dark:hover:bg-yellow-500/10"
                      disabled={isTogglingDangXuLy}
                      onClick={() => {
                        toggleDangXuLy({
                          productIds: selectedIds,
                          employeeName: me?.name || me?.employeeId || "NV-UNKNOWN",
                        }).then(clearMachineSelection).catch(() => {})
                      }}
                    >
                      Đang xử lý
                    </Button>
                    <Select onValueChange={(val) => {
                      bulkUpdateNguon({
                        productIds: selectedIds,
                        nguon: val,
                        employeeId: me?.employeeId || "NV-UNKNOWN",
                      }).then(clearMachineSelection).catch(() => {})
                    }}>
                      <SelectTrigger className="h-9 w-[130px] border-emerald-300 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-500/40 dark:text-emerald-400">
                        <SelectValue placeholder="Chuyển kho" />
                      </SelectTrigger>
                      <SelectContent className="bg-card">
                        <SelectItem value="Kho trong">Kho trong</SelectItem>
                        <SelectItem value="Kho ngoài">Kho ngoài</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
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
                  isManager={isManager}
                  cartProductKeys={cartProductKeys}
                  isEditMode={isEditMode}
                  selectedIds={selectedIds}
                  onSelect={(id) => {
                    if (!allInventoryProducts.some((p: any) => String(p.id) === String(id))) {
                      sonnerToast.error("Chỉ chọn được máy trong kho (Kho_Hang)")
                      return
                    }
                    handleSelectMachine(id)
                  }}
                  onSelectAll={() => {
                    if (selectedIds.length === manageableIds.length) setSelectedIds([])
                    else setSelectedIds(manageableIds)
                  }}
                  onEditProduct={(p) => {
                    // Chỉ máy trong sheet Kho_Hang mới sửa được (máy kho ngoài có id "DT-...")
                    const inStock = allInventoryProducts.find((x: any) => x.id === p.id)
                    if (!inStock) { sonnerToast.error("Chỉ sửa được máy trong kho (Kho_Hang)"); return }
                    setSelectedProduct(inStock)
                    setIsProductDialogOpen(true)
                  }}
                  onSendCNC={(p) => { setSelectedIds([p.id]); setIsSendCNCDialogOpen(true) }}
                  onSendPartner={(p) => { setSelectedIds([p.id]); setIsSendPartnerDialogOpen(true) }}
                  onToggleProcessing={(p) => {
                    if (String(p.id).startsWith("DT-")) {
                      sonnerToast.error("Chỉ đánh dấu được máy trong kho (Kho_Hang)")
                      return
                    }
                    toggleDangXuLy({
                      productIds: [p.id],
                      employeeName: me?.name || me?.employeeId || "NV-UNKNOWN",
                    }).catch(() => {})
                  }}
                  advancedFilter={filterType === "phu_kien" || filterType === "sim_ghep"
                    ? null
                    : (
                      <AdvancedFilterBar
                        productNames={advancedFilterOptions.productNames}
                        colors={advancedFilterOptions.colors}
                        capacities={advancedFilterOptions.capacities}
                        maxPrice={BH_MAX_PRICE}
                      />
                    )}
                />

                {(!isMobile || mobileView === 'gio-hang') && (
                  <Card className="min-h-[120px] h-full w-full flex flex-col lg:min-h-[360px]">
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
                          <span className="text-xs text-muted-foreground">Chọn sản phẩm và bấm &quot;Thêm&quot; để đưa vào giỏ</span>
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
                          accessoryProducts={allAccessoryProducts}
                          isManager={isManager}
                        />
                      )}
                    </CardContent>
                  </Card>
                )}
              </div>

              {(!isMobile || mobileView === 'thanh-toan') && (
                <div className="space-y-6 lg:max-w-[520px]">
                  {/* Khách hàng */}
                  <CustomerCard
                    customerResults={customerResults}
                    selectedCustomer={selectedCustomer}
                    setSelectedCustomer={setSelectedCustomer}
                    setCustomerSearch={setCustomerSearch}
                    setCustomerResults={setCustomerResults}
                    setIsCustomerSelectOpen={setIsCustomerSelectOpen}
                  />

                  {/* Thanh toán */}
                  <PaymentColumn
                    cashEnabled={cashEnabled} setCashEnabled={setCashEnabled}
                    cashAmount={cashAmount} setCashAmount={setCashAmount}
                    transferEnabled={transferEnabled} setTransferEnabled={setTransferEnabled}
                    transferAmount={transferAmount} setTransferAmount={setTransferAmount}
                    cardEnabled={cardEnabled} setCardEnabled={setCardEnabled}
                    cardAmount={cardAmount} setCardAmount={setCardAmount}
                    thuMayEnabled={thuMayEnabled} setThuMayEnabled={setThuMayEnabled}
                    thuMayAmount={thuMayAmount} setThuMayAmount={setThuMayAmount}
                    thuMayTenSanPham={thuMayTenSanPham} setThuMayTenSanPham={setThuMayTenSanPham}
                    thuMayLoaiMay={thuMayLoaiMay} setThuMayLoaiMay={setThuMayLoaiMay}
                    thuMayImei={thuMayImei} setThuMayImei={setThuMayImei}
                    tienTraKhach={tienTraKhach}
                    traKhachMethod={traKhachMethod} setTraKhachMethod={setTraKhachMethod}
                    installmentEnabled={installmentEnabled} setInstallmentEnabled={setInstallmentEnabled}
                    installmentType={installmentType} setInstallmentType={setInstallmentType}
                    installmentDown={installmentDown} setInstallmentDown={setInstallmentDown}
                    installmentLoan={installmentLoan} setInstallmentLoan={setInstallmentLoan}
                    sumPayments={sumPayments} expectedCollect={expectedCollect}
                    handleDiscountPreset={handleDiscountPreset}
                    giamGiaInput={giamGiaInput} setGiamGiaInput={setGiamGiaInput}
                    setGiamGia={setGiamGia} setDiscountParseMsg={setDiscountParseMsg}
                    computedDiscountMsg={computedDiscountMsg} discountParseMsg={discountParseMsg}
                    ghiChu={ghiChu} setGhiChu={setGhiChu}
                    tongTien={tongTien} warrantyTotal={warrantyTotal} giamGiaToUse={giamGiaToUse}
                    currentDepositOrderId={currentDepositOrderId} depositAmountAlreadyPaid={depositAmountAlreadyPaid}
                    finalThanhToan={finalThanhToan}
                    loaiDon={loaiDon} setLoaiDon={setLoaiDon}
                    hinhThucVanChuyen={hinhThucVanChuyen} setHinhThucVanChuyen={setHinhThucVanChuyen}
                    maGhtk={maGhtk} setMaGhtk={setMaGhtk}
                    codAmount={codAmount} setCodAmount={setCodAmount}
                    diaChiNhan={diaChiNhan} setDiaChiNhan={setDiaChiNhan}
                    loaiThanhToan={loaiThanhToan} setLoaiThanhToan={setLoaiThanhToan}
                    soTienCoc={soTienCoc} setSoTienCoc={setSoTienCoc}
                    ngayHenTraDu={ngayHenTraDu} setNgayHenTraDu={setNgayHenTraDu}
                    receiptBlobs={receiptBlobs} setReceiptBlobs={setReceiptBlobs}
                    isLoading={isLoading} cartCount={cart.length} handleCheckout={handleCheckout}
                  />
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="don-dat-coc">
            <DepositOrdersTab
              depositOrdersState={depositOrdersState}
              depositSearch={depositSearch}
              setDepositSearch={setDepositSearch}
              depositLoading={depositLoading}
              setCart={setCart}
              setSelectedCustomer={setSelectedCustomer}
              setCurrentDepositOrderId={setCurrentDepositOrderId}
              setDepositAmountAlreadyPaid={setDepositAmountAlreadyPaid}
              setDepositPaymentSummary={setDepositPaymentSummary}
              setLoaiThanhToan={setLoaiThanhToan}
              toast={toast}
              setActiveTab={setActiveTab}
              handleCancelDeposit={handleCancelDeposit}
            />
          </TabsContent>

          {/* Xử lý: CNC / Bảo hành / Giao đối tác / Hàng đối tác / Tồn phụ kiện */}
          <TabsContent value="xu-ly">
            <div className="mt-4 space-y-4">
              <div className="flex flex-wrap gap-2">
                {MANAGE_TABS.map((t) => (
                  <Button
                    key={t.key}
                    size="sm"
                    variant={manageTab === t.key ? "default" : "outline"}
                    className={manageTab === t.key ? "bg-blue-600 text-white hover:bg-blue-700" : ""}
                    onClick={() => setManageTab(t.key)}
                  >
                    {t.label}
                  </Button>
                ))}
              </div>
              <ManageTabs
                tab={manageTab}
                isManager={isManager}
                onAddPartnerToCart={(products) => {
                  // Chốt bán máy đối tác: đẩy thẳng vào giỏ của trang này.
                  // Trước khi gộp phải ghi localStorage rồi reload sang trang Bán hàng.
                  products.forEach((p: any) => addPartnerItemToCart({
                    ...p,
                    model: p.ten_san_pham || p.model,
                    gia_goi_y_ban: typeof p.gia_ban === 'number' ? p.gia_ban : p.gia_goi_y_ban,
                    gia_chuyen: typeof p.gia_nhap === 'number' ? p.gia_nhap : p.gia_chuyen,
                    bo_nho: p.dung_luong || p.bo_nho,
                    mau: p.mau_sac || p.mau,
                    pin_pct: p.pin || p.pin_pct,
                    sheet: p.partner_sheet || p.sheet,
                    row_index: p.partner_row_index || p.row_index,
                  }))
                  setActiveTab("ban-hang")
                  if (isMobile) setMobileView("gio-hang")
                  sonnerToast.success(`Đã thêm ${products.length} máy vào giỏ hàng`)
                }}
              />
            </div>
          </TabsContent>
        </Tabs>
      </div>
      </PullToRefresh>

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
      <MobileCheckoutBar
        finalThanhToan={finalThanhToan}
        mobileView={mobileView}
        setMobileView={setMobileView}
        cartCount={cart.length}
        handleCheckout={handleCheckout}
        isLoading={isLoading}
      />

      {/* ===== Dialog quản lý kho (gộp từ trang Kho hàng) ===== */}
      <ProductDialog
        isOpen={isProductDialogOpen}
        onClose={() => { setIsProductDialogOpen(false); setSelectedProduct(null) }}
        product={selectedProduct}
        onSuccess={() => { setReloadFlag((f) => f + 1) }}
      />
      <SendCNCDialog
        isOpen={isSendCNCDialogOpen}
        onClose={() => setIsSendCNCDialogOpen(false)}
        selectedProducts={allInventoryProducts.filter((p: any) => selectedIds.includes(p.id))}
        onSuccess={clearMachineSelection}
      />
      <SendPartnerDialog
        open={isSendPartnerDialogOpen}
        onOpenChange={setIsSendPartnerDialogOpen}
        selectedProducts={allInventoryProducts.filter((p: any) => selectedIds.includes(p.id))}
        employeeId={me?.employeeId}
        onSuccess={clearMachineSelection}
      />
    </ProtectedRoute>
  )
}
