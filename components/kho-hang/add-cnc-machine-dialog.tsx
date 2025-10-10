import { useState, useEffect } from "react"

// Khai báo mở rộng window cho TypeScript
declare global {
  interface Window {
    cncAddresses?: { label: string; value: string }[];
  }
}
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { useToast } from "@/hooks/use-toast"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export default function AddCNCMachineDialog({ isOpen, onClose, onSuccess }: { isOpen: boolean, onClose: () => void, onSuccess: () => void }) {
  const [form, setForm] = useState({
    ten_san_pham: "",
    imei: "",
    nguon: "Khách ngoài",
    tinh_trang: "",
    loai_may: "Lock",
    trang_thai: "Đang CNC",
    dia_chi_cnc: "",
    ngay_gui: new Date().toLocaleTimeString("vi-VN") + " " + new Date().toLocaleDateString("vi-VN"),
    ngay_nhan_lai: "",
    khach_hang: "",
    so_dien_thoai: "",
    employeeId: "NV001"
  })

  // Thêm state cho địa chỉ CNC
  const [isAddingCNCAddress, setIsAddingCNCAddress] = useState(false)
  const [newCNCAddress, setNewCNCAddress] = useState("")

  // Địa chỉ CNC mặc định
  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.cncAddresses = window.cncAddresses || [];
      const defaultAddress = 'Tâm Táo (9A Đường số 6, KP5, Linh Tây, Thủ Đức)';
      if (!window.cncAddresses.some(a => a.value === defaultAddress)) {
        window.cncAddresses.unshift({ label: defaultAddress, value: defaultAddress });
      }
    }
  }, []);

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
        // Luôn giữ danh sách mặc định, không bị ghi đè bởi kho hàng
  const allNames = defaultIphoneNames.concat((names as string[]).filter((n: string) => !defaultIphoneNames.includes(n)))
        setProductNames(allNames as string[])
      })
  }, [])
  const [isLoading, setIsLoading] = useState(false)
  const { toast } = useToast()

  function handleChange(e: any) {
    setForm({ ...form, [e.target.name]: e.target.value })
  }

  async function handleSubmit() {
    setIsLoading(true)
    const res = await fetch("/api/kho-hang/add-cnc-machine", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form)
    })
    const data = await res.json()
    setIsLoading(false)
    if (data.success) {
      toast({ title: "Thành công", description: data.message || "Đã thêm máy CNC", variant: "success" as any })
      if (typeof onSuccess === "function") {
        onSuccess(); // reload danh sách sản phẩm CNC
      }
      onClose();
    } else {
      toast({ title: "Lỗi", description: data.error || "Không thể thêm máy CNC", variant: "destructive" })
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
  <DialogContent className="bg-white rounded-xl shadow-xl p-6 min-w-[350px] max-w-[600px] border border-slate-200">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-blue-700 mb-2">Thêm máy CNC ngoài kho</DialogTitle>
          <p className="text-slate-500 text-sm mb-4">Nhập thông tin máy CNC ngoài kho để quản lý và theo dõi trạng thái.</p>
        </DialogHeader>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="flex flex-col gap-2">
            <Label className="font-medium text-slate-700">Tên Sản Phẩm</Label>
            <Select value={form.ten_san_pham} onValueChange={v => setForm(f => ({ ...f, ten_san_pham: v }))}>
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
            <Input name="imei" value={form.imei} onChange={handleChange} required placeholder="Nhập IMEI" className="px-3 py-1.5 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
          </div>
          <div className="flex flex-col gap-2">
            <Label className="font-medium text-slate-700">Tình trạng</Label>
            <Input name="tinh_trang" value={form.tinh_trang} onChange={handleChange} placeholder="Nhập tình trạng" className="px-3 py-1.5 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
          </div>
          {/* Ẩn trường Loại Máy, vẫn giữ giá trị mặc định là Lock trong form */}
          <div className="hidden">
            <Input name="loai_may" value={form.loai_may} readOnly />
          </div>
          <div className="flex flex-col gap-2">
            <Label className="font-medium text-slate-700">Địa chỉ CNC</Label>
            <Select value={form.dia_chi_cnc} onValueChange={val => {
              if (val === "__add__") {
                setIsAddingCNCAddress(true)
              } else {
                setForm(f => ({ ...f, dia_chi_cnc: val }))
              }
            }}>
              <SelectTrigger className="px-3 py-1.5 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white text-slate-800 font-medium">
                <SelectValue placeholder="Chọn địa chỉ CNC" />
              </SelectTrigger>
              <SelectContent className="bg-white border border-slate-200 shadow-lg text-slate-800">
                {/* Địa chỉ mặc định và các địa chỉ đã thêm */}
                {typeof window !== 'undefined' && window.cncAddresses && window.cncAddresses.map((a: any) => (
                  <SelectItem key={a.value} value={a.value}>{a.label || a.value}</SelectItem>
                ))}
                <SelectItem value="__add__" className="text-blue-600">+ Thêm địa chỉ mới...</SelectItem>
              </SelectContent>
            </Select>
            {/* Nếu đang thêm địa chỉ mới */}
            {isAddingCNCAddress && (
              <div className="mt-2">
                <Input
                  value={newCNCAddress}
                  onChange={e => setNewCNCAddress(e.target.value)}
                  placeholder="Nhập địa chỉ CNC mới..."
                  className="px-3 py-1.5 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                />
                <div className="flex gap-2 mt-2">
                  <Button size="sm" onClick={() => {
                    if (newCNCAddress.trim()) {
                      if (typeof window !== 'undefined') {
                        window.cncAddresses = window.cncAddresses || [];
                        window.cncAddresses.push({ label: newCNCAddress, value: newCNCAddress });
                      }
                      setForm(f => ({ ...f, dia_chi_cnc: newCNCAddress }));
                      setNewCNCAddress("");
                      setIsAddingCNCAddress(false);
                    }
                  }} className="bg-blue-600 text-white">Lưu</Button>
                  <Button size="sm" variant="outline" onClick={() => {
                    setIsAddingCNCAddress(false);
                    setNewCNCAddress("");
                  }}>Hủy</Button>
                </div>
              </div>
            )}
          </div>
          <div className="flex flex-col gap-2">
            <Label className="font-medium text-slate-700">Khách hàng</Label>
            <Input name="khach_hang" value={form.khach_hang} onChange={handleChange} placeholder="Nhập tên khách hàng" className="px-3 py-1.5 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
          </div>
          <div className="flex flex-col gap-2">
            <Label className="font-medium text-slate-700">Số điện thoại khách hàng</Label>
            <Input name="so_dien_thoai" value={form.so_dien_thoai} onChange={handleChange} placeholder="Nhập số điện thoại" className="px-3 py-1.5 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
          </div>
        </div>
        <DialogFooter className="mt-6 flex gap-3 justify-end">
          <Button onClick={onClose} variant="outline" className="rounded-lg px-5">Hủy</Button>
          <Button onClick={handleSubmit} disabled={isLoading} className="bg-blue-600 text-white font-semibold rounded-lg px-5 shadow hover:bg-blue-700">Thêm máy CNC</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
