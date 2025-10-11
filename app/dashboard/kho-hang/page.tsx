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
  tinh_trang: string;
  gia_nhap: number;
  gia_ban: number;
  trang_thai: string;
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
  // State lưu IMEI sản phẩm đang mở dialog
  const [dialogInfo, setDialogInfo] = useState<{data: ViewCustomer, pos: {x: number, y: number}} | null>(null)
  // State địa chỉ bảo hành chung cho dialog
  const BAOHANH_DEFAULT = { label: "Tâm Táo", value: "Tâm Táo (9A Đường số 6, KP5, Linh Tây, Thủ Đức)", desc: "9A Đường số 6, KP5, Linh Tây, Thủ Đức" };
  const [diaChiBaoHanh, setDiaChiBaoHanh] = useState(BAOHANH_DEFAULT.value)
  const [baoHanhAddresses, setBaoHanhAddresses] = useState([BAOHANH_DEFAULT])
  const [isAddingBaoHanhAddress, setIsAddingBaoHanhAddress] = useState(false)
  const [newBaoHanhAddress, setNewBaoHanhAddress] = useState("")
  // Chế độ chỉnh sửa tab CNC
  const [isEditCNCMode, setIsEditCNCMode] = useState(false)
  const [selectedCNCImeis, setselectedCNCImeis] = useState<string[]>([])
  const [confirmCNCAction, setConfirmCNCAction] = useState(false)
  // Dialog xem thông tin bảo hành
  const [viewCustomer, setViewCustomer] = useState<ViewCustomer | null>(null)
  // Xử lý khi khách ngoài đã nhận sản phẩm CNC
  function handleCustomerReceived(imei: string) {
    setIsLoading(true);
    fetch("/api/kho-hang/customer-received-cnc", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ imei, employeeId: "NV001" })
    })
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          alert("Đã cập nhật trạng thái: Khách đã nhận sản phẩm CNC!");
          fetchCNCProducts();
        } else {
          alert("Lỗi: " + data.error);
        }
      })
      .catch(e => alert("Lỗi: " + e.message))
      .finally(() => setIsLoading(false));
  }

  function handleSelectCNCProduct(imei: string) {
    setselectedCNCImeis(prev => prev.includes(imei) ? prev.filter(pid => pid !== imei) : [...prev, imei])
  }
  function handleSelectAllCNCProducts() {
    const imeis = filteredCNC.map(p => p.imei)
    if (selectedCNCImeis.length === imeis.length) {
      setselectedCNCImeis([])
    } else {
      setselectedCNCImeis(imeis)
    }
  }
  function handleCompleteCNC() {
    setConfirmCNCAction(true)
  }
  function handleConfirmCompleteCNC() {
    setConfirmCNCAction(false)
    setIsLoading(true)
    fetch("/api/kho-hang/complete-cnc", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ productIds: selectedCNCImeis, employeeId: "NV001" })
    })
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          alert("Đã hoàn thành CNC cho " + selectedCNCImeis.length + " sản phẩm")
          fetchCNCProducts()
        } else {
          alert("Lỗi: " + data.error)
        }
      })
      .finally(() => setIsLoading(false))
  }
  // ==========================
  // Render
  // ==========================
  // (Removed duplicate return and opening <div>)

  function handleCancelCompleteCNC() {
    setConfirmCNCAction(false)
  }
  // Dialog xác nhận thao tác
  const [confirmAction, setConfirmAction] = useState<null | "cnc" | "baohanh">(null)

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
  const [cncAddress, setCNCAddress] = useState(CNC_DEFAULT.value)
  const [cncAddresses, setCNCAddresses] = useState([CNC_DEFAULT])
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
  const [searchTerm, setSearchTerm] = useState("")
  const [cncSearch, setCncSearch] = useState("")
  const [baoHanhSearch, setBaoHanhSearch] = useState("")

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

    // Search text
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

    setFilteredProducts(filtered)
  }, [products, trangThai, sourceFilter, searchTerm])

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
  function getTrangThaiText(status: string) {
    return status || "-"
  }
  function handleSuccess() {
    // refetch products nếu cần
  }
  function handleSendCNC() {
    console.log("Send CNC:", selectedCNCProductId, cncAddress)
    setIsCNCDialogOpen(false)
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
              <div className="flex justify-between items-center gap-3">
                <div style={{ width: '10rem' }}>
                  <div className="hidden md:block">
                    <Select value={trangThai} onValueChange={setTrangThai}>
                      <SelectTrigger className="w-40 bg-white rounded-lg shadow border focus:ring-2 focus:ring-blue-200 transition-all">
                        <SelectValue placeholder="Trạng thái" />
                      </SelectTrigger>
                      <SelectContent className="bg-white rounded-lg shadow-lg">
                        <SelectItem value="all" className="hover:bg-blue-50">Tất cả</SelectItem>
                        <SelectItem value="Lock" className="hover:bg-blue-50">Máy Lock</SelectItem>
                        <SelectItem value="Qte" className="hover:bg-blue-50">Máy Quốc tế</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="hidden md:block">
                    <Input
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      placeholder="Tìm theo tên, IMEI, màu..."
                      className="w-56"
                    />
                  </div>
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

              {/* Mobile quick filters */}
              <div className="md:hidden mt-3 space-y-2">
                <div className="text-xs text-slate-500">Nguồn hàng</div>
                <div className="flex gap-2 overflow-x-auto">
                  {[
                    { key: "all", label: "Tất cả" },
                    { key: "kho", label: "Trong kho" },
                    { key: "doi_tac", label: "Đối tác" },
                  ].map(opt => (
                    <button
                      key={opt.key}
                      onClick={() => setSourceFilter(opt.key as any)}
                      className={`px-3 py-1 rounded-full text-sm border ${sourceFilter === opt.key ? "bg-blue-600 text-white border-blue-600" : "bg-white text-slate-700 border-slate-200"}`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
                <div className="text-xs text-slate-500 mt-2">Loại máy</div>
                <div className="flex gap-2 overflow-x-auto">
                  {[
                    { key: "all", label: "Tất cả" },
                    { key: "Lock", label: "Lock" },
                    { key: "Qte", label: "Quốc tế" },
                  ].map(opt => (
                    <button
                      key={opt.key}
                      onClick={() => setTrangThai(opt.key)}
                      className={`px-3 py-1 rounded-full text-sm border ${trangThai === opt.key ? "bg-blue-600 text-white border-blue-600" : "bg-white text-slate-700 border-slate-200"}`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
                <div>
                  <Input
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Tìm theo tên, IMEI, màu..."
                    className="w-full"
                  />
                </div>
              </div>

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
                          <div className="space-y-4">
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
                        </div>
                        <div className="flex gap-4 justify-end mt-8">
                          <Button variant="outline" onClick={handleCancelAction} className="rounded-lg px-6 py-2 border border-slate-300">Hủy</Button>
                          <Button onClick={() => {
                            setIsLoading(true)
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
                            fetch("/api/kho-hang/send-cnc", {
                              method: "POST",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ productIds, cncAddress: addressToSend, employeeId: "NV001", products: productPayload })
                            })
                              .then(res => res.json())
                              .then(data => {
                                if (data.success) {
                                  alert(data.message || `Đã gửi CNC cho ${productIds.length} sản phẩm!`)
                                  setConfirmAction(null)
                                  fetchProducts()
                                  fetchCNCProducts()
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
                          </div>
                        </div>
                        <div className="flex gap-4 justify-end mt-8">
                          <Button variant="outline" onClick={handleCancelAction} className="rounded-lg px-6 py-2 border border-slate-300">Hủy</Button>
                          <Button onClick={() => {
                            setIsLoading(true)
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
                            fetch("/api/kho-hang/return-baohanh", {
                              method: "POST",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ productIds, employeeId: "NV001", products: productPayload })
                            })
                              .then(res => res.json())
                              .then(data => {
                                if (data.success) {
                                  alert(data.message || `Đã trả bảo hành cho ${productIds.length} sản phẩm!`)
                                  setConfirmAction(null)
                                  fetchProducts()
                                  fetchBaoHanhHistory()
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
                          }} className="bg-blue-600 text-white rounded-lg px-6 py-2 font-semibold shadow hover:bg-blue-700 transition-all">Xác nhận</Button>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              )}

              <div className="border rounded-lg overflow-hidden shadow-sm mt-6">
                <div className="bg-slate-50 px-6 py-4 border-b">
                  <h3 className="font-semibold">Danh sách sản phẩm</h3>
                  <p className="text-sm">Hiển thị {filteredProducts.length} sản phẩm</p>
                </div>
                {isMobile ? (
                  <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {isLoading ? (
                      <div className="text-center text-slate-400 col-span-full py-6">Đang tải...</div>
                    ) : filteredProducts.length === 0 ? (
                      <div className="text-center text-slate-400 col-span-full py-6">Chưa có sản phẩm nào</div>
                    ) : (
                      filteredProducts.map((p) => (
                        <div
                          key={p.id}
                          className={`relative rounded-xl border border-slate-200 bg-white p-4 shadow-sm active:scale-[0.99] transition ${isEditMode ? "cursor-pointer" : ""}`}
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
                            <Badge className={getTrangThaiColor(p.trang_thai) + " rounded-full px-2 py-0.5 text-[10px] font-semibold"}>{getTrangThaiText(p.trang_thai)}</Badge>
                          </div>
                          <div className="mt-2 text-sm text-slate-700">
                            <div>IMEI: <span className="font-medium">{p.imei}</span></div>
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
                        <TableHead className="font-semibold">IMEI</TableHead>
                        <TableHead className="font-semibold">Pin</TableHead>
                        <TableHead className="font-semibold">Tình trạng</TableHead>
                        <TableHead className="font-semibold">Trạng thái</TableHead>
                        {isManager && <TableHead className="font-semibold">Giá nhập</TableHead>}
                        <TableHead className="font-semibold">Giá bán</TableHead>
                        <TableHead className="font-semibold">Ngày nhập</TableHead>
                        <TableHead className="font-semibold">Ghi chú</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {isLoading ? (
                        <TableRow><TableCell colSpan={(isManager ? (isEditMode ? 10 : 9) : (isEditMode ? 9 : 8))} className="text-center py-8 text-slate-400">Đang tải...</TableCell></TableRow>
                      ) : filteredProducts.length === 0 ? (
                        <TableRow><TableCell colSpan={(isManager ? (isEditMode ? 10 : 9) : (isEditMode ? 9 : 8))} className="text-center py-8 text-slate-400">Chưa có sản phẩm nào</TableCell></TableRow>
                      ) : (
                        filteredProducts.map((p, idx) => (
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
                            <TableCell className="text-sm text-slate-700">{p.imei}</TableCell>
                            <TableCell className="text-sm text-slate-700">{p.pin || "-"}</TableCell>
                            <TableCell className="text-sm text-slate-700">{p.tinh_trang}</TableCell>
                            <TableCell><Badge className={getTrangThaiColor(p.trang_thai) + " rounded-full px-3 py-1 text-xs font-semibold"}>{getTrangThaiText(p.trang_thai)}</Badge></TableCell>
                            {isManager && <TableCell className="text-sm text-blue-700 font-semibold">{p.gia_nhap?.toLocaleString("vi-VN")} VNĐ</TableCell>}
                            <TableCell className="text-sm text-green-700 font-semibold">{p.gia_ban?.toLocaleString("vi-VN")} VNĐ</TableCell>
                            <TableCell className="text-sm text-slate-700">{p.ngay_nhap}</TableCell>
                            <TableCell className="text-sm text-slate-700">{p.ghi_chu || "-"}</TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                )}
              </div>
            </CardContent>
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
                    onChange={(e) => setAccessorySearch(e.target.value)}
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
                        {filteredAccessories.map((a, idx) => (
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
                        filteredAccessories.map((a, idx) => (
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
                        onChange={(e) => setCncSearch(e.target.value)}
                        placeholder="Tìm theo tên, IMEI, nguồn, tình trạng..."
                      />
                    </div>
                  </div>
                </div>
                {/* Mobile search */}
                <div className="md:hidden px-4 py-3 bg-white border-b">
                  <Input
                    value={cncSearch}
                    onChange={(e) => setCncSearch(e.target.value)}
                    placeholder="Tìm theo tên, IMEI, nguồn, tình trạng..."
                    className="w-full"
                  />
                </div>
                {isMobile && filteredCNC.length === 0 ? (
                  <div className="p-8 flex flex-col items-center justify-center text-center text-slate-500">
                    <div className="text-3xl mb-2">🛠️</div>
                    <div className="font-medium">Chưa có sản phẩm nào Đang CNC</div>
                  </div>
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
                      filteredCNC.map((p, idx) => (
                        <TableRow key={`${p.id}-${p.imei}`} className={idx % 2 === 0 ? "bg-white" : "bg-slate-50"}>
                          {isEditCNCMode && (
                            <TableCell>
                              <input type="checkbox" checked={selectedCNCImeis.includes(p.imei)} onChange={() => handleSelectCNCProduct(p.imei)} />
                            </TableCell>
                          )}
                          <TableCell className="text-sm text-slate-800">{p.ten_san_pham}</TableCell>
                          <TableCell className="text-sm text-slate-700">{p.imei}</TableCell>
                          <TableCell className="text-sm text-slate-700">{p.nguon}</TableCell>
                          <TableCell className="text-sm text-slate-700">{p.tinh_trang}</TableCell>
                          <TableCell className="text-sm text-slate-700">{p.loai_may}</TableCell>
                          <TableCell><Badge className={getTrangThaiColor(p.trang_thai) + " rounded-full px-3 py-1 text-xs font-semibold"}>{getTrangThaiText(p.trang_thai)}</Badge></TableCell>
                          <TableCell className="text-sm text-slate-700">{p.ngay_gui}</TableCell>
                          <TableCell className="text-sm text-slate-700">{p.ngay_nhan_lai}</TableCell>
                          <TableCell>
                            <button
                              className="p-1 rounded hover:bg-blue-50 cursor-pointer"
                              title="Xem thông tin CNC"
                              onClick={e => {
                                const rect = (e.target as HTMLElement).getBoundingClientRect();
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
      {dialogInfo && (
        <div
          style={{
            position: 'fixed',
            left: dialogInfo.pos.x,
            top: dialogInfo.pos.y,
            zIndex: 9999,
            minWidth: '200px',
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
      )}
                </TableBody>
                </Table>
                )}
            </div>
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
              <div className="flex gap-3 justify-end mt-4">
                <Button variant="outline" onClick={() => setConfirmBaoHanhAction(false)}>Hủy</Button>
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
                      onChange={(e) => setBaoHanhSearch(e.target.value)}
                      placeholder="Tìm theo tên, IMEI, nguồn, lỗi..."
                    />
                  </div>
                </div>
              </div>
              {/* Mobile search */}
              <div className="md:hidden px-4 py-3 bg-white border-b">
                <Input
                  value={baoHanhSearch}
                  onChange={(e) => setBaoHanhSearch(e.target.value)}
                  placeholder="Tìm theo tên, IMEI, nguồn, lỗi..."
                  className="w-full"
                />
              </div>
              {isMobile && filteredBaoHanh.length === 0 ? (
                <div className="p-8 flex flex-col items-center justify-center text-center text-slate-500">
                  <div className="text-3xl mb-2">🧰</div>
                  <div className="font-medium">Không có sản phẩm bảo hành nào</div>
                </div>
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
                    filteredBaoHanh.map((p: any, idx: number) => {
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
                          <TableCell className="text-sm text-slate-700">{p["Nguồn"] || '-'}</TableCell>
                          <TableCell className="text-sm text-slate-700">{p["Tình trạng"] || '-'}</TableCell>
                          <TableCell className="text-sm text-slate-700">{p["Lỗi"] || '-'}</TableCell>
                          <TableCell><Badge className={getTrangThaiColor(p["Trạng Thái"] || '-') + " rounded-full px-3 py-1 text-xs font-semibold"}>{getTrangThaiText(p["Trạng Thái"] || '-')}</Badge></TableCell>
                          <TableCell className="text-sm text-slate-700">{p["Ngày gửi"] || '-'}</TableCell>
                          <TableCell className="text-sm text-slate-700">{p["Ngày nhận lại"] || '-'}</TableCell>
                          <TableCell>
                            <div className="flex items-center">
                              <button
                                className="p-1 rounded hover:bg-blue-50 cursor-pointer"
                                onClick={e => {
                                  const rect = (e.target as HTMLElement).getBoundingClientRect();
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
      {/* Dialog thông tin bảo hành dạng box nhỏ, fixed trên màn hình, chỉ hiển thị 1 lần */}
      {dialogInfo && (
        <div
          style={{
            position: 'fixed',
            left: dialogInfo.pos.x,
            top: dialogInfo.pos.y,
            zIndex: 9999,
            minWidth: '200px',
            background: 'white',
            border: '1px solid #e2e8f0',
            borderRadius: '12px',
            boxShadow: '0 4px 24px rgba(0,0,0,0.12)',
            padding: '16px',
            fontSize: '13px',
            color: '#334155',
          }}
        >
          <div style={{ fontWeight: 700, color: '#2563eb', marginBottom: 6 }}>Thông tin bảo hành</div>
          <div><b>Địa chỉ:</b> {dialogInfo.data.dia_chi_bao_hanh}</div>
          <div><b>Khách:</b> {dialogInfo.data.ten_khach_hang}</div>
          <div><b>ĐT:</b> {dialogInfo.data.so_dien_thoai}</div>
          <button onClick={() => setDialogInfo(null)} style={{ marginTop: 10, padding: '4px 12px', borderRadius: 6, background: '#eff6ff', color: '#2563eb', fontWeight: 600, fontSize: 12, border: 'none', cursor: 'pointer' }}>Đóng</button>
        </div>
      )}
                        </TableRow>
                      )
                    })
                  )}
                </TableBody>
              </Table>
              )}
            </div>
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
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
  {/* Kết thúc UI chính */}
  </div>
  )
}
