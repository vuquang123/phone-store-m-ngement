
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
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

interface AddBaoHanhMachineDialogProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

export default function AddBaoHanhMachineDialog({ isOpen, onClose, onSuccess }: AddBaoHanhMachineDialogProps) {

  // Dropdown tên sản phẩm
  const [productNames, setProductNames] = useState<string[]>([])
  const defaultIphoneNames = [
    "iPhone 17", "iPhone 17 Pro Max", "iPhone 17 Pro", "iPhone 17 Plus",
    "iPhone 16 Pro Max", "iPhone 16 Pro", "iPhone 16 Plus", "iPhone 16",
    "iPhone 15 Pro Max", "iPhone 15 Pro", "iPhone 15 Plus", "iPhone 15",
    "iPhone 14 Pro Max", "iPhone 14 Pro", "iPhone 14 Plus", "iPhone 14",
    "iPhone 13 Pro Max", "iPhone 13 Pro", "iPhone 13 Mini", "iPhone 13",
    "iPhone 12 Pro Max", "iPhone 12 Pro", "iPhone 12",
    "iPhone 11 Pro Max", "iPhone 11 Pro", "iPhone 11"
  ];
  useEffect(() => {
    fetch("/api/kho-hang")
      .then(res => res.json())
      .then(data => {
        const names = Array.from(new Set((data.data || []).map((p: any) => p.ten_san_pham).filter(Boolean)))
        const allNames = defaultIphoneNames.concat((names as string[]).filter((n: string) => !defaultIphoneNames.includes(n)))
        setProductNames(allNames as string[])
      })
  }, [])

  const [tenSanPham, setTenSanPham] = useState("")
  const [imei, setImei] = useState("")
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
      if (!window.baoHanhAddresses.some(a => a.value === defaultAddress)) {
        window.baoHanhAddresses.unshift({ label: defaultAddress, value: defaultAddress });
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
        loai_may: loaiMay,
        tinh_trang: tinhTrang,
        khach_hang: tenKhachHang,
        so_dien_thoai: soDienThoai,
        loi,
        dia_chi_bao_hanh: diaChiBaoHanh,
        ngay_gui: new Date().toLocaleTimeString("vi-VN") + " " + new Date().toLocaleDateString("vi-VN"),
        employeeId: "NV001"
      })
    })
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          alert("Thêm máy bảo hành thành công!")
          onSuccess()
          onClose()
        } else {
          alert("Lỗi: " + (data.error || ""))
        }
      })
      .catch(e => alert("Lỗi: " + e.message))
      .finally(() => setIsLoading(false))
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-white rounded-xl shadow-xl p-6 min-w-[350px] max-w-[600px] border border-slate-200">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-blue-700 mb-2">Thêm máy bảo hành ngoài kho</DialogTitle>
          <p className="text-slate-500 text-sm mb-4">Nhập thông tin máy bảo hành ngoài kho để quản lý và theo dõi trạng thái.</p>
        </DialogHeader>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="flex flex-col gap-2">
            <Label className="font-medium text-slate-700">Tên Sản Phẩm</Label>
            <Select value={tenSanPham} onValueChange={v => setTenSanPham(v)}>
              <SelectTrigger className="px-3 py-1.5 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white text-slate-800 font-medium">
                <SelectValue placeholder="Chọn sản phẩm" />
              </SelectTrigger>
              <SelectContent className="bg-white border border-slate-200 shadow-lg text-slate-800">
                {productNames.map(name => (
                  <SelectItem key={name} value={name}>{name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-2">
            <Label className="font-medium text-slate-700">IMEI</Label>
            <Input value={imei} onChange={e => setImei(e.target.value)} required placeholder="Nhập IMEI" className="px-3 py-1.5 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
          </div>
          <div className="flex flex-col gap-2">
            <Label className="font-medium text-slate-700">Loại máy</Label>
            <Select value={loaiMay} onValueChange={v => setLoaiMay(v)}>
              <SelectTrigger className="px-3 py-1.5 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white text-slate-800 font-medium">
                <SelectValue placeholder="Chọn loại máy" />
              </SelectTrigger>
              <SelectContent className="bg-white border border-slate-200 shadow-lg text-slate-800">
                <SelectItem value="Lock">Lock</SelectItem>
                <SelectItem value="Qte">Qte</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-2">
            <Label className="font-medium text-slate-700">Tình trạng</Label>
            <Input value={tinhTrang} onChange={e => setTinhTrang(e.target.value)} placeholder="Nhập tình trạng máy" className="px-3 py-1.5 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
          </div>
          <div className="flex flex-col gap-2">
            <Label className="font-medium text-slate-700">Lỗi sản phẩm</Label>
            <Input value={loi} onChange={e => setLoi(e.target.value)} placeholder="Nhập lỗi sản phẩm" className="px-3 py-1.5 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
          </div>
          <div className="flex flex-col gap-2">
            <Label className="font-medium text-slate-700">Địa chỉ bảo hành</Label>
            <Select value={diaChiBaoHanh} onValueChange={val => {
              if (val === "__add__") {
                setIsAddingBaoHanhAddress(true)
              } else {
                setDiaChiBaoHanh(val)
              }
            }}>
              <SelectTrigger className="px-3 py-1.5 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white text-slate-800 font-medium">
                <SelectValue placeholder="Chọn địa chỉ bảo hành" />
              </SelectTrigger>
              <SelectContent className="bg-white border border-slate-200 shadow-lg text-slate-800">
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
                <Label className="font-medium text-slate-700">Tên khách hàng</Label>
                <Input value={tenKhachHang} onChange={e => setTenKhachHang(e.target.value)} placeholder="Nhập tên khách hàng" className="px-3 py-1.5 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
              </div>
              <div className="flex flex-col gap-2">
                <Label className="font-medium text-slate-700">Số điện thoại khách hàng</Label>
                <Input value={soDienThoai} onChange={e => setSoDienThoai(e.target.value)} placeholder="Nhập số điện thoại" className="px-3 py-1.5 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
              </div>
            </div>
          </div>
        </div>
        <DialogFooter className="mt-6 flex gap-3 justify-end">
          <Button onClick={onClose} variant="outline" className="rounded-lg px-5">Hủy</Button>
          <Button onClick={handleAdd} disabled={isLoading || !tenSanPham || !imei || !loaiMay || !tinhTrang || !loi || !diaChiBaoHanh || !tenKhachHang || !soDienThoai} className="bg-blue-600 text-white font-semibold rounded-lg px-5 shadow hover:bg-blue-700">Thêm máy bảo hành</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
