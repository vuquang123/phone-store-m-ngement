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
import { useAuthMe } from "@/hooks/use-auth-me"
import { useToast } from "@/hooks/use-toast"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { SearchableSelect } from "@/components/ui/searchable-select"
import { IPHONE_NAMES } from "@/lib/constants/apple-devices"

export default function AddCNCMachineDialog({ isOpen, onClose, onSuccess }: { isOpen: boolean, onClose: () => void, onSuccess: () => void }) {
  const { me } = useAuthMe()
  const [form, setForm] = useState({
    ten_san_pham: "",
    imei: "",
    mau_sac: "",
    nguon: "Khách ngoài",
    tinh_trang: "",
    loai_may: "Lock",
    trang_thai: "Đang CNC",
    dia_chi_cnc: "",
    ngay_gui: new Date().toLocaleTimeString("vi-VN") + " " + new Date().toLocaleDateString("vi-VN"),
    ngay_nhan_lai: "",
    khach_hang: "",
    so_dien_thoai: "",
    do_sim: "Không rõ",
    employeeId: "",
    // Việc cần làm: CNC, thay pin, sửa lỗi... (gõ tự do)
    noi_dung: "CNC",
  })

  useEffect(() => {
    if (me?.employeeId) {
      setForm(f => ({ ...f, employeeId: me.employeeId || "" }))
    }
  }, [me])

  // Thêm state cho địa chỉ CNC
  const [isAddingCNCAddress, setIsAddingCNCAddress] = useState(false)
  const [newCNCAddress, setNewCNCAddress] = useState("")

  // Địa chỉ CNC mặc định
  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.cncAddresses = window.cncAddresses || [];
      const defaultAddress = 'Tâm Táo (9A Đường số 6, KP5, Linh Tây, Thủ Đức)';
      const qhStoreAddress = 'QH store (5 đường Năm Châu, phường 11, Tân Bình)';
      const exShopAddress = 'EX shop (95 Thành Mỹ, Phường 8, Tân Bình)';
      if (!window.cncAddresses.some(a => a.value === defaultAddress)) {
        window.cncAddresses.unshift({ label: defaultAddress, value: defaultAddress });
      }
      if (!window.cncAddresses.some(a => a.value === qhStoreAddress)) {
        window.cncAddresses.push({ label: qhStoreAddress, value: qhStoreAddress });
      }
    }
  }, []);

  const [productNames, setProductNames] = useState<string[]>([])
  // Máy đi CNC là máy độ sim -> chỉ iPhone, không liệt kê iPad.
  useEffect(() => {
    fetch("/api/kho-hang")
      .then(res => res.json())
      .then(data => {
        const names = Array.from(new Set((data.data || []).map((p: any) => p.ten_san_pham).filter(Boolean)))
        // Luôn giữ danh sách mặc định, không bị ghi đè bởi kho hàng
        const base: string[] = [...IPHONE_NAMES]
        setProductNames(base.concat((names as string[]).filter((n: string) => !base.includes(n))))
      })
  }, [])
  const [isLoading, setIsLoading] = useState(false)
  const { toast } = useToast()

  function handleChange(e: any) {
    setForm({ ...form, [e.target.name]: e.target.value })
  }

  async function handleSubmit() {
    if (!form.noi_dung.trim()) {
      toast({ title: "Thiếu nội dung xử lý", description: "VD: CNC, thay pin, sửa lỗi...", variant: "destructive" })
      return
    }
    setIsLoading(true)
    const res = await fetch("/api/kho-hang/add-cnc-machine", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, do_sim: /cnc/i.test(form.noi_dung) && form.do_sim !== "Không rõ" ? form.do_sim : "" })
    })
    const data = await res.json()
    setIsLoading(false)
    if (data.success) {
      toast({ title: "Thành công", description: data.message || "Đã nhận máy khách gửi xử lý", variant: "success" as any })
      setForm((f) => ({ ...f, ten_san_pham: "", imei: "", mau_sac: "", tinh_trang: "", khach_hang: "", so_dien_thoai: "", noi_dung: "CNC" }))
      if (typeof onSuccess === "function") {
        onSuccess(); // reload danh sách sản phẩm CNC
      }
      onClose();
    } else {
      toast({ title: "Lỗi", description: data.error || "Không thể nhận máy", variant: "destructive" })
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-card rounded-xl shadow-xl p-6 min-w-[350px] max-w-[600px] border border-border">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-blue-700 mb-2">Nhận máy khách gửi xử lý</DialogTitle>
          <p className="text-muted-foreground text-sm mb-4">Máy của khách (không có trong kho) mang tới để làm CNC, thay pin, sửa lỗi...</p>
        </DialogHeader>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="flex flex-col gap-2 md:col-span-2">
            <Label className="font-medium text-foreground">Nội dung xử lý <span className="text-red-500">*</span></Label>
            <Input
              name="noi_dung"
              value={form.noi_dung}
              onChange={handleChange}
              placeholder="VD: CNC, thay pin, sửa lỗi Face ID..."
              className="px-3 py-1.5 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label className="font-medium text-foreground">Tên Sản Phẩm</Label>
            <SearchableSelect
              value={form.ten_san_pham}
              onValueChange={v => setForm(f => ({ ...f, ten_san_pham: v }))}
              options={productNames}
              placeholder="Chọn sản phẩm"
              searchPlaceholder="Gõ tên máy, vd: 15 pro max"
              emptyText="Không có máy nào khớp."
              className="h-9 bg-card font-medium"
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label className="font-medium text-foreground">IMEI</Label>
            <Input name="imei" value={form.imei} onChange={handleChange} required placeholder="Nhập IMEI" className="px-3 py-1.5 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
          </div>
          <div className="flex flex-col gap-2">
            <Label className="font-medium text-foreground">Màu Sắc</Label>
            <Input name="mau_sac" value={form.mau_sac} onChange={handleChange} placeholder="Nhập màu sắc" className="px-3 py-1.5 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
          </div>
          <div className="flex flex-col gap-2">
            <Label className="font-medium text-foreground">Tình trạng</Label>
            <Input name="tinh_trang" value={form.tinh_trang} onChange={handleChange} placeholder="Nhập tình trạng" className="px-3 py-1.5 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
          </div>
          <div className={/cnc/i.test(form.noi_dung) ? "flex flex-col gap-2" : "hidden"}>
            <Label className="font-medium text-foreground">Kiểu Dạng Sim</Label>
            <Select value={form.do_sim} onValueChange={v => setForm(f => ({ ...f, do_sim: v }))}>
              <SelectTrigger className="px-3 py-1.5 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 bg-card text-foreground font-medium">
                <SelectValue placeholder="Chọn kiểu dạng sim..." />
              </SelectTrigger>
              <SelectContent className="bg-card border border-border shadow-lg text-foreground">
                <SelectItem value="Không rõ">Để trống</SelectItem>
                <SelectItem value="Nguyên bản">Nguyên bản</SelectItem>
                <SelectItem value="Sim ghép">Sim ghép</SelectItem>
                <SelectItem value="2 sim vật lý">2 sim vật lý</SelectItem>
                <SelectItem value="2 esim">2 esim</SelectItem>
                <SelectItem value="sim vật lý + esim">sim vật lý + esim</SelectItem>
                <SelectItem value="Chưa CNC">Chưa CNC</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-2">
            <Label className="font-medium text-foreground">Nguồn hàng</Label>
            <Select value={form.nguon} onValueChange={v => setForm(f => ({ ...f, nguon: v }))}>
              <SelectTrigger className="px-3 py-1.5 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 bg-card text-foreground font-medium">
                <SelectValue placeholder="Chọn nguồn" />
              </SelectTrigger>
              <SelectContent className="bg-card border border-border shadow-lg text-foreground">
                <SelectItem value="Khách ngoài">Khách ngoài</SelectItem>
                <SelectItem value="Kho trong">Kho trong</SelectItem>
                <SelectItem value="Kho ngoài">Kho ngoài</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="hidden">
            <Input name="loai_may" value={form.loai_may} readOnly />
          </div>
          <div className="flex flex-col gap-2">
            <Label className="font-medium text-foreground">Nơi xử lý (địa chỉ / tên thợ)</Label>
            <Select value={form.dia_chi_cnc} onValueChange={val => {
              if (val === "__add__") {
                setIsAddingCNCAddress(true)
              } else {
                setForm(f => ({ ...f, dia_chi_cnc: val }))
              }
            }}>
              <SelectTrigger className="px-3 py-1.5 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 bg-card text-foreground font-medium">
                <SelectValue placeholder="Chọn nơi xử lý" />
              </SelectTrigger>
              <SelectContent className="bg-card border border-border shadow-lg text-foreground">
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
                  placeholder="Nhập nơi xử lý mới (địa chỉ, tên thợ)..."
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
            <Label className="font-medium text-foreground">Khách hàng</Label>
            <Input name="khach_hang" value={form.khach_hang} onChange={handleChange} placeholder="Nhập tên khách hàng" className="px-3 py-1.5 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
          </div>
          <div className="flex flex-col gap-2">
            <Label className="font-medium text-foreground">Số điện thoại khách hàng</Label>
            <Input name="so_dien_thoai" value={form.so_dien_thoai} onChange={handleChange} placeholder="Nhập số điện thoại" className="px-3 py-1.5 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
          </div>
        </div>
        <DialogFooter className="mt-6 flex gap-3 justify-end">
          <Button onClick={onClose} variant="outline" className="rounded-lg px-5">Hủy</Button>
          <Button onClick={handleSubmit} disabled={isLoading} className="bg-blue-600 text-white font-semibold rounded-lg px-5 shadow hover:bg-blue-700">{isLoading ? "Đang lưu..." : "Nhận máy"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
