// Kiểu dữ liệu cho dialog xem thông tin bảo hành
type ViewCustomer = {
  dia_chi_bao_hanh?: string;
  ten_khach_hang?: string;
  so_dien_thoai?: string;
  imei?: string;
  pos?: { x: number; y: number };
};
"use client"
import { useState, useEffect, useMemo } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Plus, Edit2, Eye } from "lucide-react"
import { Slider } from "@/components/ui/slider"
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerFooter, DrawerClose } from "@/components/ui/drawer"
  // Dialog xem thông tin khách hàng CNC
  
import { ProductDialog } from "@/components/kho-hang/product-dialog"
import AddCNCMachineDialog from "@/components/kho-hang/add-cnc-machine-dialog"
// Dialog thêm máy bảo hành ngoài kho
import AddBaoHanhMachineDialog from "../../../components/kho-hang/add-baohanh-machine-dialog"
import { useIsMobile } from "@/hooks/use-mobile"

interface CNCProduct {
  id: string;
  ten_san_pham: string;
  imei: string;
  mau_sac?: string;
  [key: string]: any; // Cho phép truy cập động các trường như "Màu Sắc"
  nguon: string;
  tinh_trang: string;
  loai_may: string;
  trang_thai: string;
  dia_chi_cnc: string;
  ngay_gui: string;
  ngay_nhan_lai: string;
  ten_khach_hang?: string;
  so_dien_thoai?: string;
}

interface Product {
  id: string;
  ten_san_pham: string;
  loai_phu_kien: string;
  dung_luong: string;
  mau_sac: string;
  pin: string;
  imei: string;
  serial?: string;
  tinh_trang: string;
  gia_nhap: number;
  gia_ban: number;
  trang_thai: string;
  trang_thai_kho?: string;
  ngay_nhap: string;
  ghi_chu?: string;
  loi?: string;
  dia_chi_bao_hanh?: string;
  loai_may?: string;
  nguon?: string;
  ten_doi_tac?: string;
  sdt_doi_tac?: string;
  partner_sheet?: string;
  partner_row_index?: number;
  ngay_gui?: string;
  ngay_nhan_lai?: string;
  ten_khach_hang?: string;
  so_dien_thoai?: string;
}

