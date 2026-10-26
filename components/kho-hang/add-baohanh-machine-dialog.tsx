
import { useState, useEffect } from "react"
// Khai báo mở rộng window cho TypeScript
declare global {
  interface Window {
    baoHanhAddresses?: { label: string; value: string }[];
  }
}
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { useToast } from "@/hooks/use-toast"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useAuthMe } from "@/hooks/use-auth-me"
import { SearchableSelect } from "@/components/ui/searchable-select"
import { DEVICE_NAME_OPTIONS, getLoaiMayOptions } from "@/lib/constants/apple-devices"

interface AddBaoHanhMachineDialogProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

export default function AddBaoHanhMachineDialog({ isOpen, onClose, onSuccess }: AddBaoHanhMachineDialogProps) {
  const { me } = useAuthMe()
  const { toast } = useToast()

  // Dropdown tên sản phẩm
  const [productNames, setProductNames] = useState<string[]>([])
  // iPhone + iPad: form đã nhận Serial nên iPad bản Wi-Fi gửi bảo hành được.
  useEffect(() => {
    fetch("/api/kho-hang")
      .then(res => res.json())
      .then(data => {
        const names = Array.from(new Set((data.data || []).map((p: any) => p.ten_san_pham).filter(Boolean)))
        const allNames = [...DEVICE_NAME_OPTIONS].concat(
          (names as string[]).filter((n: string) => !DEVICE_NAME_OPTIONS.includes(n)),
        )
        setProductNames(allNames as string[])
      })
  }, [])

  const [tenSanPham, setTenSanPham] = useState("")
  const [imei, setImei] = useState("")
  const [serial, setSerial] = useState("")
  const [mauSac, setMauSac] = useState("")
  const [loaiMay, setLoaiMay] = useState("")
  const [tinhTrang, setTinhTrang] = useState("")
  const [tenKhachHang, setTenKhachHang] = useState("")
  const [soDienThoai, setSoDienThoai] = useState("")
  const [loi, setLoi] = useState("")
  const [diaChiBaoHanh, setDiaChiBaoHanh] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [isAddingBaoHanhAddress, setIsAddingBaoHanhAddress] = useState(false)
  const [newBaoHanhAddress, setNewBaoHanhAddress] = useState("")

  // Địa chỉ bảo hành mặc định
  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.baoHanhAddresses = window.baoHanhAddresses || [];
      const defaultAddress = 'Tâm Táo (9A Đường số 6, KP5, Linh Tây, Thủ Đức)';
      const qhStoreAddress = 'QH store (5 đường Năm Châu, phường 11, Tân Bình)';
      const exShopAddress = 'EX shop (95 Thành Mỹ, Phường 8, Tân Bình)';
      if (!window.baoHanhAddresses.some(a => a.value === defaultAddress)) {
        window.baoHanhAddresses.unshift({ label: defaultAddress, value: defaultAddress });
      }
      if (!window.baoHanhAddresses.some(a => a.value === qhStoreAddress)) {
        window.baoHanhAddresses.push({ label: qhStoreAddress, value: qhStoreAddress });
      }
      // Nếu chưa chọn thì chọn mặc định
      if (!diaChiBaoHanh) setDiaChiBaoHanh(defaultAddress);
    }
  }, [diaChiBaoHanh]);

  function handleAdd() {
    setIsLoading(true)
    fetch("/api/kho-hang/add-bao-hanh-machine", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ten_san_pham: tenSanPham,
        imei,
        serial,
        mau_sac: mauSac,
        loai_may: loaiMay,
        tinh_trang: tinhTrang,
        khach_hang: tenKhachHang,
        so_dien_thoai: soDienThoai,
        loi,
        dia_chi_bao_hanh: diaChiBaoHanh,
        ngay_gui: new Date().toLocaleTimeString("vi-VN") + " " + new Date().toLocaleDateString("vi-VN"),
        employeeId: me?.employeeId || "NV-UNKNOWN"
      })
    })
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          toast({ title: "Thành công", description: "Thêm máy bảo hành thành công!", variant: "success" as any })
          onSuccess()
          onClose()
        } else {
          toast({ title: "Lỗi", description: data.error || "Không thể thêm máy bảo hành", variant: "destructive" })
        }
      })
      .catch(e => toast({ title: "Lỗi", description: e.message, variant: "destructive" }))
      .finally(() => setIsLoading(false))
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-card rounded-xl shadow-xl p-6 sm:max-w-[600px] border border-border">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-blue-700 mb-2">Thêm máy bảo hành ngoài kho</DialogTitle>
          <p className="text-muted-foreground text-sm mb-4">Nhập thông tin máy bảo hành ngoài kho để quản lý và theo dõi trạng thái.</p>
        </DialogHeader>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="flex flex-col gap-2">
            <Label className="font-medium text-foreground">Tên Sản Phẩm</Label>
            <SearchableSelect
              value={tenSanPham}
              onValueChange={v => {
                setTenSanPham(v)
                // Đổi sang dòng máy khác -> Loại máy cũ có thể không còn hợp lệ
                // (vd đang "Lock" mà chuyển sang iPad).
                if (loaiMay && !getLoaiMayOptions(v).includes(loaiMay)) setLoaiMay("")
              }}
              options={productNames}
              placeholder="Chọn sản phẩm"
              searchPlaceholder="Gõ tên máy, vd: 15 pro max"
              emptyText="Không có máy nào khớp."
              className="h-9 bg-card font-medium"
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label className="font-medium text-foreground">IMEI / Serial</Label>
            <div className="flex gap-2">
              <Input
                value={imei}
                onChange={e => setImei(e.target.value.replace(/\D/g, "").slice(0, 15))}
                placeholder="IMEI (15 số)"
                className="px-3 py-1.5 border rounded-md text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
              <Input
                value={serial}
                onChange={e => {
                  const v = e.target.value.toUpperCase()
                  if (/^[A-Z0-9-]*$/.test(v) && v.length <= 30) setSerial(v)
                }}
                placeholder="Serial"
                className="px-3 py-1.5 border rounded-md text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
            </div>
            <p className="text-xs text-muted-foreground">Điền một trong hai — iPad bản Wi-Fi chỉ có Serial.</p>
          </div>
          <div className="flex flex-col gap-2">
            <Label className="font-medium text-foreground">Màu Sắc</Label>
            <Input value={mauSac} onChange={e => setMauSac(e.target.value)} placeholder="Nhập màu sắc" className="px-3 py-1.5 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
          </div>
          <div className="flex flex-col gap-2">
            <Label className="font-medium text-foreground">Loại máy</Label>
            <Select value={loaiMay} onValueChange={v => setLoaiMay(v)}>
              <SelectTrigger className="px-3 py-1.5 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 bg-card text-foreground font-medium">
                <SelectValue placeholder="Chọn loại máy" />
              </SelectTrigger>
              <SelectContent className="bg-card border border-border shadow-lg text-foreground">
                {getLoaiMayOptions(tenSanPham).map(item => (
                  <SelectItem key={item} value={item}>{item}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-2">
            <Label className="font-medium text-foreground">Tình trạng</Label>
            <Input value={tinhTrang} onChange={e => setTinhTrang(e.target.value)} placeholder="Nhập tình trạng máy" className="px-3 py-1.5 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
          </div>
          <div className="flex flex-col gap-2">
            <Label className="font-medium text-foreground">Lỗi sản phẩm</Label>
            <Input value={loi} onChange={e => setLoi(e.target.value)} placeholder="Nhập lỗi sản phẩm" className="px-3 py-1.5 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
          </div>
          <div className="flex flex-col gap-2">
            <Label className="font-medium text-foreground">Địa chỉ bảo hành</Label>
            <Select value={diaChiBaoHanh} onValueChange={val => {
              if (val === "__add__") {
                setIsAddingBaoHanhAddress(true)
              } else {
                setDiaChiBaoHanh(val)
              }
            }}>
              <SelectTrigger className="px-3 py-1.5 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 bg-card text-foreground font-medium">
                <SelectValue placeholder="Chọn địa chỉ bảo hành" />
              </SelectTrigger>
              <SelectContent className="bg-card border border-border shadow-lg text-foreground">
                {typeof window !== 'undefined' && window.baoHanhAddresses && window.baoHanhAddresses.map((a: any) => (
                  <SelectItem key={a.value} value={a.value}>{a.label || a.value}</SelectItem>
                ))}
                <SelectItem value="__add__" className="text-blue-600">+ Thêm địa chỉ mới...</SelectItem>
              </SelectContent>
            </Select>
            {isAddingBaoHanhAddress && (
              <div className="mt-2">
                <Input
                  value={newBaoHanhAddress}
                  onChange={e => setNewBaoHanhAddress(e.target.value)}
                  placeholder="Nhập địa chỉ bảo hành mới..."
                  className="px-3 py-1.5 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                />
                <div className="flex gap-2 mt-2">
                  <Button size="sm" onClick={() => {
                    if (newBaoHanhAddress.trim()) {
                      if (typeof window !== 'undefined') {
                        window.baoHanhAddresses = window.baoHanhAddresses || [];
                        window.baoHanhAddresses.push({ label: newBaoHanhAddress, value: newBaoHanhAddress });
                      }
                      setDiaChiBaoHanh(newBaoHanhAddress);
                      setNewBaoHanhAddress("");
                      setIsAddingBaoHanhAddress(false);
                    }
                  }} className="bg-blue-600 text-white">Lưu</Button>
                  <Button size="sm" variant="outline" onClick={() => {
                    setIsAddingBaoHanhAddress(false);
                    setNewBaoHanhAddress("");
                  }}>Hủy</Button>
                </div>
              </div>
            )}
          </div>
          {/* Hàng cuối: Tên khách hàng và Số điện thoại khách hàng */}
          <div className="flex flex-col gap-2 md:col-span-2">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <Label className="font-medium text-foreground">Tên khách hàng</Label>
                <Input value={tenKhachHang} onChange={e => setTenKhachHang(e.target.value)} placeholder="Nhập tên khách hàng" className="px-3 py-1.5 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
              </div>
              <div className="flex flex-col gap-2">
                <Label className="font-medium text-foreground">Số điện thoại khách hàng</Label>
                <Input value={soDienThoai} onChange={e => setSoDienThoai(e.target.value)} placeholder="Nhập số điện thoại" className="px-3 py-1.5 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
              </div>
            </div>
          </div>
        </div>
        <DialogFooter className="mt-6 flex gap-3 justify-end">
          <Button onClick={onClose} variant="outline" className="rounded-lg px-5">Hủy</Button>
          <Button onClick={handleAdd} disabled={isLoading || !tenSanPham || !(imei || serial) || !loaiMay || !tinhTrang || !loi || !diaChiBaoHanh || !tenKhachHang || !soDienThoai} className="bg-blue-600 text-white font-semibold rounded-lg px-5 shadow hover:bg-blue-700">Thêm máy bảo hành</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
