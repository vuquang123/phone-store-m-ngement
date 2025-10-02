"use client"

import { useState, useEffect } from "react"
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
import { Search, Plus, Minus, Trash2, User, ShoppingCart, Loader2, CreditCard } from "lucide-react"
import dayjs from "dayjs"
import customParseFormat from "dayjs/plugin/customParseFormat"
dayjs.extend(customParseFormat)

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

interface Customer {
  id: string
  ho_ten: string
  so_dien_thoai: string
}

export default function BanHangPage() {
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
  const [activeTab, setActiveTab] = useState("ban-hang")
  const [reloadFlag, setReloadFlag] = useState(0)
  // Fetch đơn đặt cọc từ API khi vào tab hoặc khi tạo mới
  useEffect(() => {
    if (activeTab !== "don-dat-coc") return;
    const fetchDepositOrders = async () => {
      try {
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
  const [isLoading, setIsLoading] = useState(false)
  const [isCustomerDialogOpen, setIsCustomerDialogOpen] = useState(false)
  const [isCustomerSelectOpen, setIsCustomerSelectOpen] = useState(false)
  const [orders, setOrders] = useState<any[]>([])
  const [customerSearch, setCustomerSearch] = useState("")
  const [customerResults, setCustomerResults] = useState<any[]>([])
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
 

  // === SEARCH SẢN PHẨM ===
  useEffect(() => {
    const searchProducts = async () => {
      if (searchQuery.length < 2) {
        // Khi không có từ khóa, lấy cả sản phẩm và phụ kiện
        try {
          const [resKho, resPhuKien] = await Promise.all([
            fetch('/api/kho-hang'),
            fetch('/api/phu-kien'),
          ])
          let products: any[] = []
          let accessories: any[] = []
          if (resKho.ok) {
            const data = await resKho.json()
            products = Array.isArray(data) ? data : data.data || []
            products = products.filter((p: any) => p.trang_thai === "Còn hàng")
          }
          if (resPhuKien.ok) {
            const data = await resPhuKien.json()
            accessories = Array.isArray(data) ? data : data.data || []
            accessories = accessories.filter((a: any) => Number(a.so_luong_ton) > 0)
            accessories = accessories.map((a: any) => {
              let price = 0;
              if (typeof a.gia_ban === "string") {
                // Loại bỏ ký tự không phải số, chuyển thành số
                const cleaned = a.gia_ban.replace(/[^\d]/g, "");
                price = cleaned ? parseInt(cleaned, 10) : 0;
              } else if (typeof a.gia_ban === "number") {
                price = a.gia_ban;
              }
              return {
                ...a,
                type: "accessory",
                ten_san_pham: a.ten_san_pham || a.ten_phu_kien || "",
                gia_ban: price,
              };
            })
          }
          setSearchResults([...products, ...accessories])
        } catch (error) {
          setSearchResults([])
        }
        return
      }
      try {
        const response = await fetch(`/api/search-products?search=${encodeURIComponent(searchQuery)}`)
        let results = []
        if (response.ok) {
          results = await response.json()
        }

        // Filter kho hàng products by searchQuery
        const filteredKho = khoHangProducts.filter((item) => {
          const q = searchQuery.toLowerCase()
          return (
            item.ten_san_pham?.toLowerCase().includes(q) ||
            item.imei?.toLowerCase().includes(q) ||
            (item.loai_phu_kien?.toLowerCase().includes(q) ?? false)
          )
        })

        // Merge và đảm bảo mọi sản phẩm máy đều có type: 'product'
        const allProducts = [...results, ...filteredKho].reduce((acc: any[], item: any) => {
          if (!acc.some((p: any) => p.id === item.id)) {
            // Nếu là sản phẩm máy mà chưa có type, gán type: 'product'
            if (!item.type && item.imei) item.type = "product";
            acc.push(item)
          }
          return acc
        }, [])
        setSearchResults(allProducts)
      } catch (error) {
        console.error("Error searching products:", error)
      }
    }
    const debounce = setTimeout(searchProducts, 300)
    return () => clearTimeout(debounce)
  }, [searchQuery, khoHangProducts, reloadFlag])

  // Fetch kho hàng products once on mount
  useEffect(() => {
    const fetchKhoHang = async () => {
      try {
        const res = await fetch('/api/kho-hang')
        if (res.ok) {
          const data = await res.json()
          const products = Array.isArray(data) ? data : data.data || []
          // Chỉ lấy sản phẩm có trạng thái "Còn hàng"
          setKhoHangProducts(
            products
              .filter((p: any) => p.trang_thai === "Còn hàng")
              .map((p: any) => ({
                ...p,
                id: p["ID Máy"] || p.id_may || p.id,
                type: "product",
                gia_nhap: p.gia_nhap ?? p["Giá Nhập"] ?? "", // Map thêm trường giá nhập
                "Tên Sản Phẩm": p.ten_san_pham,
                "Loại Máy": p.loai_may,
                "Dung Lượng": p.dung_luong,
                "IMEI": p.imei,
                "Màu Sắc": p.mau_sac,
                "Pin (%)": p.pin,
                "Tình Trạng Máy": p.tinh_trang_may
              }))
          )
        }
      } catch (e) {
        setKhoHangProducts([])
      }
    }
    fetchKhoHang()
  }, [])

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
  const thanhToan = tongTien - giamGia

  const handleCheckout = async () => {
    if (cart.length === 0) {
      alert("Giỏ hàng trống")
      return
    }
    if (thanhToan < 0) {
      alert("Giảm giá không hợp lệ")
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
          const resStatus = await fetch("/api/update-product-status", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ productIds: products.map(p => p.imei), newStatus: "Đã bán" })
          });
          if (!resStatus.ok) throw new Error("API update-product-status lỗi: " + (await resStatus.text()));
        } catch (err) {
          alert("Lỗi cập nhật trạng thái sản phẩm: " + err);
          setIsLoading(false); return;
        }
        // Chỉ xóa sản phẩm khỏi kho nếu có sản phẩm có imei
        const imeiList = products.map(p => p.imei).filter(Boolean);
        if (imeiList.length > 0) {
          try {
            const resDel = await fetch("/api/delete-product-from-kho", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ productIds: imeiList })
            });
            if (!resDel.ok) throw new Error("API delete-product-from-kho lỗi: " + (await resDel.text()));
          } catch (err) {
            alert("Lỗi xóa sản phẩm khỏi kho: " + err);
            setIsLoading(false); return;
          }
        }
        // Ghi thông tin vào sheet Ban_Hang
        let orderData: any = {
          "Ngày Xuất": new Date().toLocaleDateString("vi-VN"),
          "Tên Khách Hàng": selectedCustomer?.ho_ten || "Khách lẻ",
          "Số Điện Thoại": selectedCustomer?.so_dien_thoai || "",
          "Phụ Kiện": accessories.length ? accessories.map(pk => pk.ten_san_pham).join(", ") : "",
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
            so_luong: p.so_luong
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
            body: JSON.stringify(orderData)
          });
          if (!res.ok) throw new Error("API ban-hang lỗi: " + (await res.text()));
          const order = await res.json();
          setCart([]);
          setSelectedCustomer(null);
          setGiamGia(0);
          setGhiChu("");
          setPhuongThucThanhToan("Tiền mặt");
          alert(`Đơn hàng ${order.ma_don_hang} đã tạo thành công!`);
          setReloadFlag(f => f + 1); // <--- thêm dòng này
        } catch (err) {
          alert("Lỗi tạo đơn hàng: " + err);
        }
      }
    } catch (e: any) {
      alert("Lỗi: " + e.message)
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
      <div className="space-y-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="sticky top-0 z-10 bg-white shadow-sm">
            <TabsTrigger value="ban-hang">Bán hàng</TabsTrigger>
            <TabsTrigger value="don-dat-coc">Đơn đặt cọc</TabsTrigger>
          </TabsList>

          {/* Tab bán hàng */}
          <TabsContent value="ban-hang">
            <TabsContent value="ban-hang">
  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch">
    {/* Tìm kiếm và thêm sản phẩm */}
    <div className="lg:col-span-2 flex flex-col gap-6 h-full">
      <Card className="min-h-[220px] h-full flex flex-col" >
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
            />
          </div>

          {searchResults.length > 0 && (
            <div className="mt-4 space-y-2 max-h-60 overflow-y-auto rounded-lg border mb-4 pb-4">
              {searchResults.map((product: any) => {
                const isDisabled = product.trang_thai === "Đã đặt cọc" || product.trang_thai === "Đã bán";
                return (
                  <div
                    key={`${product.id || product.imei || product.ten_san_pham}`}
                    className={`flex items-center justify-between p-3 transition rounded-md ${isDisabled ? 'bg-gray-100 cursor-not-allowed opacity-60' : 'hover:bg-muted/50 cursor-pointer'}`}
                    onClick={() => !isDisabled && addToCart(product)}
                  >
                    <div>
                      <p className="font-medium">
                        {product.ten_san_pham || "[Chưa có tên sản phẩm]"}
                        {product.dung_luong ? ` - ${product.dung_luong}` : ""}
                        {product.mau_sac ? ` - ${product.mau_sac}` : ""}
                      </p>
                      {product.loai_may && (
                        <p className="text-sm text-muted-foreground">Loại máy: {product.loai_may}</p>
                      )}
                      <p className="text-sm text-muted-foreground">
                        {product.imei
                          ? `IMEI: ${product.imei}`
                          : product.type === "accessory"
                            ? Number(product.so_luong_ton) === 0
                              ? <span className="text-red-600">Hết hàng</span>
                              : `Tồn kho: ${product.so_luong_ton}`
                            : typeof product.so_luong_ton === "number"
                              ? product.so_luong_ton === 0
                                ? <span className="text-red-600">Hết hàng</span>
                                : `Tồn kho: ${product.so_luong_ton}`
                              : typeof product.so_luong === "number"
                                ? product.so_luong === 0
                                  ? <span className="text-red-600">Hết hàng</span>
                                  : `Tồn kho: ${product.so_luong}`
                                : ""}
                      </p>
                      {product.trang_thai === "Đã đặt cọc" && (
                        <p className="text-xs text-orange-600 font-semibold">Đã đặt cọc</p>
                      )}
                      {product.trang_thai === "Đã bán" && (
                        <p className="text-xs text-red-600 font-semibold">Đã bán</p>
                      )}
                      {/* Hiển thị trường Loại cho cả sản phẩm và phụ kiện nếu có */}
                      {product.loai_phu_kien && (
                        <p className="text-sm text-blue-600 font-semibold">Loại: {product.loai_phu_kien}</p>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="font-semibold">
                        {typeof product.gia_ban === "number" && product.gia_ban > 0
                          ? `₫${product.gia_ban.toLocaleString()}`
                          : <span className="text-red-600">Liên hệ</span>}
                      </p>
                      <Badge variant="outline">
                        {product.imei ? "iPhone" : "Phụ kiện"}
                      </Badge>
                    </div>
                  </div>
                );
              })}
              {/* div trống để tạo khoảng cách cuối cùng, tránh chữ bị đè lên viền */}
              <div className="h-6" />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Giỏ hàng */}
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
              <div className="grid grid-cols-5 gap-2 font-semibold text-slate-700 mb-2">
                <span>Tên SP</span>
                <span>IMEI</span>
                <span>Giá</span>
                <span>Trạng thái</span>
                <span></span>
              </div>
              {cart.map((item: CartItem) => (
                <div
                  key={`${item.type}-${item.id}`}
                  className="grid grid-cols-5 gap-2 items-center border rounded-lg p-2"
                >
                  <div>
                    <p className="font-medium">{item.ten_san_pham}</p>
                  </div>
                  <div className="font-mono text-xs">{item.imei || "-"}</div>
                  <div className="font-semibold">
                    ₫{(typeof item.gia_ban === "number" ? item.gia_ban : 0).toLocaleString()}
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
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8 bg-transparent"
                      onClick={() =>
                        updateQuantity(item.id, item.type, item.so_luong - 1)
                      }
                    >
                      <Minus className="h-4 w-4" />
                    </Button>
                    <span className="w-8 text-center">{item.so_luong}</span>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8 bg-transparent"
                      onClick={() =>
                        updateQuantity(item.id, item.type, item.so_luong + 1)
                      }
                      disabled={item.so_luong >= (item.max_quantity || 1)}
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive"
                      onClick={() => removeFromCart(item.id, item.type)}
                    >
                      <Trash2 className="h-4 w-4" />
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
    </div>

    {/* Thông tin đơn hàng */}
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

          <div className="space-y-2">
            <Input
              type="text"
              min={0}
              value={giamGia ? `${Math.round(giamGia).toLocaleString('vi-VN')}đ` : ''}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                // Chỉ lấy số, bỏ ký tự khác
                const raw = e.target.value.replace(/[^\d]/g, "");
                setGiamGia(raw ? Number(raw) : 0);
              }}
              placeholder="Nhập số tiền giảm giá"
            />
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
            <div className="flex justify-between">
              <span>Tổng tiền:</span>
              <span>₫{tongTien.toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span>Giảm giá:</span>
              <span>-₫{giamGia.toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-lg font-semibold mb-2">
              <span>Thanh toán:</span>
              <span>₫{thanhToan.toLocaleString()}</span>
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

          <Button
            className="w-full bg-blue-600 text-white hover:bg-blue-700"
            onClick={handleCheckout}
            disabled={isLoading || cart.length === 0}
          >
            {isLoading ? "Đang xử lý..." : "Thanh toán"}
          </Button>
        </CardContent>
      </Card>
    </div>
  </div>
</TabsContent>

          </TabsContent>

          {/* Tab đặt cọc */}
          <TabsContent value="don-dat-coc">
            <Card>
              <CardHeader>
                <CardTitle>Đơn đặt cọc</CardTitle>
                <CardDescription>Chỉ hiển thị đơn đặt cọc</CardDescription>
              </CardHeader>
              <CardContent>
                {/* Gộp các đơn có cùng mã đơn hàng */}
                {(() => {
                  // Gộp theo mã đơn hàng
                  const grouped = Object.values(
                    depositOrders.reduce((acc: any, order: any) => {
                      const maDon = order["Mã Đơn Hàng"] || order["ID Đơn Hàng"] || order["ma_don_hang"];
                      if (!maDon) return acc;
                      if (!acc[maDon]) {
                        acc[maDon] = { ...order };
                        acc[maDon]._products = [];
                        acc[maDon]._tien_coc_arr = [];
                        acc[maDon]._con_lai_arr = [];
                      }
                      // Lưu từng giá trị cọc và còn lại để tính tổng đúng
                      const giaBan = typeof order["Giá Bán"] === "string" ? parseInt(order["Giá Bán"].replace(/[^\d]/g, "")) || 0 : order["Giá Bán"] || 0;
                      const tienCoc = typeof order["Số Tiền Cọc"] === "string" ? parseInt(order["Số Tiền Cọc"].replace(/[^\d]/g, "")) || 0 : order["Số Tiền Cọc"] || 0;
                      const conLai = typeof order["Số Tiền Còn Lại"] === "string" ? parseInt(order["Số Tiền Còn Lại"].replace(/[^\d]/g, "")) || 0 : order["Số Tiền Còn Lại"] || (giaBan - tienCoc);
                      // Chỉ lưu giá trị cọc và còn lại nếu khác 0
                      if (tienCoc) acc[maDon]._tien_coc_arr.push(tienCoc);
                      if (conLai) acc[maDon]._con_lai_arr.push(conLai);
                      acc[maDon]._products.push(order["Tên Sản Phẩm"] || order["ten_san_pham"]);
                      return acc;
                    }, {})
                  );
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
                          {grouped.length === 0 ? (
                            <tr><td colSpan={8} className="text-center py-6">Không có đơn đặt cọc</td></tr>
                          ) : (
                            grouped.map((order: any, idx: number) => {
                              const now = dayjs();
                              const hanRaw = order["Hạn Thanh Toán"];
                              const han = hanRaw ? dayjs(hanRaw, "YYYY-MM-DD") : null;
                              const ngayDatCocRaw = order["Ngày Đặt Cọc"];
                              const ngayDatCoc = ngayDatCocRaw ? dayjs(ngayDatCocRaw, "DD/MM/YYYY") : null;
                              const isOverdue = han && han.isValid() && han.isBefore(now) && order._tong_con_lai > 0;
                              const isPaid = order._tong_con_lai <= 0;
                              const key = order["Mã Đơn Hàng"] || order["ID Đơn Hàng"] || idx;
                              // Hàm xử lý chuyển thông tin sang tab Bán hàng
                              const handleThanhToanTiep = () => {
                                // Tìm tất cả sản phẩm có cùng mã đơn hàng
                                const maDon = order["Mã Đơn Hàng"] || order["ID Đơn Hàng"] || order["ma_don_hang"];
                                const allRows = depositOrders.filter((o: any) => {
                                  const m = o["Mã Đơn Hàng"] || o["ID Đơn Hàng"] || o["ma_don_hang"];
                                  return m === maDon;
                                });
                                // Tạo mảng sản phẩm cho giỏ hàng
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
                                  <td className="align-middle text-left px-3 py-2 font-semibold">{order["Mã Đơn Hàng"] || order["ID Đơn Hàng"] || order["ma_don_hang"]}</td>
                                  <td className="align-middle text-left px-3 py-2">
                                    <div className="font-semibold text-slate-800">{order["Tên Khách Hàng"] || order["ten_khach_hang"] || "-"}</div>
                                    <div className="text-xs text-muted-foreground">{order["Số Điện Thoại"] || order["so_dien_thoai"] || "-"}</div>
                                  </td>
                                  <td className="align-middle text-left px-3 py-2">{order._products.join(", ")}</td>
                                  <td className="align-middle text-left px-3 py-2 font-semibold text-blue-700">₫{(order._tien_coc_arr[0]||0).toLocaleString()}</td>
                                  <td className="align-middle text-left px-3 py-2 font-semibold text-green-700">₫{(order._con_lai_arr[0]||0).toLocaleString()}</td>
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
                                          onClick={async () => {
                                            // Tìm tất cả sản phẩm có cùng mã đơn hàng
                                            const maDon = order["Mã Đơn Hàng"] || order["ID Đơn Hàng"] || order["ma_don_hang"];
                                            const allRows = depositOrders.filter((o: any) => {
                                              const m = o["Mã Đơn Hàng"] || o["ID Đơn Hàng"] || o["ma_don_hang"];
                                              return m === maDon;
                                            });
                                            // Lấy danh sách imei sản phẩm
                                            const imeis = allRows.map((o: any) => o["IMEI"] || o["imei"]).filter(Boolean);
                                            // Gọi API cập nhật trạng thái sản phẩm về 'Còn hàng'
                                            await fetch("/api/update-product-status", {
                                              method: "POST",
                                              headers: { "Content-Type": "application/json" },
                                              body: JSON.stringify({ productIds: imeis, newStatus: "Còn hàng" })
                                            });
                                            // Gọi API thêm lại sản phẩm vào sheet Kho_Hang
                                            await fetch("/api/kho-hang", {
                                              method: "POST",
                                              headers: { "Content-Type": "application/json" },
                                              body: JSON.stringify({ products: allRows })
                                            });
                                            // Gọi API xóa sản phẩm khỏi sheet Dat_Coc
                                            await fetch("/api/dat-coc", {
                                              method: "DELETE",
                                              headers: { "Content-Type": "application/json" },
                                              body: JSON.stringify({ productIds: imeis })
                                            });
                                            alert("Đã hủy đặt cọc. Sản phẩm đã được trả về kho và xóa khỏi sheet Đặt Cọc.");
                                            window.location.reload();
                                          }}
                                        >
                                          Hủy đặt cọc
                                        </Button>
                                      )}
                                      {isPaid && (
                                        <Button size="sm" variant="default">Chuyển sang đơn bán</Button>
                                      )}
                                    </div>
                                  </td>
                                </tr>
                              );
                            })
                          )}
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
    </ProtectedRoute>
  )
}