export default function KhoHangPage() {
  const isMobile = useIsMobile()
  const [viewCustomer, setViewCustomer] = useState<ViewCustomer | null>(null)
  const [dialogInfo, setDialogInfo] = useState<{
    data: { dia_chi_bao_hanh?: string; ten_khach_hang?: string; so_dien_thoai?: string; imei?: string }
    pos: { x: number; y: number }
  } | null>(null)

  // CNC selection and completion
  const [isEditCNCMode, setIsEditCNCMode] = useState(false)
  const [selectedCNCImeis, setSelectedCNCImeis] = useState<string[]>([])
  const [confirmCNCAction, setConfirmCNCAction] = useState(false)

  // Địa chỉ bảo hành mặc định và quản lý thêm mới
  const BAOHANH_DEFAULT = {
    label: "Tâm Táo",
    value: "Tâm Táo (9A Đường số 6, KP5, Linh Tây, Thủ Đức)",
    desc: "9A Đường số 6, KP5, Linh Tây, Thủ Đức",
  }
  const BAOHANH_EX = {
    label: "EX shop Tân Bình",
    value: "EX shop Tân Bình (95 Thành Mỹ, Phường 8, Tân Bình, TP.HCM)",
    desc: "95 Thành Mỹ, Phường 8, Tân Bình, TP.HCM",
  }
  const [diaChiBaoHanh, setDiaChiBaoHanh] = useState(BAOHANH_DEFAULT.value)
  const [baoHanhAddresses, setBaoHanhAddresses] = useState([BAOHANH_DEFAULT, BAOHANH_EX])
  const [isAddingBaoHanhAddress, setIsAddingBaoHanhAddress] = useState(false)
  const [newBaoHanhAddress, setNewBaoHanhAddress] = useState("")

  function handleSelectCNCProduct(imei: string) {
    setSelectedCNCImeis(prev => prev.includes(imei) ? prev.filter(id => id !== imei) : [...prev, imei])
  }

  function handleSelectAllCNCProducts() {
    const allImeis = filteredCNC.map(p => p.imei)
    if (selectedCNCImeis.length === allImeis.length) {
      setSelectedCNCImeis([])
    } else {
      setSelectedCNCImeis(allImeis)
    }
  }

  function handleCompleteCNC() {
    setConfirmCNCAction(true)
  }

  function handleCancelCompleteCNC() {
    setConfirmCNCAction(false)
    setCompleteCncProofFiles([])
  }

  async function handleConfirmCompleteCNC() {
    setConfirmCNCAction(false)
    setIsLoading(true)
    try {
      const res = await fetch("/api/kho-hang/complete-cnc", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productIds: selectedCNCImeis, employeeId: "NV001" }),
      })
      const data = await res.json()
      if (data.success) {
        alert(`Đã hoàn thành CNC cho ${selectedCNCImeis.length} sản phẩm`)
        await uploadTelegramProof(completeCncProofFiles, "Hoàn thành CNC")
        fetchCNCProducts()
        setSelectedCNCImeis([])
        setIsEditCNCMode(false)
      } else {
        alert("Lỗi: " + (data.error || ""))
      }
    } catch (e) {
      const errMsg = typeof e === "object" && e && "message" in e ? (e as any).message : String(e)
      alert("Lỗi: " + errMsg)
    } finally {
      setIsLoading(false)
      setCompleteCncProofFiles([])
    }
  }

  // Dialog xác nhận thao tác
  const [confirmAction, setConfirmAction] = useState<null | "cnc" | "baohanh">(null)
  const [cncProofFiles, setCncProofFiles] = useState<File[]>([])
  const [baoHanhProofFiles, setBaoHanhProofFiles] = useState<File[]>([])
  const [completeCncProofFiles, setCompleteCncProofFiles] = useState<File[]>([])
  const [completeBaoHanhProofFiles, setCompleteBaoHanhProofFiles] = useState<File[]>([])

  function handleSendSelectedCNC() {
    setConfirmAction("cnc")
  }

  function handleSendSelectedBaoHanh() {
  setDiaChiBaoHanh("")
    setConfirmAction("baohanh")
  }

  function handleConfirmAction() {
    if (confirmAction === "cnc") {
      if (!cncAddress.trim()) {
        alert("Vui lòng nhập địa chỉ CNC!")
        return
      }
      setConfirmAction(null)
      setIsLoading(true)
      fetch("/api/kho-hang/send-cnc", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productIds: selectedProductIds, cncAddress, employeeId: "NV001" })
      })
        .then(res => res.json())
        .then(data => {
          if (data.success) {
            alert(data.message || `Đã gửi CNC cho ${selectedProductIds.length} sản phẩm!`)
            fetchProducts();
            fetchCNCProducts();
          } else {
            alert("Lỗi gửi CNC: " + (data.error || ""))
          }
        })
        .catch(e => alert("Lỗi gửi CNC: " + e.message))
        .finally(() => {
          setIsLoading(false)
          setSelectedProductIds([])
          setIsEditMode(false)
        })
    } else if (confirmAction === "baohanh") {
      setConfirmAction(null)
      setIsLoading(true)
      fetch("/api/kho-hang/return-baohanh", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productIds: selectedProductIds, employeeId: "NV001" })
      })
        .then(res => res.json())
        .then(data => {
          if (data.success) {
            alert(data.message || `Đã trả bảo hành cho ${selectedProductIds.length} sản phẩm!`)
            fetchProducts();
          } else {
            alert("Lỗi trả bảo hành: " + (data.error || ""))
          }
        })
        .catch(e => alert("Lỗi trả bảo hành: " + e.message))
        .finally(() => {
          setIsLoading(false)
          setSelectedProductIds([])
          setIsEditMode(false)
        })
    }
  }

  function handleCancelAction() {
    setConfirmAction(null)
    setCncProofFiles([])
    setBaoHanhProofFiles([])
  }
  const MAX_PRICE_LIMIT = 50000000

  async function uploadTelegramProof(files: File[], caption?: string) {
    if (!files || files.length === 0) return
    const form = new FormData()
    files.forEach((file, idx) => form.append("photo", file, file.name || `proof_${idx + 1}.jpg`))
    form.append("message_thread_id", "22")
    if (caption) form.append("caption", caption)
    try {
      await fetch("/api/telegram/send-photo", { method: "POST", body: form })
    } catch (e) {
      console.warn("[TG] upload proof fail:", e)
    }
  }

  const resetFilters = () => {
    setTrangThai("all")
    setSourceFilter("all")
    setSearchTerm("")
    setProductNameFilter("all")
    setColorFilter("all")
    setCapacityFilter("all")
    setPinFilter("all")
    setKhoFilter("all")
    setPriceRange(priceLimits)
    setConditionFilter("all")
  }
  // Chế độ chỉnh sửa bảng sản phẩm
  const [isEditMode, setIsEditMode] = useState(false)
  // Chọn nhiều sản phẩm
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([])

  function handleSelectProduct(id: string) {
    setSelectedProductIds(prev => prev.includes(id) ? prev.filter(pid => pid !== id) : [...prev, id])
  }

  function handleSelectAllProducts() {
    if (selectedProductIds.length === filteredProducts.length) {
      setSelectedProductIds([])
    } else {
      setSelectedProductIds(filteredProducts.map(p => p.id))
    }
  }

  // State
  const [activeTab, setActiveTab] = useState("san-pham")
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isAccessoryDialogOpen, setIsAccessoryDialogOpen] = useState(false)
  const [isCNCDialogOpen, setIsCNCDialogOpen] = useState(false)
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [products, setProducts] = useState<Product[]>([])
  const [baoHanhHistory, setBaoHanhHistory] = useState<any[]>([])
  const [cncProducts, setCNCProducts] = useState<CNCProduct[]>([])
  const [accessories, setAccessories] = useState<any[]>([])
  const [accessorySearch, setAccessorySearch] = useState("")
  // Role-based hiển thị giá nhập
  const [userRole, setUserRole] = useState<"quan_ly" | "nhan_vien">("nhan_vien")
  const isManager = userRole === "quan_ly"

  // Lấy headers xác thực giống header/sidebar
  function getAuthHeaders(): Record<string, string> {
    try {
      const raw = localStorage.getItem("auth_user")
      const data = raw ? JSON.parse(raw) : {}
      if (typeof data?.email === "string") {
        return { "x-user-email": data.email }
      }
      return {}
    } catch {
      return {}
    }
  }
  // Đã khai báo ở trên, không cần khai báo lại
  const [isLoadingAccessories, setIsLoadingAccessories] = useState(false)

  // CNC
  const [isLoading, setIsLoading] = useState(false)
  const [selectedCNCProductId, setSelectedCNCProductId] = useState("")
  const CNC_DEFAULT = { label: "Tâm Táo", value: "Tâm Táo (9A Đường số 6, KP5, Linh Tây, Thủ Đức)", desc: "9A Đường số 6, KP5, Linh Tây, Thủ Đức" };
  const CNC_QH_STORE = { label: "QH store", value: "QH store (53/6 Đ. Nguyễn Hồng Đào, Phường 14, Tân Bình)", desc: "53/6 Đ. Nguyễn Hồng Đào, Phường 14, Tân Bình" };
  const CNC_EX = { label: "EX shop Tân Bình", value: "EX shop Tân Bình (95 Thành Mỹ, Phường 8, Tân Bình, TP.HCM)", desc: "95 Thành Mỹ, Phường 8, Tân Bình, TP.HCM" };
  const [cncAddress, setCNCAddress] = useState(CNC_DEFAULT.value)
  const [cncAddresses, setCNCAddresses] = useState([CNC_DEFAULT, CNC_QH_STORE, CNC_EX])
  const [isAddingCNCAddress, setIsAddingCNCAddress] = useState(false)
  const [newCNCAddress, setNewCNCAddress] = useState("")
  const [isCNCLoading, setIsCNCLoading] = useState(false)
  // Dialog thêm máy CNC ngoài kho
  const [isAddCNCMachineOpen, setIsAddCNCMachineOpen] = useState(false)
  // Dialog thêm máy bảo hành ngoài kho
  const [isAddBaoHanhMachineOpen, setIsAddBaoHanhMachineOpen] = useState(false)

  // Bảo hành - Chế độ chỉnh sửa
  const [isEditBaoHanhMode, setIsEditBaoHanhMode] = useState(false)
  // Bảo hành - Chọn nhiều sản phẩm
  const [selectedBaoHanhIds, setSelectedBaoHanhIds] = useState<string[]>([])
  // Bảo hành - Dialog xác nhận hoàn thành
  const [confirmBaoHanhAction, setConfirmBaoHanhAction] = useState(false)

  function handleSelectBaoHanh(id: string) {
  setSelectedBaoHanhIds(prev => prev.includes(id) ? prev.filter(pid => pid !== id) : [...prev, id])
  }

  function handleSelectAllBaoHanh() {
    // Nếu đang ở tab Bảo hành, chọn theo danh sách đang hiển thị, lấy IMEI làm key
    const baoHanhIds = filteredBaoHanh.map((p: any) => p["IMEI"] || p.imei)
    if (selectedBaoHanhIds.length === baoHanhIds.length) {
      setSelectedBaoHanhIds([])
    } else {
      setSelectedBaoHanhIds(baoHanhIds)
    }
  }

  // Filter
  const [trangThai, setTrangThai] = useState("all")
  const [sourceFilter, setSourceFilter] = useState<"all" | "kho" | "doi_tac">("all")
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([])
  // Phân trang cho các tab
  const [page, setPage] = useState(1)
  const [pageAccessory, setPageAccessory] = useState(1)
  const [pageCNC, setPageCNC] = useState(1)
  const [pageBaoHanh, setPageBaoHanh] = useState(1)
  const pageSize = 10
  const [searchTerm, setSearchTerm] = useState("")
  const [cncSearch, setCncSearch] = useState("")
  const [baoHanhSearch, setBaoHanhSearch] = useState("")
  const [productNameFilter, setProductNameFilter] = useState("all")
  const [colorFilter, setColorFilter] = useState("all")
  const [capacityFilter, setCapacityFilter] = useState("all")
  const [pinFilter, setPinFilter] = useState<"all" | "100" | "9x" | "8x" | "7x" | "lt70">("all")
  const [khoFilter, setKhoFilter] = useState<"all" | "co_san" | "khong_san">("all")
  const [priceRange, setPriceRange] = useState<[number, number]>([0, MAX_PRICE_LIMIT])
  const [priceLimits, setPriceLimits] = useState<[number, number]>([0, MAX_PRICE_LIMIT])
  const [conditionFilter, setConditionFilter] = useState<"all" | "nguyen_ban" | "cnc">("all")
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false)
  const [isAdvancedDrawerOpen, setIsAdvancedDrawerOpen] = useState(false)

  // Base cho options tuân thủ các lọc trước đó (trạng thái, nguồn, kho, tìm kiếm, khoảng giá)
  const baseOptionProducts = useMemo(() => {
    const norm = (s: any) => String(s ?? "").normalize("NFD").replace(/[^\p{L}\p{N}\s]/gu, "").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/g, " ").trim()
    const [minP, maxP] = priceRange
    return products
      .filter(p => p.trang_thai === "Còn hàng")
      .filter(p => {
        if (trangThai === "Lock" || trangThai === "Qte") {
          const loaiMayRaw = (p as any).loai_may || (p as any)["Loại Máy"] || ""
          const v = norm(loaiMayRaw)
          if (!v) return false
          if (trangThai === "Lock") return v.includes("lock")
          return v.includes("qte") || v.includes("qt") || v.includes("quoc te") || v.includes("quocte") || v.includes("quoc-te")
        }
        return true
      })
      .filter(p => {
        if (sourceFilter === "kho") return p.nguon !== "Đối tác"
        if (sourceFilter === "doi_tac") return p.nguon === "Đối tác"
        return true
      })
      .filter(p => {
        if (khoFilter === "co_san") return (p.trang_thai_kho || "").toLowerCase().includes("có sẵn") || (p.trang_thai_kho || "").toLowerCase().includes("co san")
        if (khoFilter === "khong_san") return (p.trang_thai_kho || "").toLowerCase().includes("không sẵn") || (p.trang_thai_kho || "").toLowerCase().includes("khong san")
        return true
      })
      .filter(p => {
        const price = p.gia_ban || 0
        if (minP > 0 && price < minP) return false
        if (maxP > 0 && price > maxP) return false
        return true
      })
      .filter(p => {
        if (!searchTerm.trim()) return true
        const q = norm(searchTerm)
        const joined = [p.ten_san_pham, p.imei, p.mau_sac, p.dung_luong, p.tinh_trang, p.ghi_chu].map(norm).join("|")
        return joined.includes(q)
      })
      .filter(p => {
        if (conditionFilter === "all") return true
        return classifyCondition(p) === conditionFilter
      })
  }, [products, trangThai, sourceFilter, khoFilter, searchTerm, priceRange, conditionFilter])

  // Options cho dropdown (cascading)
  const productNameOptions = useMemo(() => {
    const names = Array.from(new Set(baseOptionProducts.map(p => p.ten_san_pham).filter(Boolean))) as string[]
    return ["all", ...names.sort((a, b) => a.localeCompare(b, "vi", { sensitivity: "base" }))]
  }, [baseOptionProducts])

  const colorOptions = useMemo(() => {
    let data = baseOptionProducts
    if (productNameFilter !== "all") {
      const target = productNameFilter
      data = data.filter(p => p.ten_san_pham === target)
    }
    const colors = Array.from(new Set(data.map(p => p.mau_sac).filter(Boolean))) as string[]
    return ["all", ...colors.sort((a, b) => a.localeCompare(b, "vi", { sensitivity: "base" }))]
  }, [baseOptionProducts, productNameFilter])

  const capacityOptions = useMemo(() => {
    let data = baseOptionProducts
    if (productNameFilter !== "all") {
      data = data.filter(p => p.ten_san_pham === productNameFilter)
    }
    if (colorFilter !== "all") {
      data = data.filter(p => p.mau_sac === colorFilter)
    }
    const caps = Array.from(new Set(data.map(p => p.dung_luong).filter(Boolean))) as string[]
    return ["all", ...caps.sort((a, b) => a.localeCompare(b, "vi", { sensitivity: "base" }))]
  }, [baseOptionProducts, productNameFilter, colorFilter])

  // Reset các chọn phụ thuộc khi không còn hợp lệ
  useEffect(() => {
    if (!colorOptions.includes(colorFilter)) {
      setColorFilter("all")
    }
  }, [colorOptions, colorFilter])

  useEffect(() => {
    if (!capacityOptions.includes(capacityFilter)) {
      setCapacityFilter("all")
    }
  }, [capacityOptions, capacityFilter])

  // Update slider bounds once products loaded
  useEffect(() => {
    const ceil = MAX_PRICE_LIMIT
    setPriceLimits([0, ceil])
    setPriceRange([0, ceil])
  }, [products])

  const advancedFilters = (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-7 gap-2">
      <Select value={productNameFilter} onValueChange={(v) => setProductNameFilter(v)}>
        <SelectTrigger className="w-full h-10 bg-white text-sm min-w-[150px]"><SelectValue placeholder="Tên sản phẩm" /></SelectTrigger>
        <SelectContent className="bg-white max-h-[320px]">
          {productNameOptions.map(opt => (
            <SelectItem key={opt} value={opt}>{opt === "all" ? "Tên: Tất cả" : opt}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select value={sourceFilter} onValueChange={v => setSourceFilter(v as any)}>
        <SelectTrigger className="w-full h-10 bg-white text-sm min-w-[140px]"><SelectValue placeholder="Nguồn" /></SelectTrigger>
        <SelectContent className="bg-white">
          <SelectItem value="all">Nguồn: Tất cả</SelectItem>
          <SelectItem value="kho">Trong kho</SelectItem>
          <SelectItem value="doi_tac">Đối tác</SelectItem>
        </SelectContent>
      </Select>
      <Select value={trangThai} onValueChange={setTrangThai}>
        <SelectTrigger className="w-full h-10 bg-white text-sm min-w-[130px]"><SelectValue placeholder="Loại máy" /></SelectTrigger>
        <SelectContent className="bg-white">
          <SelectItem value="all">Loại: Tất cả</SelectItem>
          <SelectItem value="Lock">Lock</SelectItem>
          <SelectItem value="Qte">Quốc tế</SelectItem>
        </SelectContent>
      </Select>
      <Select value={colorFilter} onValueChange={(v) => setColorFilter(v)}>
        <SelectTrigger className="w-full h-10 bg-white text-sm min-w-[120px]"><SelectValue placeholder="Màu" /></SelectTrigger>
        <SelectContent className="bg-white max-h-[260px]">
          {colorOptions.map(opt => (
            <SelectItem key={opt} value={opt}>{opt === "all" ? "Màu: Tất cả" : opt}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select value={capacityFilter} onValueChange={(v) => setCapacityFilter(v)}>
        <SelectTrigger className="w-full h-10 bg-white text-sm min-w-[140px]"><SelectValue placeholder="Dung lượng" /></SelectTrigger>
        <SelectContent className="bg-white max-h-[260px]">
          {capacityOptions.map(opt => (
            <SelectItem key={opt} value={opt}>{opt === "all" ? "Dung lượng: Tất cả" : opt}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select value={pinFilter} onValueChange={(v) => setPinFilter(v as any)}>
        <SelectTrigger className="w-full h-10 bg-white text-sm min-w-[120px]"><SelectValue placeholder="Pin" /></SelectTrigger>
        <SelectContent className="bg-white">
          <SelectItem value="all">Pin: Tất cả</SelectItem>
          <SelectItem value="100">100%</SelectItem>
          <SelectItem value="9x">9x%</SelectItem>
          <SelectItem value="8x">8x%</SelectItem>
          <SelectItem value="7x">7x%</SelectItem>
          <SelectItem value="lt70">&lt; 70%</SelectItem>
        </SelectContent>
      </Select>
      <Select value={conditionFilter} onValueChange={(v) => setConditionFilter(v as any)}>
        <SelectTrigger className="w-full h-10 bg-white text-sm min-w-[170px]"><SelectValue placeholder="Nguyên bản/CNC" /></SelectTrigger>
        <SelectContent className="bg-white">
          <SelectItem value="all">Nguyên bản/CNC: Tất cả</SelectItem>
          <SelectItem value="nguyen_ban">Nguyên bản</SelectItem>
          <SelectItem value="cnc">CNC</SelectItem>
        </SelectContent>
      </Select>
      <div className="col-span-2 sm:col-span-3 md:col-span-4 lg:col-span-6 xl:col-span-7 flex flex-col gap-2">
        <div className="flex items-center justify-between text-xs text-slate-600">
          <span className="font-medium text-slate-700">Khoảng giá</span>
          <span className="text-[11px] text-slate-500">{priceRange[0].toLocaleString("vi-VN")} - {priceRange[1].toLocaleString("vi-VN")} VNĐ</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[11px] text-slate-500 w-10 text-left">0</span>
          <Slider
            value={priceRange}
            min={priceLimits[0]}
            max={priceLimits[1]}
            step={500000}
            onValueChange={(val) => {
              const [minV, maxV] = val as number[]
              setPriceRange([minV, maxV])
            }}
            className="py-1 flex-1"
          />
          <span className="text-[11px] text-slate-500 w-16 text-right">{priceLimits[1].toLocaleString("vi-VN")}</span>
        </div>
      </div>
    </div>
  )

  // Bảo hành - Xác nhận hoàn thành bảo hành
  async function handleConfirmCompleteBaoHanh() {
    setConfirmBaoHanhAction(false)
    setIsLoading(true)
    try {
      const res = await fetch("/api/kho-hang/complete-baohanh", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: selectedBaoHanhIds, employeeId: "NV001" })
      })
      const data = await res.json()
      if (data.success) {
        alert("Đã hoàn thành bảo hành cho " + selectedBaoHanhIds.length + " sản phẩm")
        await uploadTelegramProof(completeBaoHanhProofFiles, "Hoàn thành bảo hành")
        fetchProducts()
        fetchBaoHanhHistory()
      } else {
        alert("Lỗi: " + data.error)
      }
    } catch (e) {
      const errMsg = typeof e === 'object' && e && 'message' in e ? (e as any).message : String(e);
      alert("Lỗi: " + errMsg)
    } finally {
      setIsLoading(false)
      setSelectedBaoHanhIds([])
      setIsEditBaoHanhMode(false)
      setCompleteBaoHanhProofFiles([])
    }
  }

  // Fetch products & accessories
  async function fetchProducts() {
    try {
      const [resKho, resPartner] = await Promise.all([
        fetch("/api/kho-hang", { cache: "no-store" }),
        fetch("/api/doi-tac/hang-order", { cache: "no-store" }),
      ])
      const kho = await resKho.json()
      let base: Product[] = kho.data || []
      let partner: Product[] = []
      if (resPartner.ok) {
        const pj = await resPartner.json()
        const items = Array.isArray(pj.items) ? pj.items : []
        partner = items.map((it: any): Product => ({
          id: `DT-${it.row_index}-${it.imei || it.model || Math.random().toString(36).slice(2,8)}`,
          ten_san_pham: it.model || "Máy đối tác",
          loai_phu_kien: "",
          dung_luong: it.bo_nho || "",
          mau_sac: it.mau || "",
          pin: it.pin_pct ? `${it.pin_pct}` : "",
          imei: it.imei || "",
          tinh_trang: it.tinh_trang || "",
          gia_nhap: typeof it.gia_chuyen === "number" ? it.gia_chuyen : Number(String(it.gia_chuyen||"").replace(/[^0-9.-]/g,"")) || 0,
          gia_ban: typeof it.gia_goi_y_ban === "number" ? it.gia_goi_y_ban : Number(String(it.gia_goi_y_ban||"").replace(/[^0-9.-]/g,"")) || 0,
          trang_thai: "Còn hàng", // Hiển thị trong kho như hàng sẵn có, nhưng sẽ có badge Đối tác
            trang_thai_kho: "Có sẵn",
          ngay_nhap: it.ngay_nhap || "",
          ghi_chu: it.ghi_chu || "",
          loai_may: it.loai_may || "",
          nguon: "Đối tác",
          ten_doi_tac: it.ten_doi_tac || "",
          sdt_doi_tac: it.sdt_doi_tac || "",
          partner_sheet: it.sheet,
          partner_row_index: it.row_index,
        }))
      }
      setProducts([...(base || []), ...partner])
    } catch (e) {
      console.error("Error fetching products:", e)
    } finally {
      setIsLoading(false)
    }
  }

  async function fetchCNCProducts() {
    setIsCNCLoading(true)
    try {
      const res = await fetch("/api/kho-hang/cnc", { cache: "no-store" })
      const json = await res.json()
      setCNCProducts(json.data || [])
    } catch (e) {
      console.error("Error fetching CNC products:", e)
    } finally {
      setIsCNCLoading(false)
    }
  }

  async function fetchAccessories() {
    setIsLoadingAccessories(true)
    try {
      const res = await fetch("/api/phu-kien", { cache: "no-store" })
      const json = await res.json()
      setAccessories(json.data || [])
    } catch (e) {
      console.error("Error fetching accessories:", e)
    } finally {
      setIsLoadingAccessories(false)
    }
  }

  useEffect(() => {
    fetchProducts()
    fetchAccessories()
    fetchCNCProducts()
    fetchBaoHanhHistory()
    // Lấy role người dùng để ẩn/hiện cột Giá nhập
    ;(async () => {
      try {
        const res = await fetch("/api/auth/me", { cache: "no-store", headers: getAuthHeaders() })
        if (res.ok) {
          const me = await res.json()
          if (me?.role === "quan_ly") setUserRole("quan_ly")
        } else {
          // 401: giữ mặc định nhan_vien
        }
      } catch {
        // ignore
      }
    })()
  }, [])

  async function fetchBaoHanhHistory() {
    try {
      const res = await fetch("/api/kho-hang/baohanh-history", { cache: "no-store" })
      const json = await res.json()
      setBaoHanhHistory(json.data || [])
    } catch (e) {
      console.error("Error fetching Bao_Hanh history:", e)
    }
  }

  // Filter products
  // Tab Sản phẩm chỉ hiển thị sản phẩm còn hàng
  useEffect(() => {
    // Helper: chuẩn hóa chuỗi (bỏ dấu, viết thường, bỏ khoảng trắng thừa)
    const norm = (s: string | undefined) =>
      (s || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/\s+/g, " ")
        .trim()

    let filtered = products.filter(p => p.trang_thai === "Còn hàng")

    // Loại máy: Lock / Quốc tế (dựa trên loai_may hoặc 'Loại Máy', không dùng loai_phu_kien)
    if (trangThai === "Lock" || trangThai === "Qte") {
      filtered = filtered.filter(p => {
        const loaiMayRaw = (p as any).loai_may || (p as any)["Loại Máy"] || ""
        const v = norm(loaiMayRaw)
        if (!v) return false
        if (trangThai === "Lock") return v.includes("lock")
        // Quốc tế: nhiều cách ghi: "qte", "qt", "quoc te", "quốc tế"
        return v.includes("qte") || v.includes("qt") || v.includes("quoc te") || v.includes("quocte") || v.includes("quoc-te")
      })
    }

    // Nguồn hàng: Kho / Đối tác
    if (sourceFilter === "kho") {
      filtered = filtered.filter(p => p.nguon !== "Đối tác")
    } else if (sourceFilter === "doi_tac") {
      filtered = filtered.filter(p => p.nguon === "Đối tác")
    }

    // Search text (tên/IMEI/màu/dung lượng/ghi chú)
    if (searchTerm.trim()) {
      const q = norm(searchTerm)
      filtered = filtered.filter(p => {
        const joined = [
          p.ten_san_pham,
          p.imei,
          p.mau_sac,
          p.dung_luong,
          p.tinh_trang,
          p.ghi_chu,
        ].map(norm).join("|")
        return joined.includes(q)
      })
    }

    // Tên sản phẩm cụ thể
    if (productNameFilter !== "all") {
      const target = norm(productNameFilter)
      filtered = filtered.filter(p => norm(p.ten_san_pham) === target)
    }

    // Màu
    if (colorFilter !== "all") {
      const target = norm(colorFilter)
      filtered = filtered.filter(p => norm(p.mau_sac) === target)
    }

    // Dung lượng
    if (capacityFilter !== "all") {
      const target = norm(capacityFilter)
      filtered = filtered.filter(p => norm(p.dung_luong) === target)
    }

    // Pin buckets
    if (pinFilter !== "all") {
      filtered = filtered.filter(p => {
        const val = Number(String(p.pin || "").replace(/[^0-9.]/g, ""))
        if (Number.isNaN(val)) return false
        if (pinFilter === "100") return val >= 100
        if (pinFilter === "9x") return val >= 90 && val < 100
        if (pinFilter === "8x") return val >= 80 && val < 90
        if (pinFilter === "7x") return val >= 70 && val < 80
        return val < 70
      })
    }

    // Kho (có sẵn / không sẵn)
    if (khoFilter !== "all") {
      filtered = filtered.filter(p => {
        const val = (p.trang_thai_kho || "").toLowerCase()
        if (khoFilter === "co_san") return val.includes("có sẵn") || val.includes("co san")
        return val.includes("không sẵn") || val.includes("khong san")
      })
    }

    // Khoảng giá bán
    const [minP, maxP] = priceRange
    if (minP > 0) {
      filtered = filtered.filter(p => (p.gia_ban || 0) >= minP)
    }
    if (maxP > 0) {
      filtered = filtered.filter(p => (p.gia_ban || 0) <= maxP)
    }

    // Nguyên bản / CNC
    if (conditionFilter !== "all") {
      filtered = filtered.filter(p => classifyCondition(p) === conditionFilter)
    }

  setFilteredProducts(filtered)
  setPage(1) // Reset về trang đầu khi thay đổi filter/search
  }, [products, trangThai, sourceFilter, searchTerm, productNameFilter, colorFilter, capacityFilter, pinFilter, khoFilter, priceRange, conditionFilter])

  // Stats
  const tongSanPham = products.length
  const tongPhuKien = accessories.length
  const tongGiaTriNhap = products.reduce((acc, p) => acc + (p.gia_nhap || 0), 0)
  const tongGiaTriBan = products.reduce((acc, p) => acc + (p.gia_ban || 0), 0)

  // Helpers
  function getTrangThaiColor(status: string) {
    switch (status) {
      case "Còn hàng": return "bg-green-100 text-green-700"
      case "Đang CNC": return "bg-yellow-100 text-yellow-700"
      case "Bảo hành": return "bg-red-100 text-red-700"
      default: return "bg-gray-100 text-gray-700"
    }
  }
  function classifyCondition(p: Product) {
    const text = `${p.tinh_trang || ""} ${p.ghi_chu || ""} ${p.loai_may || ""}`
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
    if (text.includes("cnc")) return "cnc"
    if (text.includes("nguyen") && text.includes("ban")) return "nguyen_ban"
    return "unknown"
  }
  function getTrangThaiText(status: string) {
    return status || "-"
  }
  function getTrangThaiKhoColor(status?: string) {
    const val = (status || "").toLowerCase()
    if (val.includes("không sẵn")) return "bg-amber-100 text-amber-700"
    return "bg-emerald-100 text-emerald-700"
  }
  function handleSuccess() {
    // refetch products nếu cần
  }
  function handleSendCNC() {
    console.log("Send CNC:", selectedCNCProductId, cncAddress)
    setIsCNCDialogOpen(false)
  }

  // TODO: wire to backend when ready
  function handleCustomerReceived(imei: string) {
    console.log("Mark customer received for IMEI", imei)
    alert(`Đánh dấu khách đã nhận cho IMEI ${imei} chưa được triển khai.`)
  }

  // Tính toán số lượng từng trạng thái sản phẩm
  // Sản phẩm còn hàng: chỉ lấy từ sheet Kho_Hang
  const soSanPhamCon = products.filter(p => p.trang_thai === "Còn hàng").length
  // Sản phẩm CNC: lấy từ sheet CNC, gồm trạng thái "Đang CNC" và "Hoàn thành CNC" (chỉ khách ngoài)
  const soSanPhamCNC = cncProducts.filter(p => p.trang_thai === "Đang CNC" || (p.trang_thai === "Hoàn thành CNC" && p.nguon === "Khách ngoài")).length
  // Sản phẩm bảo hành: lấy từ sheet Bao_Hanh, gồm trạng thái "Bảo hành" và "Hoàn thành bảo hành" (chỉ khách ngoài)
  const soSanPhamBH = baoHanhHistory.filter(p => p["Trạng Thái"] === "Bảo hành" || (p["Trạng Thái"] === "Hoàn thành bảo hành" && p["Nguồn"] === "Khách ngoài")).length
  // Phụ kiện đã hết: số lượng tồn = 0
  const soPhuKienDaHet = accessories.filter(a => Number(a.so_luong_ton) === 0).length
  // Phụ kiện sắp hết: 1 <= số lượng tồn <= 5
  const soPhuKienSapHet = accessories.filter(a => Number(a.so_luong_ton) >= 1 && Number(a.so_luong_ton) <= 5).length

  // Danh sách hiển thị cho CNC và Bảo hành (áp điều kiện lọc như đếm số lượng)
  const filteredCNC = useMemo(() => {
    const norm = (s: any) => String(s ?? "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    let base = cncProducts.filter(p => (p.trang_thai === "Đang CNC") || (p.trang_thai === "Hoàn thành CNC" && p.nguon === "Khách ngoài"))
    if (cncSearch.trim()) {
      const q = norm(cncSearch)
      base = base.filter(p => [p.ten_san_pham, p.imei, p.nguon, p.tinh_trang, p.loai_may].map(norm).join("|").includes(q))
    }
    return base
  }, [cncProducts, cncSearch])
  const filteredBaoHanh = useMemo(() => {
    const norm = (s: any) => String(s ?? "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    let base = baoHanhHistory.filter((p: any) => p["Trạng Thái"] === "Bảo hành" || (p["Trạng Thái"] === "Hoàn thành bảo hành" && p["Nguồn"] === "Khách ngoài"))
    if (baoHanhSearch.trim()) {
      const q = norm(baoHanhSearch)
      base = base.filter((p: any) => [p["Tên Sản Phẩm"], p["IMEI"], p["Nguồn"], p["Trạng Thái"], p["Loại Máy"], p["Lỗi"]].map(norm).join("|").includes(q))
    }
    return base
  }, [baoHanhHistory, baoHanhSearch])

  // Danh sách hiển thị cho Phụ kiện (áp dụng tìm kiếm)
  const filteredAccessories = useMemo(() => {
    const norm = (s: any) => String(s ?? "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    if (!accessorySearch.trim()) return accessories
    const q = norm(accessorySearch)
    return accessories.filter((a: any) => [a.ten_phu_kien, a.loai_phu_kien, a.ghi_chu, a.nhan_hieu]
      .map(norm)
      .join("|")
      .includes(q))
  }, [accessories, accessorySearch])

  // Phân trang cho các tab (10 mục/trang)
  const productTotalPages = Math.max(1, Math.ceil(filteredProducts.length / pageSize))
  const currentProductPage = Math.min(page, productTotalPages)
  const paginatedProducts = filteredProducts.slice((currentProductPage - 1) * pageSize, currentProductPage * pageSize)

  const accessoryTotalPages = Math.max(1, Math.ceil(filteredAccessories.length / pageSize))
  const currentAccessoryPage = Math.min(pageAccessory, accessoryTotalPages)
  const paginatedAccessories = filteredAccessories.slice((currentAccessoryPage - 1) * pageSize, currentAccessoryPage * pageSize)

  const cncTotalPages = Math.max(1, Math.ceil(filteredCNC.length / pageSize))
  const currentCNCPage = Math.min(pageCNC, cncTotalPages)
  const paginatedCNC = filteredCNC.slice((currentCNCPage - 1) * pageSize, currentCNCPage * pageSize)

  const baoHanhTotalPages = Math.max(1, Math.ceil(filteredBaoHanh.length / pageSize))
  const currentBaoHanhPage = Math.min(pageBaoHanh, baoHanhTotalPages)
  const paginatedBaoHanh = filteredBaoHanh.slice((currentBaoHanhPage - 1) * pageSize, currentBaoHanhPage * pageSize)

  const renderPagination = (current: number, total: number, onChange: (p: number) => void) => {
    if (total <= 1) return null
    const items: JSX.Element[] = []
    const maxPages = 7
    if (total <= maxPages) {
      for (let i = 1; i <= total; i++) {
        items.push(
          <button
            key={i}
            className={`px-3 py-1 rounded ${current === i ? "bg-blue-600 text-white font-bold" : "bg-white text-blue-700 border"}`}
            onClick={() => onChange(i)}
          >{i}</button>
        )
      }
    } else {
      items.push(
        <button
          key={1}
          className={`px-3 py-1 rounded ${current === 1 ? "bg-blue-600 text-white font-bold" : "bg-white text-blue-700 border"}`}
          onClick={() => onChange(1)}
        >1</button>
      )
      if (current > 4) {
        items.push(<span key="left-ellipsis" className="px-2">...</span>)
      }
      for (let i = Math.max(2, current - 2); i <= Math.min(total - 1, current + 2); i++) {
        items.push(
          <button
            key={i}
            className={`px-3 py-1 rounded ${current === i ? "bg-blue-600 text-white font-bold" : "bg-white text-blue-700 border"}`}
            onClick={() => onChange(i)}
          >{i}</button>
        )
      }
      if (current < total - 3) {
        items.push(<span key="right-ellipsis" className="px-2">...</span>)
      }
      items.push(
        <button
          key={total}
          className={`px-3 py-1 rounded ${current === total ? "bg-blue-600 text-white font-bold" : "bg-white text-blue-700 border"}`}
          onClick={() => onChange(total)}
        >{total}</button>
      )
    }

    return (
      <div className="flex justify-center mt-6">
        <nav className="flex gap-1">{items}</nav>
      </div>
    )
  }

  return (
    <div className="space-y-8 px-4 pb-8">
      {/* Stats bar gộp lại */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        {/* Card Sản phẩm */}
        <Card className="rounded-xl shadow bg-gradient-to-br from-green-50 to-blue-50 p-4 md:p-6">
          <div className="flex items-start gap-3">
            <span className="text-green-600 text-3xl">📲</span>
            <div className="flex-1">
              <div className="text-lg font-bold text-green-700">Sản phẩm</div>
              <div className="mt-2 grid grid-cols-3 gap-2 md:gap-4 text-sm">
                <button
                  className="flex items-center justify-center gap-1 rounded-lg border bg-white/70 px-2 py-1 md:px-3 md:py-2 text-green-700 hover:bg-white transition"
                  onClick={() => setActiveTab('san-pham')}
                  aria-label="Xem sản phẩm còn hàng"
                >
                  <span className="text-base">🟢</span>
                  <span className="hidden sm:inline">Còn hàng:</span>
                  <span className="font-bold">{soSanPhamCon}</span>
                </button>
                <button
                  className="flex items-center justify-center gap-1 rounded-lg border bg-white/70 px-2 py-1 md:px-3 md:py-2 text-orange-700 hover:bg-white transition"
                  onClick={() => setActiveTab('dang-cnc')}
                  aria-label="Xem sản phẩm CNC"
                >
                  <span className="text-base">🟠</span>
                  <span className="hidden sm:inline">CNC:</span>
                  <span className="font-bold">{soSanPhamCNC}</span>
                </button>
                <button
                  className="flex items-center justify-center gap-1 rounded-lg border bg-white/70 px-2 py-1 md:px-3 md:py-2 text-blue-700 hover:bg-white transition"
                  onClick={() => setActiveTab('bao-hanh')}
                  aria-label="Xem sản phẩm bảo hành"
                >
                  <span className="text-base">🔵</span>
                  <span className="hidden sm:inline">Bảo hành:</span>
                  <span className="font-bold">{soSanPhamBH}</span>
                </button>
              </div>
            </div>
          </div>
        </Card>
        {/* Card Phụ kiện */}
        <Card className="rounded-xl shadow bg-gradient-to-br from-slate-50 to-red-50 p-6 flex flex-row items-center gap-4">
          <span className="text-red-500 text-3xl mr-2">📦</span>
          <div>
            <div className="text-lg font-bold text-slate-700 mb-1">Phụ kiện</div>
            <div className="flex gap-6 text-sm mt-2">
              <span className="flex items-center gap-1 text-red-700"><span className="text-base">❌</span> Đã hết: <span className="font-bold">{soPhuKienDaHet}</span></span>
              <span className="flex items-center gap-1 text-orange-700"><span className="text-base">⚠️</span> Sắp hết: <span className="font-bold">{soPhuKienSapHet}</span></span>
            </div>
          </div>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full mt-2">
        <TabsList className="grid w-full grid-cols-4 max-w-2xl bg-white rounded-xl shadow border mb-4">
          <TabsTrigger value="san-pham" className="py-2 rounded-xl data-[state=active]:bg-blue-50 data-[state=active]:text-blue-700 data-[state=active]:font-bold transition-colors">Sản phẩm</TabsTrigger>
          <TabsTrigger value="phu-kien" className="py-2 rounded-xl data-[state=active]:bg-blue-50 data-[state=active]:text-blue-700 data-[state=active]:font-bold transition-colors">Phụ kiện</TabsTrigger>
          <TabsTrigger value="dang-cnc" className="py-2 rounded-xl data-[state=active]:bg-blue-50 data-[state=active]:text-blue-700 data-[state=active]:font-bold transition-colors">CNC</TabsTrigger>
          <TabsTrigger value="bao-hanh" className="py-2 rounded-xl data-[state=active]:bg-blue-50 data-[state=active]:text-blue-700 data-[state=active]:font-bold transition-colors">Bảo hành</TabsTrigger>
        </TabsList>

        {/* TAB SẢN PHẨM */}
        <TabsContent value="san-pham" className="space-y-6">
          <Card className="shadow-lg border-0">
            <CardContent className="p-6">
              <div className="flex justify-between items-center gap-3 flex-wrap">
                <div className="flex items-center gap-2">
                  <Button onClick={() => { setSelectedProduct(null); setIsDialogOpen(true) }} className="bg-blue-600 text-white font-semibold rounded-lg shadow hover:bg-blue-700">
                    <Plus className="w-4 h-4 mr-1" /> Nhập hàng
                  </Button>
                  <button
                    className="p-2 rounded-full hover:bg-blue-100 transition-all"
                    title="Chỉnh sửa danh sách"
                    onClick={() => setIsEditMode((v) => !v)}
                  >
                    <Edit2 className="w-5 h-5 text-blue-600" />
                  </button>
                </div>
              </div>

              {/* Bộ lọc 2 tầng */}
              <div
                className={`mt-4 border border-slate-200 rounded-xl bg-slate-50/60 p-3 shadow-sm space-y-3 w-full ${isMobile ? "max-w-xl mx-auto" : ""}`}
              >
                {/* Tầng 1: thao tác nhanh */}
                <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-2">
                  <Input
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Tìm tên / IMEI / màu..."
                    className="h-10 text-sm bg-white w-full sm:min-w-[220px] sm:flex-1"
                  />
                  <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                    <Select value={khoFilter} onValueChange={(v) => setKhoFilter(v as any)}>
                      <SelectTrigger className="w-full sm:w-[150px] h-10 bg-white text-sm"><SelectValue placeholder="Kho" /></SelectTrigger>
                      <SelectContent className="bg-white">
                        <SelectItem value="all">Kho: Tất cả</SelectItem>
                        <SelectItem value="co_san">Có sẵn</SelectItem>
                        <SelectItem value="khong_san">Không sẵn</SelectItem>
                      </SelectContent>
                    </Select>
                    <div className="flex gap-2 w-full sm:w-auto">
                      <Button variant="outline" size="sm" className="h-10 flex-1 sm:flex-none" onClick={resetFilters}>Xóa lọc</Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-10 flex-1 sm:flex-none"
                        onClick={() => {
                          if (isMobile) {
                            setIsAdvancedDrawerOpen(true)
                            return
                          }
                          setShowAdvancedFilters(v => !v)
                        }}
                      >
                        {isMobile ? "Lọc chi tiết" : (showAdvancedFilters ? "Ẩn lọc chi tiết" : "Lọc chi tiết")}
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Tầng 2: lọc chi tiết */}
                {!isMobile && showAdvancedFilters && advancedFilters}
              </div>

              {isMobile && (
                <Drawer open={isAdvancedDrawerOpen} onOpenChange={setIsAdvancedDrawerOpen} dismissible={false}>
                  <DrawerContent centered className="max-h-[85vh]">
                    <DrawerHeader>
                      <DrawerTitle className="text-base">Lọc chi tiết</DrawerTitle>
                    </DrawerHeader>
                    <div className="p-4 pt-0 space-y-3 overflow-y-auto">
                      {advancedFilters}
                    </div>
                    <DrawerFooter className="pt-2">
                      <Button variant="outline" onClick={resetFilters}>Xóa lọc</Button>
                      <DrawerClose asChild>
                        <Button
                          type="button"
                          className="bg-blue-600 text-white hover:bg-blue-700"
                          onClick={() => setIsAdvancedDrawerOpen(false)}
                        >
                          Đóng
                        </Button>
                      </DrawerClose>
                    </DrawerFooter>
                  </DrawerContent>
                </Drawer>
              )}

              {/* Hiển thị thao tác khi có sản phẩm được chọn và đang ở chế độ chỉnh sửa */}
              {isEditMode && selectedProductIds.length > 0 && (
                <div className="flex gap-4 my-4">
                  <Button onClick={handleSendSelectedCNC} className="bg-yellow-500 text-white font-semibold rounded-lg shadow hover:bg-yellow-600">Gửi CNC</Button>
                  <Button onClick={handleSendSelectedBaoHanh} className="bg-blue-600 text-white font-semibold rounded-lg shadow hover:bg-blue-700">Bảo Hành</Button>
                  <span className="text-sm text-slate-500">Đã chọn: {selectedProductIds.length}</span>
                </div>
              )}

              {/* Dialog xác nhận thao tác CNC/Bảo hành */}
              {confirmAction && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-30">
                  <div className="bg-white rounded-2xl shadow-2xl p-8 min-w-[400px] max-w-[95vw] border border-slate-200">
                    {confirmAction === "cnc" ? (
                      <>
                        <h2 className="text-xl font-bold mb-4 text-blue-700 flex items-center gap-2">
                          <span style={{letterSpacing:1}}>🛠️</span> Xác nhận gửi CNC
                        </h2>
                        <div className="mb-6">
                          <div className="text-base font-medium mb-2 text-slate-700">Bạn có chắc chắn muốn gửi CNC cho các sản phẩm sau?</div>
                          <div className="space-y-4" style={{maxHeight: '320px', overflowY: 'auto'}}>
                            {filteredProducts.filter(p => selectedProductIds.includes(p.id)).map((p) => (
                              <div key={p.id} className="bg-slate-50 rounded-xl p-4 shadow flex flex-col gap-2 border border-slate-100">
                                <div className="font-semibold text-blue-700 mb-1 flex items-center gap-2">
                                  <span>{p.ten_san_pham}</span>
                                  <span className="text-slate-900 font-semibold">{p.mau_sac}{p.mau_sac && p.dung_luong ? ' - ' : ''}{p.dung_luong}</span>
                                  <span className="text-xs text-slate-500">IMEI: {p.imei}</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                        <div className="mb-4">
                          <label className="block text-base font-medium mb-2 text-blue-700">Chọn địa chỉ CNC</label>
                          <div className="w-full">
                            <Select value={cncAddress} onValueChange={val => {
                              if (val === "__add__") {
                                setIsAddingCNCAddress(true)
                              } else {
                                setCNCAddress(val)
                              }
                            }}>
                              <SelectTrigger className="w-full bg-white rounded-lg shadow border focus:ring-2 focus:ring-blue-200">
                                <SelectValue placeholder="Chọn địa chỉ CNC" />
                              </SelectTrigger>
                              <SelectContent className="bg-white rounded-lg shadow-lg">
                                <SelectItem value={CNC_DEFAULT.value} className="font-bold">
                                  <div style={{fontWeight:700}}>{CNC_DEFAULT.label}</div>
                                  <div style={{fontSize:12, color:'#64748b'}}>{CNC_DEFAULT.desc}</div>
                                </SelectItem>
                                {cncAddresses.filter(a => a.value !== CNC_DEFAULT.value).map((a, idx) => (
                                  <SelectItem key={a.value} value={a.value}>
                                    <div style={{fontWeight:500}}>{a.label}</div>
                                    <div style={{fontSize:12, color:'#64748b'}}>{a.value}</div>
                                  </SelectItem>
                                ))}
                                <SelectItem value="__add__" className="text-blue-600">+ Thêm địa chỉ mới...</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          {isAddingCNCAddress && (
                            <div className="mt-3">
                              <input type="text" className="border rounded-lg px-3 py-2 w-full focus:ring-2 focus:ring-blue-200 text-base" placeholder="Nhập địa chỉ CNC mới..." value={newCNCAddress} onChange={e => setNewCNCAddress(e.target.value)} />
                              <div className="flex gap-2 mt-2">
                                <Button size="sm" onClick={() => {
                                  if (newCNCAddress.trim()) {
                                    setCNCAddresses(prev => [...prev, { label: newCNCAddress, value: newCNCAddress, desc: "" }])
                                    setCNCAddress(newCNCAddress)
                                    setNewCNCAddress("")
                                    setIsAddingCNCAddress(false)
                                  }
                                }} className="bg-blue-600 text-white">Lưu</Button>
                                <Button size="sm" variant="outline" onClick={() => {
                                  setIsAddingCNCAddress(false)
                                  setNewCNCAddress("")
                                }}>Hủy</Button>
                              </div>
                            </div>
                          )}
                          <div className="mt-4">
                            <Label className="text-sm text-slate-700">Ảnh xác nhận (tùy chọn)</Label>
                            <Input type="file" multiple accept="image/*" onChange={e => setCncProofFiles(Array.from(e.target.files || []))} className="mt-1" />
                            {cncProofFiles.length > 0 && (
                              <p className="text-xs text-slate-500 mt-1">{cncProofFiles.length} ảnh đã chọn</p>
                            )}
                          </div>
                        </div>
                        <div className="flex gap-4 justify-end mt-8">
                          <Button variant="outline" onClick={handleCancelAction} className="rounded-lg px-6 py-2 border border-slate-300">Hủy</Button>
                          <Button onClick={async () => {
                            setIsLoading(true)
                            try {
                              const selected = products.filter(p => selectedProductIds.includes(p.id))
                              const productPayload = selected.map(p => ({
                                id: p.id,
                                ten_san_pham: p.ten_san_pham,
                                loai_may: p.loai_may,
                                imei: p.imei,
                                nguon: p.nguon ? p.nguon : (p.id.startsWith("BH-") ? "Khách ngoài" : "Kho shop"),
                                tinh_trang: p.tinh_trang,
                                loi: p.loi || "",
                                dia_chi_bao_hanh: diaChiBaoHanh || "",
                                ten_khach_hang: p.ten_khach_hang || "",
                                so_dien_thoai: p.so_dien_thoai || "",
                                trang_thai_cu: "Còn hàng" // Thêm trường này
                              }))
                              const productIds = selected.map(p => p.imei || p.id)
                              const addressToSend = cncAddress && cncAddress.trim() ? cncAddress : CNC_DEFAULT.value
                              const res = await fetch("/api/kho-hang/send-cnc", {
                                method: "POST",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({ productIds, cncAddress: addressToSend, employeeId: "NV001", products: productPayload })
                              })
                              const data = await res.json()
                              if (data.success) {
                                alert(data.message || `Đã gửi CNC cho ${productIds.length} sản phẩm!`)
                                setConfirmAction(null)
                                await uploadTelegramProof(cncProofFiles, "Gửi CNC")
                                fetchProducts()
                                fetchCNCProducts()
                              } else {
                                alert("Lỗi gửi CNC: " + (data.error || ""))
                              }
                            } catch (e: any) {
                              alert("Lỗi gửi CNC: " + (e?.message || String(e)))
                            } finally {
                              setIsLoading(false)
                              setSelectedProductIds([])
                              setIsEditMode(false)
                              setCncProofFiles([])
                            }
                          }} className="bg-blue-600 text-white rounded-lg px-6 py-2 font-semibold shadow hover:bg-blue-700 transition-all">Xác nhận gửi CNC</Button>
                        </div>
                      </>
                    ) : (
                      <>
                        <h2 className="text-xl font-bold mb-4 text-blue-700 flex items-center gap-2">
                          <span style={{letterSpacing:1}}>🛠️</span> Xác nhận Bảo Hành
                        </h2>
                        <div className="mb-6">
                          <div className="text-base font-medium mb-2 text-slate-700">Nhập lỗi cho từng sản phẩm:</div>
                          <div className="space-y-4">
                            {filteredProducts.filter(p => selectedProductIds.includes(p.id)).map((p) => (
                              <div key={p.id} className="bg-slate-50 rounded-xl p-4 shadow flex flex-col gap-2 border border-slate-100">
                                <div className="font-semibold text-blue-700 mb-1 flex items-center gap-2">
                                  <span>{p.ten_san_pham}</span>
                                  <span className="text-slate-900 font-semibold">{p.mau_sac}{p.mau_sac && p.dung_luong ? ' - ' : ''}{p.dung_luong}</span>
                                  <span className="text-xs text-slate-500">IMEI: {p.imei}</span>
                                </div>
                                <input type="text" placeholder="Nhập lỗi sản phẩm" value={p.loi || ""} onChange={e => {
                                  const newProducts = products.map(pr => pr.id === p.id ? { ...pr, loi: e.target.value } : pr)
                                  setProducts(newProducts)
                                }} className="border rounded-lg px-3 py-2 w-full focus:ring-2 focus:ring-blue-200 transition-all text-base" />
                              </div>
                            ))}
                          </div>
                          <div className="mt-6">
                            <label className="block text-base font-medium mb-2 text-blue-700">Địa chỉ bảo hành</label>
                            <div className="w-full">
                              <Select value={diaChiBaoHanh} onValueChange={val => {
                                if (val === "__add__") {
                                  setIsAddingBaoHanhAddress(true)
                                } else {
                                  setDiaChiBaoHanh(val)
                                  setProducts(products.map(pr => selectedProductIds.includes(pr.id) ? { ...pr, dia_chi_bao_hanh: val } : pr))
                                }
                              }}>
                                <SelectTrigger className="w-full bg-white rounded-lg shadow border focus:ring-2 focus:ring-blue-200">
                                  <SelectValue placeholder="Chọn địa chỉ bảo hành" />
                                </SelectTrigger>
                                <SelectContent className="bg-white rounded-lg shadow-lg">
                                  <SelectItem value={BAOHANH_DEFAULT.value} className="font-bold">
                                    <div style={{fontWeight:700}}>{BAOHANH_DEFAULT.label}</div>
                                    <div style={{fontSize:12, color:'#64748b'}}>{BAOHANH_DEFAULT.desc}</div>
                                  </SelectItem>
                                  {baoHanhAddresses.filter(a => a.value !== BAOHANH_DEFAULT.value).map((a, idx) => (
                                    <SelectItem key={a.value} value={a.value}>
                                      <div style={{fontWeight:500}}>{a.label}</div>
                                      <div style={{fontSize:12, color:'#64748b'}}>{a.value}</div>
                                    </SelectItem>
                                  ))}
                                  <SelectItem value="__add__" className="text-blue-600">+ Thêm địa chỉ mới...</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            {isAddingBaoHanhAddress && (
                              <div className="mt-3">
                                <input type="text" className="border rounded-lg px-3 py-2 w-full focus:ring-2 focus:ring-blue-200 text-base" placeholder="Nhập địa chỉ bảo hành mới..." value={newBaoHanhAddress} onChange={e => setNewBaoHanhAddress(e.target.value)} />
                                <div className="flex gap-2 mt-2">
                                  <Button size="sm" onClick={() => {
                                    if (newBaoHanhAddress.trim()) {
                                      setBaoHanhAddresses(prev => [...prev, { label: newBaoHanhAddress, value: newBaoHanhAddress, desc: "" }])
                                      setDiaChiBaoHanh(newBaoHanhAddress)
                                      setProducts(products.map(pr => selectedProductIds.includes(pr.id) ? { ...pr, dia_chi_bao_hanh: newBaoHanhAddress } : pr))
                                      setNewBaoHanhAddress("")
                                      setIsAddingBaoHanhAddress(false)
                                    }
                                  }} className="bg-blue-600 text-white">Lưu</Button>
                                  <Button size="sm" variant="outline" onClick={() => {
                                    setIsAddingBaoHanhAddress(false)
                                    setNewBaoHanhAddress("")
                                  }}>Hủy</Button>
                                </div>
                              </div>
                            )}
                            <div className="mt-4">
                              <Label className="text-sm text-slate-700">Ảnh xác nhận (tùy chọn)</Label>
                              <Input type="file" multiple accept="image/*" onChange={e => setBaoHanhProofFiles(Array.from(e.target.files || []))} className="mt-1" />
                              {baoHanhProofFiles.length > 0 && (
                                <p className="text-xs text-slate-500 mt-1">{baoHanhProofFiles.length} ảnh đã chọn</p>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex gap-4 justify-end mt-8">
                          <Button variant="outline" onClick={handleCancelAction} className="rounded-lg px-6 py-2 border border-slate-300">Hủy</Button>
                          <Button onClick={async () => {
                            setIsLoading(true)
                            try {
                              const selected = products.filter(p => selectedProductIds.includes(p.id))
                              const productPayload = selected.map(p => ({
                                id: p.id,
                                ten_san_pham: p.ten_san_pham,
                                loai_may: p.loai_may,
                                imei: p.imei,
                                nguon: p.nguon ? p.nguon : (p.id.startsWith("BH-") ? "Khách ngoài" : "Kho shop"),
                                tinh_trang: p.tinh_trang,
                                loi: p.loi || "",
                                dia_chi_bao_hanh: diaChiBaoHanh || "",
                                ten_khach_hang: p.ten_khach_hang || "",
                                so_dien_thoai: p.so_dien_thoai || "",
                                trang_thai_cu: "Còn hàng" // Thêm trường này
                              }))
                              const productIds = selected.map(p => p.imei || p.id)
                              const res = await fetch("/api/kho-hang/return-baohanh", {
                                method: "POST",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({ productIds, employeeId: "NV001", products: productPayload })
                              })
                              const data = await res.json()
                              if (data.success) {
                                alert(data.message || `Đã trả bảo hành cho ${productIds.length} sản phẩm!`)
                                setConfirmAction(null)
                                await uploadTelegramProof(baoHanhProofFiles, "Gửi bảo hành")
                                fetchProducts()
                                fetchBaoHanhHistory()
                              } else {
                                alert("Lỗi trả bảo hành: " + (data.error || ""))
                              }
                            } catch (e: any) {
                              alert("Lỗi trả bảo hành: " + (e?.message || String(e)))
                            } finally {
                              setIsLoading(false)
                              setSelectedProductIds([])
                              setIsEditMode(false)
                              setBaoHanhProofFiles([])
                            }
                          }} className="bg-blue-600 text-white rounded-lg px-6 py-2 font-semibold shadow hover:bg-blue-700 transition-all">Xác nhận</Button>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              )}

              <div className={`border rounded-lg overflow-hidden shadow-sm mt-6${isMobile ? ' mx-[-2px]' : ''}`}> 
                <div className="bg-slate-50 px-6 py-4 border-b">
                  <h3 className="font-semibold">Danh sách sản phẩm</h3>
                  <p className="text-sm">Hiển thị {filteredProducts.length} sản phẩm</p>
                </div>
                {isMobile ? (
                  <div className="px-1 pt-4 pb-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {isLoading ? (
                      <div className="text-center text-slate-400 col-span-full py-6">Đang tải...</div>
                    ) : paginatedProducts.length === 0 ? (
                      <div className="text-center text-slate-400 col-span-full py-6">Chưa có sản phẩm nào</div>
                    ) : (
                      paginatedProducts.map((p) => (
                        <div
                          key={p.id}
                          className={`relative rounded-xl border border-slate-200 bg-white p-3 shadow-sm active:scale-[0.99] transition ${isEditMode ? "cursor-pointer" : ""} mx-[-2px]"`}
                          onClick={() => { if (isEditMode) handleSelectProduct(p.id) }}
                        >
                          {isEditMode && (
                            <div className="absolute top-3 left-3">
                              <input type="checkbox" checked={selectedProductIds.includes(p.id)} readOnly />
                            </div>
                          )}
                          <div className="flex items-start justify-between gap-2">
                            <div className="font-semibold text-slate-800">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span>{p.ten_san_pham}</span>
                                {p.nguon === "Đối tác" && (
                                  <span className="inline-flex px-2 py-0.5 text-[10px] rounded-full bg-purple-100 text-purple-700 border border-purple-200" title={p.ten_doi_tac ? `Đối tác: ${p.ten_doi_tac}${p.sdt_doi_tac ? ` (${p.sdt_doi_tac})` : ''}` : 'Hàng đối tác'}>
                                    Đối tác{p.ten_doi_tac ? `: ${p.ten_doi_tac}` : ''}
                                  </span>
                                )}
                              </div>
                              <div className="mt-0.5 text-slate-900 font-semibold">{p.mau_sac}{p.mau_sac && p.dung_luong ? ' - ' : ''}{p.dung_luong}</div>
                            </div>
                            <div className="flex flex-col items-end gap-1">
                              <Badge className={getTrangThaiColor(p.trang_thai) + " rounded-full px-2 py-0.5 text-[10px] font-semibold"}>{getTrangThaiText(p.trang_thai)}</Badge>
                              <Badge className={getTrangThaiKhoColor(p.trang_thai_kho) + " rounded-full px-2 py-0.5 text-[10px] font-semibold"}>
                                {p.trang_thai_kho || "Có sẵn"}
                              </Badge>
                            </div>
                          </div>
                          <div className="mt-2 text-sm text-slate-700">
                            <div>IMEI/Serial: <span className="font-medium">{p.imei || p.serial || "-"}</span></div>
                            <div className="text-xs text-slate-500">Pin: {p.pin || "-"} • {p.tinh_trang}</div>
                          </div>
                          <div className="mt-3 flex items-baseline gap-3">
                            <div className="text-green-700 font-semibold">{p.gia_ban?.toLocaleString("vi-VN")} VNĐ</div>
                            {isManager && (
                              <div className="text-blue-700 text-xs">Nhập: {p.gia_nhap?.toLocaleString("vi-VN")} VNĐ</div>
                            )}
                          </div>
                          <div className="mt-1 text-xs text-slate-500">Ngày nhập: {p.ngay_nhap || "-"}</div>
                          {p.ghi_chu && (
                            <div className="mt-1 text-xs text-slate-500 line-clamp-2">Ghi chú: {p.ghi_chu}</div>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-blue-50/50 text-blue-700">
                        {isEditMode && (
                          <TableHead className="font-semibold">
                            <input type="checkbox" checked={selectedProductIds.length === filteredProducts.length && filteredProducts.length > 0} onChange={handleSelectAllProducts} />
                          </TableHead>
                        )}
                        <TableHead className="font-semibold">Sản phẩm</TableHead>
                            <TableHead className="font-semibold">IMEI/Serial</TableHead>
                        <TableHead className="font-semibold">Pin</TableHead>
                        <TableHead className="font-semibold">Tình trạng</TableHead>
                        <TableHead className="font-semibold">Trạng thái</TableHead>
                        <TableHead className="font-semibold">Kho</TableHead>
                        {isManager && <TableHead className="font-semibold">Giá nhập</TableHead>}
                        <TableHead className="font-semibold">Giá bán</TableHead>
                        <TableHead className="font-semibold">Ngày nhập</TableHead>
                        <TableHead className="font-semibold">Ghi chú</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {isLoading ? (
                        <TableRow><TableCell colSpan={(isManager ? (isEditMode ? 11 : 10) : (isEditMode ? 10 : 9))} className="text-center py-8 text-slate-400">Đang tải...</TableCell></TableRow>
                      ) : paginatedProducts.length === 0 ? (
                        <TableRow><TableCell colSpan={(isManager ? (isEditMode ? 11 : 10) : (isEditMode ? 10 : 9))} className="text-center py-8 text-slate-400">Chưa có sản phẩm nào</TableCell></TableRow>
                      ) : (
                        paginatedProducts.map((p, idx) => (
                          <TableRow key={p.id} className={idx % 2 === 0 ? "bg-white" : "bg-slate-50"}>
                            {isEditMode && (
                              <TableCell>
                                <input type="checkbox" checked={selectedProductIds.includes(p.id)} onChange={() => handleSelectProduct(p.id)} />
                              </TableCell>
                            )}
                            <TableCell className="font-medium text-slate-800">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span>{p.ten_san_pham}</span>
                                {p.nguon === "Đối tác" && (
                                  <span className="inline-flex px-2 py-0.5 text-[10px] rounded-full bg-purple-100 text-purple-700 border border-purple-200" title={p.ten_doi_tac ? `Đối tác: ${p.ten_doi_tac}${p.sdt_doi_tac ? ` (${p.sdt_doi_tac})` : ''}` : 'Hàng đối tác'}>
                                    Đối tác{p.ten_doi_tac ? `: ${p.ten_doi_tac}` : ''}
                                  </span>
                                )}
                              </div>
                              <div className="mt-0.5 text-slate-900 font-semibold">
                                {p.mau_sac}{p.mau_sac && p.dung_luong ? ' - ' : ''}{p.dung_luong}
                              </div>
                            </TableCell>
                            <TableCell className="text-sm text-slate-700">{p.imei || p.serial || "-"}</TableCell>
                            <TableCell className="text-sm text-slate-700">{p.pin || "-"}</TableCell>
                            <TableCell className="text-sm text-slate-700">{p.tinh_trang}</TableCell>
                            <TableCell><Badge className={getTrangThaiColor(p.trang_thai) + " rounded-full px-3 py-1 text-xs font-semibold"}>{getTrangThaiText(p.trang_thai)}</Badge></TableCell>
                            <TableCell><Badge className={getTrangThaiKhoColor(p.trang_thai_kho) + " rounded-full px-3 py-1 text-xs font-semibold"}>{p.trang_thai_kho || "Có sẵn"}</Badge></TableCell>
                            {isManager && <TableCell className="text-sm text-blue-700 font-semibold">{p.gia_nhap?.toLocaleString("vi-VN")} VNĐ</TableCell>}
                            <TableCell className="text-sm text-green-700 font-semibold">{p.gia_ban?.toLocaleString("vi-VN")} VNĐ</TableCell>
                            <TableCell className="text-sm text-slate-700">{p.ngay_nhap}</TableCell>
                            <TableCell className="text-sm text-slate-700">{p.ghi_chu || "-"}</TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  {/* ...existing code... */}
                  </Table>
                )}
              </div>
            </CardContent>
            {renderPagination(currentProductPage, productTotalPages, setPage)}
          </Card>
        </TabsContent>

        {/* TAB PHỤ KIỆN */}
        <TabsContent value="phu-kien" className="space-y-6">
          <Card className="shadow-lg border-0">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-3 gap-3">
                <div className="w-full md:w-80">
                  <Input
                    value={accessorySearch}
                    onChange={(e) => { setAccessorySearch(e.target.value); setPageAccessory(1); }}
                    placeholder="Tìm phụ kiện theo tên, loại..."
                  />
                </div>
              </div>
              <div className="border rounded-lg overflow-hidden shadow-sm">
                <div className="bg-slate-50 px-6 py-4 border-b">
                  <h3 className="font-semibold">Danh sách phụ kiện</h3>
                  <p className="text-sm">Hiển thị {filteredAccessories.length} phụ kiện</p>
                </div>
                {isMobile ? (
                  <>
                    {isLoadingAccessories ? (
                      <div className="p-6 text-center text-slate-400">Đang tải...</div>
                    ) : filteredAccessories.length === 0 ? (
                      <div className="p-8 flex flex-col items-center justify-center text-center text-slate-500">
                        <div className="text-3xl mb-2">📦</div>
                        <div className="font-medium">Chưa có phụ kiện nào</div>
                      </div>
                    ) : (
                      <ul className="divide-y">
                        {paginatedAccessories.map((a, idx) => (
                          <li key={a.id || idx} className="p-4 bg-white">
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <div className="font-semibold text-slate-800">{a.ten_phu_kien}</div>
                                <div className="text-xs text-slate-500 mt-0.5">{a.loai_phu_kien || '-'}</div>
                              </div>
                              <div className="text-right">
                                <div className="text-sm font-semibold text-green-700">{a.gia_ban?.toLocaleString('vi-VN')} VNĐ</div>
                                {isManager && <div className="text-xs text-blue-700">{a.gia_nhap?.toLocaleString('vi-VN')} VNĐ</div>}
                              </div>
                            </div>
                            <div className="mt-2 flex items-center justify-between">
                              <div>
                                {a.so_luong_ton === 0 ? (
                                  <span className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded-full bg-red-50 text-red-600 border border-red-200">Đã hết</span>
                                ) : a.so_luong_ton > 0 && a.so_luong_ton <= 5 ? (
                                  <span className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded-full bg-amber-50 text-amber-700 border border-amber-200">Sắp hết: {a.so_luong_ton}</span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">Còn: {a.so_luong_ton}</span>
                                )}
                              </div>
                              <div className="text-xs text-slate-500">
                                {a.updated_at ? new Date(a.updated_at).toLocaleDateString('vi-VN') : '-'}
                              </div>
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </>
                ) : (
                  <>
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-blue-50/50 text-blue-700">
                          <TableHead className="font-semibold">Tên phụ kiện</TableHead>
                          <TableHead className="font-semibold">Loại</TableHead>
                          <TableHead className="font-semibold">Số lượng tồn</TableHead>
                          {isManager && <TableHead className="font-semibold">Giá nhập</TableHead>}
                          <TableHead className="font-semibold">Giá bán</TableHead>
                          <TableHead className="font-semibold">Ngày cập nhật</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {isLoadingAccessories ? (
                          <TableRow><TableCell colSpan={isManager ? 6 : 5} className="text-center py-8 text-slate-400">Đang tải...</TableCell></TableRow>
                        ) : filteredAccessories.length === 0 ? (
                          <TableRow><TableCell colSpan={isManager ? 6 : 5} className="text-center py-8 text-slate-400">Chưa có phụ kiện nào</TableCell></TableRow>
                        ) : (
                          paginatedAccessories.map((a, idx) => (
                            <TableRow key={a.id || idx} className={idx % 2 === 0 ? "bg-white" : "bg-slate-50"}>
                              <TableCell className="font-medium text-slate-800">{a.ten_phu_kien}</TableCell>
                              <TableCell className="text-sm text-slate-700">{a.loai_phu_kien}</TableCell>
                              <TableCell className="text-sm text-slate-700">{a.so_luong_ton}</TableCell>
                              {isManager && <TableCell className="text-sm text-blue-700 font-semibold">{a.gia_nhap?.toLocaleString("vi-VN")} VNĐ</TableCell>}
                              <TableCell className="text-sm text-green-700 font-semibold">{a.gia_ban?.toLocaleString("vi-VN")} VNĐ</TableCell>
                              <TableCell className="text-sm text-slate-700">{a.updated_at ? new Date(a.updated_at).toLocaleDateString("vi-VN") : "-"}</TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                    {renderPagination(currentAccessoryPage, accessoryTotalPages, setPageAccessory)}
                  </>
                )}
              </div>
            </CardContent>
          </Card>
      </TabsContent>

      {/* TAB ĐANG CNC */}
      <TabsContent value="dang-cnc" className="space-y-6">
          <div className="flex justify-between items-center mb-2">
            <Button onClick={() => setIsAddCNCMachineOpen(true)} className="bg-blue-600 text-white font-semibold rounded-lg shadow hover:bg-blue-700">+ Máy CNC</Button>
            <div>
              <button className="p-2 rounded-full hover:bg-blue-100 transition-all" title="Chỉnh sửa danh sách CNC" onClick={() => setIsEditCNCMode(v => !v)}>
                <Edit2 className="w-5 h-5 text-blue-600" />
              </button>
            </div>
          </div>
          {isEditCNCMode && selectedCNCImeis.length > 0 && (
            <div className="flex gap-4 my-4">
              <Button onClick={handleCompleteCNC} className="bg-green-600 text-white font-semibold rounded-lg shadow hover:bg-green-700">Hoàn thành CNC</Button>
              <span className="text-sm text-slate-500">Đã chọn: {selectedCNCImeis.length}</span>
            </div>
          )}
          {/* Dialog xác nhận hoàn thành CNC */}
          {confirmCNCAction && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-30">
              <div className="bg-white rounded-xl shadow-lg p-6 min-w-[350px] max-w-[90vw]">
                <h2 className="text-lg font-bold mb-2 text-green-700">Xác nhận hoàn thành CNC</h2>
                <div className="mb-4">
                  <div className="text-sm mb-2">Các sản phẩm sẽ được chuyển về trạng thái <b>Hoàn thành CNC</b>:</div>
                  <ul className="list-disc pl-5 text-slate-700">
                    {cncProducts.filter(p => selectedCNCImeis.includes(p.imei)).map(p => (
                      <li key={p.imei}>
                        <span className="font-semibold">{p.ten_san_pham}</span> {p.loai_may ? <span className="text-xs text-slate-400">{p.loai_may}</span> : null} (IMEI: {p.imei})
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="mb-4">
                  <Label className="text-sm text-slate-700">Ảnh xác nhận (tùy chọn)</Label>
                  <Input type="file" multiple accept="image/*" onChange={e => setCompleteCncProofFiles(Array.from(e.target.files || []))} className="mt-1" />
                  {completeCncProofFiles.length > 0 && <p className="text-xs text-slate-500 mt-1">{completeCncProofFiles.length} ảnh đã chọn</p>}
                </div>
                <div className="flex gap-3 justify-end mt-4">
                  <Button variant="outline" onClick={handleCancelCompleteCNC}>Hủy</Button>
                  <Button onClick={handleConfirmCompleteCNC} className="bg-green-600 text-white">Xác nhận</Button>
                </div>
              </div>
            </div>
          )}
          <Card className="shadow-lg border-0 mt-6">
            <CardContent className="p-6">
              <div className="border rounded-lg overflow-hidden shadow-sm">
                <div className="bg-blue-50 px-6 py-4 border-b">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h3 className="font-semibold text-blue-700">Danh sách sản phẩm Đang CNC</h3>
                      <p className="text-sm">Hiển thị {filteredCNC.length} sản phẩm</p>
                    </div>
                    {/* Desktop search */}
                    <div className="hidden md:block w-80 max-w-sm">
                      <Input
                        value={cncSearch}
                        onChange={(e) => { setCncSearch(e.target.value); setPageCNC(1); }}
                        placeholder="Tìm theo tên, IMEI, nguồn, tình trạng..."
                      />
                    </div>
                  </div>
                </div>
                {/* Mobile search */}
                <div className="md:hidden px-4 py-3 bg-white border-b">
                  <Input
                    value={cncSearch}
                    onChange={(e) => { setCncSearch(e.target.value); setPageCNC(1); }}
                    placeholder="Tìm theo tên, IMEI, nguồn, tình trạng..."
                    className="w-full"
                  />
                </div>
                {isMobile ? (
                  filteredCNC.length === 0 ? (
                    <div className="p-8 flex flex-col items-center justify-center text-center text-slate-500">
                      <div className="text-3xl mb-2">🛠️</div>
                      <div className="font-medium">Chưa có sản phẩm nào Đang CNC</div>
                    </div>
                  ) : (
                    <div className="px-1 pt-4 pb-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {paginatedCNC.map((p: any, idx: number) => (
                        <div
                          key={`${p.id || idx}-${p.imei}`}
                          className={`relative rounded-xl border border-slate-200 bg-white p-3 shadow-sm active:scale-[0.99] transition ${isEditCNCMode ? "cursor-pointer" : ""}`}
                          onClick={() => {
                            if (isEditCNCMode) {
                              handleSelectCNCProduct(p.imei)
                            } else {
                              setViewCustomer({ dia_chi_bao_hanh: p.dia_chi_cnc || '-', ten_khach_hang: p.ten_khach_hang || '-', so_dien_thoai: p.so_dien_thoai || '-', imei: p.imei || '' })
                            }
                          }}
                        >
                          {isEditCNCMode && (
                            <div className="absolute top-3 left-3">
                              <input type="checkbox" checked={selectedCNCImeis.includes(p.imei)} readOnly />
                            </div>
                          )}
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <div className="font-semibold text-slate-800">{p.ten_san_pham}</div>
                              <div className="text-xs text-slate-500 mt-0.5">
                                {(p.loai_may || '-') + (p["Màu Sắc"] || p.mau_sac ? ` - ${p["Màu Sắc"] || p.mau_sac}` : '')}
                              </div>
                              <div className="mt-1 text-sm text-slate-700">IMEI: <span className="font-medium">{p.imei || '-'}</span></div>
                              <div className="mt-1 text-xs text-slate-500">Nguồn: {p.nguon || '-'}</div>
                            </div>
                            <div className="text-right">
                              <Badge className={getTrangThaiColor(p.trang_thai) + " rounded-full px-2 py-0.5 text-[10px] font-semibold"}>{getTrangThaiText(p.trang_thai)}</Badge>
                              {/* Eye icon removed per request - details available by tapping the card */}
                            </div>
                          </div>
                          <div className="mt-2 text-xs text-slate-500">Ngày gửi: {p.ngay_gui || '-'}</div>
                          <div className="mt-1 text-xs text-slate-500">Ngày nhận lại: {p.ngay_nhan_lai || '-'}</div>
                        </div>
                      ))}
                    </div>
                  )
                ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="bg-blue-50/50 text-blue-700">
                      {isEditCNCMode && (
                        <TableHead className="font-semibold">
                          <input type="checkbox" checked={selectedCNCImeis.length === filteredCNC.length && filteredCNC.length > 0} onChange={handleSelectAllCNCProducts} />
                        </TableHead>
                      )}
                      <TableHead className="font-semibold">Tên Sản phẩm</TableHead>
                      <TableHead className="font-semibold">IMEI</TableHead>
                      <TableHead className="font-semibold">Màu Sắc</TableHead>
                      <TableHead className="font-semibold">Nguồn</TableHead>
                      <TableHead className="font-semibold">Tình trạng</TableHead>
                      <TableHead className="font-semibold">Loại máy</TableHead>
                      <TableHead className="font-semibold">Trạng thái</TableHead>
                      <TableHead className="font-semibold">Ngày gửi</TableHead>
                      <TableHead className="font-semibold">Ngày nhận lại</TableHead>
                      <TableHead className="font-semibold">Thông tin</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredCNC.length === 0 ? (
                      <TableRow><TableCell colSpan={isEditCNCMode ? 10 : 9} className="text-center py-8 text-slate-400">Chưa có sản phẩm nào Đang CNC</TableCell></TableRow>
                    ) : (
                      paginatedCNC.map((p, idx) => (
                          <TableRow key={`${p.id}-${p.imei}`} className={idx % 2 === 0 ? "bg-white" : "bg-slate-50"}>
                            {isEditCNCMode && (
                              <TableCell>
                                <input type="checkbox" checked={selectedCNCImeis.includes(p.imei)} onChange={() => handleSelectCNCProduct(p.imei)} />
                              </TableCell>
                            )}
                            <TableCell className="text-sm text-slate-800">{p.ten_san_pham}</TableCell>
                            <TableCell className="text-sm text-slate-700">{p.imei}</TableCell>
                            <TableCell className="text-sm text-slate-700">{p["Màu Sắc"] || p.mau_sac || "-"}</TableCell>
                            <TableCell className="text-sm text-slate-700">{p.nguon}</TableCell>
                            <TableCell className="text-sm text-slate-700">{p.tinh_trang}</TableCell>
                            <TableCell className="text-sm text-slate-700">{p.loai_may}</TableCell>
                            <TableCell><Badge className={getTrangThaiColor(p.trang_thai) + " rounded-full px-3 py-1 text-xs font-semibold"}>{getTrangThaiText(p.trang_thai)}</Badge></TableCell>
                            <TableCell className="text-sm text-slate-700">{p.ngay_gui}</TableCell>
                            <TableCell className="text-sm text-slate-700">{p.ngay_nhan_lai}</TableCell>
                            <TableCell>
                            <button
                              type="button"
                              className="p-1 rounded hover:bg-blue-50 cursor-pointer"
                              title="Xem thông tin CNC"
                              onClick={e => {
                                const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                                setDialogInfo({
                                  data: {
                                    dia_chi_bao_hanh: p.dia_chi_cnc || '-',
                                    ten_khach_hang: p.ten_khach_hang || '-',
                                    so_dien_thoai: p.so_dien_thoai || '-',
                                    imei: p.imei || ''
                                  },
                                  pos: { x: rect.right + 8, y: rect.top }
                                });
                              }}
                            >
                              <Eye className="w-4 h-4 text-blue-600" />
                            </button>
                          </TableCell>
                          {p.trang_thai === "Hoàn thành CNC" && p.nguon === "Khách ngoài" && (
                            <TableCell>
                              <Button size="sm" className="bg-blue-500 text-white" onClick={() => handleCustomerReceived(p.imei)}>Khách đã nhận</Button>
                            </TableCell>
                          )}
                        </TableRow>
                      ))
                    )}


      {/* Dialog thông tin CNC dạng box nhỏ, fixed trên màn hình, chỉ hiển thị 1 lần */}
      {dialogInfo && (() => {
        // compute safe position so popup never overflows viewport
        const modalMinWidth = 200;
        let left = dialogInfo.pos.x;
        let top = dialogInfo.pos.y;
        if (typeof window !== 'undefined') {
          const margin = 12;
          const maxLeft = Math.max(margin, window.innerWidth - modalMinWidth - margin);
          left = Math.min(left, maxLeft);
          left = Math.max(margin, left);
          const maxTop = Math.max(margin, window.innerHeight - 80);
          top = Math.min(top, maxTop);
          top = Math.max(margin, top);
        }
        return (
          <div
            style={{
              position: 'fixed',
              left,
              top,
              zIndex: 9999,
              minWidth: modalMinWidth + 'px',
              background: 'white',
              border: '1px solid #e2e8f0',
              borderRadius: '12px',
              boxShadow: '0 4px 24px rgba(0,0,0,0.12)',
              padding: '16px',
              fontSize: '13px',
              color: '#334155',
            }}
          >
            <div style={{ fontWeight: 700, color: '#2563eb', marginBottom: 6 }}>Thông tin CNC</div>
            <div><b>Địa chỉ CNC:</b> {dialogInfo.data.dia_chi_bao_hanh}</div>
            <div><b>Khách:</b> {dialogInfo.data.ten_khach_hang}</div>
            <div><b>ĐT:</b> {dialogInfo.data.so_dien_thoai}</div>
            <button onClick={() => setDialogInfo(null)} style={{ marginTop: 10, padding: '4px 12px', borderRadius: 6, background: '#eff6ff', color: '#2563eb', fontWeight: 600, fontSize: 12, border: 'none', cursor: 'pointer' }}>Đóng</button>
          </div>
        )
      })()}
                </TableBody>
                </Table>
                )}
            </div>
            {/* Di chuyển dialogInfo ra ngoài Table/TableBody để tránh lỗi hydration */}
            {dialogInfo && (() => {
              const modalMinWidth = 200;
              let left = dialogInfo.pos.x;
              let top = dialogInfo.pos.y;
              if (typeof window !== 'undefined') {
                const margin = 12;
                const maxLeft = Math.max(margin, window.innerWidth - modalMinWidth - margin);
                left = Math.min(left, maxLeft);
                left = Math.max(margin, left);
                const maxTop = Math.max(margin, window.innerHeight - 80);
                top = Math.min(top, maxTop);
                top = Math.max(margin, top);
              }
              return (
                <div
                  style={{
                    position: 'fixed',
                    left,
                    top,
                    zIndex: 9999,
                    minWidth: modalMinWidth + 'px',
                    background: 'white',
                    border: '1px solid #e2e8f0',
                    borderRadius: '12px',
                    boxShadow: '0 4px 24px rgba(0,0,0,0.12)',
                    padding: '16px',
                    fontSize: '13px',
                    color: '#334155',
                  }}
                >
                  <div style={{ fontWeight: 700, color: '#2563eb', marginBottom: 6 }}>Thông tin CNC</div>
                  <div><b>Địa chỉ CNC:</b> {dialogInfo.data.dia_chi_bao_hanh}</div>
                  <div><b>Khách:</b> {dialogInfo.data.ten_khach_hang}</div>
                  <div><b>ĐT:</b> {dialogInfo.data.so_dien_thoai}</div>
                  <button onClick={() => setDialogInfo(null)} style={{ marginTop: 10, padding: '4px 12px', borderRadius: 6, background: '#eff6ff', color: '#2563eb', fontWeight: 600, fontSize: 12, border: 'none', cursor: 'pointer' }}>Đóng</button>
                </div>
              )
            })()}
          </CardContent>
        </Card>
        <AddCNCMachineDialog
          isOpen={isAddCNCMachineOpen}
          onClose={() => setIsAddCNCMachineOpen(false)}
          onSuccess={fetchCNCProducts}
        />
      </TabsContent>

      {/* TAB BẢO HÀNH */}
      <TabsContent value="bao-hanh" className="space-y-6">
        {isEditBaoHanhMode && selectedBaoHanhIds.length > 0 && (
          <div className="flex gap-4 my-4">
            <Button onClick={() => setConfirmBaoHanhAction(true)} className="bg-green-600 text-white font-semibold rounded-lg shadow hover:bg-green-700">Hoàn thành bảo hành</Button>
            <span className="text-sm text-slate-500">Đã chọn: {selectedBaoHanhIds.length}</span>
          </div>
        )}

        {/* Dialog xác nhận hoàn thành bảo hành */}
        {confirmBaoHanhAction && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-30">
            <div className="bg-white rounded-xl shadow-lg p-6 min-w-[350px] max-w-[90vw]">
              <h2 className="text-lg font-bold mb-2 text-green-700">Xác nhận hoàn thành bảo hành</h2>
              <div className="mb-4">
                <div className="text-sm mb-2">Các sản phẩm sẽ được chuyển về trạng thái <b>Hoàn thành bảo hành</b>:</div>
                <ul className="list-disc pl-5 text-slate-700">
                  {filteredBaoHanh.filter((p: any) => {
                    const key = p["IMEI"] || p.imei;
                    return selectedBaoHanhIds.includes(key);
                  }).map((p: any) => (
                    <li key={p["IMEI"] || p.imei}>{p["Tên Sản Phẩm"] || p.ten_san_pham || '-'} (IMEI: {p["IMEI"] || p.imei || '-'})</li>
                  ))}
                </ul>
              </div>
              <div className="mb-4">
                <Label className="text-sm text-slate-700">Ảnh xác nhận (tùy chọn)</Label>
                <Input type="file" multiple accept="image/*" onChange={e => setCompleteBaoHanhProofFiles(Array.from(e.target.files || []))} className="mt-1" />
                {completeBaoHanhProofFiles.length > 0 && <p className="text-xs text-slate-500 mt-1">{completeBaoHanhProofFiles.length} ảnh đã chọn</p>}
              </div>
              <div className="flex gap-3 justify-end mt-4">
                <Button variant="outline" onClick={() => { setConfirmBaoHanhAction(false); setCompleteBaoHanhProofFiles([]) }}>Hủy</Button>
                <Button onClick={handleConfirmCompleteBaoHanh} className="bg-green-600 text-white">Xác nhận</Button>
              </div>
            </div>
          </div>
        )}
        <div className="flex justify-between items-center mb-2">
          <Button onClick={() => setIsAddBaoHanhMachineOpen(true)} className="bg-blue-600 text-white font-semibold rounded-lg shadow hover:bg-blue-700">+ Máy bảo hành</Button>
          <div>
            <button className="p-2 rounded-full hover:bg-blue-100 transition-all" title="Chỉnh sửa danh sách bảo hành" onClick={() => setIsEditBaoHanhMode(v => !v)}>
              <Edit2 className="w-5 h-5 text-blue-600" />
            </button>
          </div>
        </div>
        <Card className="shadow-lg border-0">
          <CardContent className="p-6">
            <div className="border rounded-lg overflow-hidden shadow-sm">
              <div className="bg-blue-50 px-6 py-4 border-b">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h3 className="font-semibold text-blue-700">Danh sách sản phẩm Bảo hành</h3>
                    <p className="text-sm">Hiển thị {filteredBaoHanh.length} sản phẩm</p>
                  </div>
                  {/* Desktop search */}
                  <div className="hidden md:block w-80 max-w-sm">
                    <Input
                      value={baoHanhSearch}
                      onChange={(e) => { setBaoHanhSearch(e.target.value); setPageBaoHanh(1); }}
                      placeholder="Tìm theo tên, IMEI, nguồn, lỗi..."
                    />
                  </div>
                </div>
              </div>
              {/* Mobile search */}
              <div className="md:hidden px-4 py-3 bg-white border-b">
                <Input
                  value={baoHanhSearch}
                  onChange={(e) => { setBaoHanhSearch(e.target.value); setPageBaoHanh(1); }}
                  placeholder="Tìm theo tên, IMEI, nguồn, lỗi..."
                  className="w-full"
                />
              </div>
              {isMobile ? (
                isLoading ? (
                  <div className="p-8 flex flex-col items-center justify-center text-center text-slate-500">
                    <div className="text-slate-400">Đang tải...</div>
                  </div>
                ) : filteredBaoHanh.length === 0 ? (
                  <div className="p-8 flex flex-col items-center justify-center text-center text-slate-500">
                    <div className="text-3xl mb-2">🧰</div>
                    <div className="font-medium">Không có sản phẩm bảo hành nào</div>
                  </div>
                ) : (
                  <div className="px-1 pt-4 pb-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {paginatedBaoHanh.map((p: any, idx: number) => {
                      const key = p["IMEI"] || p.imei || idx;
                      return (
                        <div
                          key={key}
                          className={`relative rounded-xl border border-slate-200 bg-white p-3 shadow-sm transition ${isEditBaoHanhMode ? "cursor-pointer" : ""}`}
                          onClick={() => {
                            if (isEditBaoHanhMode) {
                              handleSelectBaoHanh(key)
                            } else {
                              setViewCustomer({ dia_chi_bao_hanh: p["Địa chỉ Bảo hành"] || '-', ten_khach_hang: p["Tên khách hàng"] || '-', so_dien_thoai: p["Số điện thoại"] || '-', imei: p["IMEI"] || p.imei || '' })
                            }
                          }}
                        >
                          {isEditBaoHanhMode && (
                            <div className="absolute top-3 left-3">
                              <input type="checkbox" checked={selectedBaoHanhIds.includes(key)} readOnly />
                            </div>
                          )}
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <div className="font-semibold text-slate-800">{p["Tên Sản Phẩm"] || '-'}</div>
                              <div className="text-xs text-slate-500 mt-0.5">
                                {(p["Loại Máy"] || '-') + (p["Màu Sắc"] || p.mau_sac ? ` - ${p["Màu Sắc"] || p.mau_sac}` : '')}
                              </div>
                              <div className="mt-1 text-sm text-slate-700">IMEI: <span className="font-medium">{p["IMEI"] || p.imei || '-'}</span></div>
                              <div className="mt-1 text-xs text-slate-500">Nguồn: {p["Nguồn"] || '-'}</div>
                              {p["Lỗi"] && <div className="mt-2 text-sm text-red-600">Lỗi: {p["Lỗi"]}</div>}
                            </div>
                            <div className="text-right">
                              <Badge className={getTrangThaiColor(p["Trạng Thái"] || '-') + " rounded-full px-2 py-0.5 text-[10px] font-semibold"}>{getTrangThaiText(p["Trạng Thái"] || '-')}</Badge>
                              {/* Eye icon removed per request - details available by tapping the card */}
                            </div>
                          </div>
                          <div className="mt-2 text-xs text-slate-500">Ngày gửi: {p["Ngày gửi"] || '-'}</div>
                          <div className="mt-1 text-xs text-slate-500">Ngày nhận lại: {p["Ngày nhận lại"] || '-'}</div>
                        </div>
                      )
                    })}
                  </div>
                )
              ) : (
              <Table>
                <TableHeader>
                  <TableRow className="bg-blue-50/50 text-blue-700">
                    {isEditBaoHanhMode && (
                      <TableHead>
                        <input
                          type="checkbox"
                          checked={selectedBaoHanhIds.length === filteredBaoHanh.length && filteredBaoHanh.length > 0}
                          onChange={handleSelectAllBaoHanh}
                        />
                      </TableHead>
                    )}
                    <TableHead className="font-semibold">Tên Sản Phẩm</TableHead>
                    <TableHead className="font-semibold">Loại Máy</TableHead>
                    <TableHead className="font-semibold">IMEI</TableHead>
                    <TableHead className="font-semibold">Màu Sắc</TableHead>
                    <TableHead className="font-semibold">Nguồn</TableHead>
                    <TableHead className="font-semibold">Tình trạng</TableHead>
                    <TableHead className="font-semibold">Lỗi</TableHead>
                    <TableHead className="font-semibold">Trạng Thái</TableHead>
                    <TableHead className="font-semibold">Ngày gửi</TableHead>
                    <TableHead className="font-semibold">Ngày nhận lại</TableHead>
                    <TableHead className="font-semibold">Thông tin</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredBaoHanh.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={isEditBaoHanhMode ? 12 : 11} className="text-center py-8 text-slate-400">Không có sản phẩm bảo hành nào</TableCell>
                    </TableRow>
                  ) : (
                    paginatedBaoHanh.map((p: any, idx: number) => {
                      const key = p["IMEI"] || p.imei || idx;
                      return (
                          <TableRow key={key} className={idx % 2 === 0 ? "bg-white" : "bg-slate-50"}>
                            {isEditBaoHanhMode && (
                              <TableCell>
                                <input
                                  type="checkbox"
                                  checked={selectedBaoHanhIds.includes(key)}
                                  onChange={() => handleSelectBaoHanh(key)}
                                />
                              </TableCell>
                            )}
                            <TableCell className="font-medium text-slate-800 flex items-center gap-2">
                              {p["Tên Sản Phẩm"] || '-'}
                            </TableCell>
                            <TableCell className="text-sm text-slate-700">{p["Loại Máy"] || '-'}</TableCell>
                            <TableCell className="text-sm text-slate-700">{p["IMEI"] || '-'}</TableCell>
                            <TableCell className="text-sm text-slate-700">{p["Màu Sắc"] || p.mau_sac || '-'}</TableCell>
                            <TableCell className="text-sm text-slate-700">{p["Nguồn"] || '-'}</TableCell>
                            <TableCell className="text-sm text-slate-700">{p["Tình trạng"] || '-'}</TableCell>
                            <TableCell className="text-sm text-slate-700">{p["Lỗi"] || '-'}</TableCell>
                            <TableCell><Badge className={getTrangThaiColor(p["Trạng Thái"] || '-') + " rounded-full px-3 py-1 text-xs font-semibold"}>{getTrangThaiText(p["Trạng Thái"] || '-')}</Badge></TableCell>
                            <TableCell className="text-sm text-slate-700">{p["Ngày gửi"] || '-'}</TableCell>
                            <TableCell className="text-sm text-slate-700">{p["Ngày nhận lại"] || '-'}</TableCell>
                            <TableCell>
                            <div className="flex items-center">
                              <button
                                type="button"
                                className="p-1 rounded hover:bg-blue-50 cursor-pointer"
                                onClick={e => {
                                  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                                  setDialogInfo({
                                    data: {
                                      dia_chi_bao_hanh: p["Địa chỉ Bảo hành"] || '-',
                                      ten_khach_hang: p["Tên khách hàng"] || '-',
                                      so_dien_thoai: p["Số điện thoại"] || '-',
                                      imei: p["IMEI"] || p.imei || ''
                                    },
                                    pos: { x: rect.right + 8, y: rect.top }
                                  });
                                }}
                              >
                                <Eye className="w-5 h-5 text-blue-600" />
                              </button>
                            </div>
                          </TableCell>
                        </TableRow>
                      )
                    })
                  )}
                </TableBody>
                </Table>
              )}
            </div>
            {renderPagination(currentBaoHanhPage, baoHanhTotalPages, setPageBaoHanh)}
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>

    {/* Dialog thông tin bảo hành dạng box nhỏ, fixed trên màn hình, chỉ hiển thị 1 lần */}
    {dialogInfo && (() => {
      const modalMinWidth = 200
      let left = dialogInfo.pos.x
      let top = dialogInfo.pos.y
      if (typeof window !== "undefined") {
        const margin = 12
        const maxLeft = Math.max(margin, window.innerWidth - modalMinWidth - margin)
        left = Math.min(left, maxLeft)
        left = Math.max(margin, left)
        const maxTop = Math.max(margin, window.innerHeight - 80)
        top = Math.min(top, maxTop)
        top = Math.max(margin, top)
      }
      return (
        <div
          style={{
            position: "fixed",
            left,
            top,
            zIndex: 9999,
            minWidth: modalMinWidth + "px",
            background: "white",
            border: "1px solid #e2e8f0",
            borderRadius: "12px",
            boxShadow: "0 4px 24px rgba(0,0,0,0.12)",
            padding: "16px",
            fontSize: "13px",
            color: "#334155",
          }}
        >
          <div style={{ fontWeight: 700, color: "#2563eb", marginBottom: 6 }}>Thông tin bảo hành</div>
          <div><b>Địa chỉ:</b> {dialogInfo.data.dia_chi_bao_hanh}</div>
          <div><b>Khách:</b> {dialogInfo.data.ten_khach_hang}</div>
          <div><b>ĐT:</b> {dialogInfo.data.so_dien_thoai}</div>
          <button
            onClick={() => setDialogInfo(null)}
            style={{
              marginTop: 10,
              padding: "4px 12px",
              borderRadius: 6,
              background: "#eff6ff",
              color: "#2563eb",
              fontWeight: 600,
              fontSize: 12,
              border: "none",
              cursor: "pointer",
            }}
          >
            Đóng
          </button>
        </div>
      )
    })()}

    {/* Sticky bulk actions on mobile */}
    {isMobile && isEditMode && selectedProductIds.length > 0 && (
      <div className="fixed bottom-4 left-4 right-4 z-40">
        <div className="rounded-2xl shadow-xl border border-slate-200 bg-white p-3 flex items-center justify-between gap-2">
          <div className="text-sm text-slate-600">Đã chọn: <span className="font-semibold">{selectedProductIds.length}</span></div>
          <div className="flex gap-2">
            <Button size="sm" onClick={handleSendSelectedCNC} className="bg-yellow-500 text-white font-semibold rounded-lg hover:bg-yellow-600">Gửi CNC</Button>
            <Button size="sm" onClick={handleSendSelectedBaoHanh} className="bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700">Bảo Hành</Button>
          </div>
        </div>
      </div>
    )}
    {/* Dialog nhập/sửa sản phẩm kho */}
    <ProductDialog
      isOpen={isDialogOpen}
      onClose={() => setIsDialogOpen(false)}
      product={selectedProduct}
      onSuccess={() => {
        setIsLoading(true)
        fetchProducts().finally(() => setIsLoading(false))
        // Re-fetch again shortly after to ensure Sheets has committed
        setTimeout(() => {
          setIsLoading(true)
          fetchProducts().finally(() => setIsLoading(false))
        }, 800)
      }}
    />
    {/* Dialog thêm máy bảo hành ngoài kho */}
    <AddBaoHanhMachineDialog
      isOpen={isAddBaoHanhMachineOpen}
      onClose={() => setIsAddBaoHanhMachineOpen(false)}
      onSuccess={fetchBaoHanhHistory}
    />
    {/* Dialog chi tiết khi click card (CNC / Bảo hành) */}
    <Dialog open={!!viewCustomer} onOpenChange={(open) => { if (!open) setViewCustomer(null) }}>
      <DialogContent className="rounded-xl">
        <DialogHeader>
          <DialogTitle>Chi tiết</DialogTitle>
        </DialogHeader>
        {viewCustomer ? (
          <div className="space-y-3">
            <div><b>IMEI:</b> {viewCustomer.imei || '-'}</div>
            <div><b>Khách:</b> {viewCustomer.ten_khach_hang || '-'}</div>
            <div><b>ĐT:</b> {viewCustomer.so_dien_thoai || '-'}</div>
            <div><b>Địa chỉ bảo hành / CNC:</b> {viewCustomer.dia_chi_bao_hanh || '-'}</div>
          </div>
        ) : null}
        <DialogFooter>
          <Button onClick={() => setViewCustomer(null)}>Đóng</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  {/* Kết thúc UI chính */}
  </div>
  )
}
