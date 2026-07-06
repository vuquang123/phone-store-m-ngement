"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { toast } from "sonner"

interface HangDoiTacDialogProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (product: any) => Promise<any>
  isSubmitting?: boolean
}

const EMPTY_FORM = {
  nguon_hang: "",
  ten_san_pham: "",
  loai_may: "",
  dung_luong: "",
  pin: "",
  mau_sac: "",
  imei: "",
  tinh_trang: "",
  gia_nhap: "",
  gia_ban: "",
  ghi_chu: "",
}

// Form nhập máy đối tác — các trường khớp cột sheet Hang_doi_tac
export function HangDoiTacDialog({ isOpen, onClose, onSubmit, isSubmitting }: HangDoiTacDialogProps) {
  const [form, setForm] = useState({ ...EMPTY_FORM })

  const set = (key: keyof typeof EMPTY_FORM) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }))

  const handleSubmit = async () => {
    if (!form.ten_san_pham.trim()) {
      toast.error("Vui lòng nhập Tên sản phẩm")
      return
    }
    if (!form.nguon_hang.trim()) {
      toast.error("Vui lòng nhập Nguồn hàng (tên kho đối tác)")
      return
    }
    try {
      await onSubmit({
        ...form,
        gia_nhap: form.gia_nhap ? Number(String(form.gia_nhap).replace(/[^\d]/g, "")) : "",
        gia_ban: form.gia_ban ? Number(String(form.gia_ban).replace(/[^\d]/g, "")) : "",
      })
      setForm({ ...EMPTY_FORM })
      onClose()
    } catch {
      // lỗi đã được toast ở mutation
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nhập hàng đối tác</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="sm:col-span-2 space-y-1.5">
            <Label>Nguồn hàng (kho đối tác) *</Label>
            <Input value={form.nguon_hang} onChange={set("nguon_hang")} placeholder="VD: Kho anh Tuấn Q10" />
          </div>
          <div className="sm:col-span-2 space-y-1.5">
            <Label>Tên sản phẩm *</Label>
            <Input value={form.ten_san_pham} onChange={set("ten_san_pham")} placeholder="VD: iPhone 15 Pro Max" />
          </div>
          <div className="space-y-1.5">
            <Label>Loại máy</Label>
            <Select value={form.loai_may} onValueChange={(v) => setForm((f) => ({ ...f, loai_may: v }))}>
              <SelectTrigger><SelectValue placeholder="Chọn loại" /></SelectTrigger>
              <SelectContent className="bg-card">
                <SelectItem value="Quốc tế">Quốc tế</SelectItem>
                <SelectItem value="Lock">Lock</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Dung lượng</Label>
            <Input value={form.dung_luong} onChange={set("dung_luong")} placeholder="VD: 256GB" />
          </div>
          <div className="space-y-1.5">
            <Label>Pin (%)</Label>
            <Input value={form.pin} onChange={set("pin")} placeholder="VD: 95" inputMode="numeric" />
          </div>
          <div className="space-y-1.5">
            <Label>Màu sắc</Label>
            <Input value={form.mau_sac} onChange={set("mau_sac")} placeholder="VD: Titan tự nhiên" />
          </div>
          <div className="sm:col-span-2 space-y-1.5">
            <Label>IMEI</Label>
            <Input value={form.imei} onChange={set("imei")} placeholder="Nhập IMEI" inputMode="numeric" />
          </div>
          <div className="sm:col-span-2 space-y-1.5">
            <Label>Tình trạng máy</Label>
            <Input value={form.tinh_trang} onChange={set("tinh_trang")} placeholder="VD: Đẹp 99%, máy zin" />
          </div>
          <div className="space-y-1.5">
            <Label>Giá nhập</Label>
            <Input value={form.gia_nhap} onChange={set("gia_nhap")} placeholder="VD: 15000000" inputMode="numeric" />
          </div>
          <div className="space-y-1.5">
            <Label>Giá bán</Label>
            <Input value={form.gia_ban} onChange={set("gia_ban")} placeholder="VD: 16500000" inputMode="numeric" />
          </div>
          <div className="sm:col-span-2 space-y-1.5">
            <Label>Ghi chú</Label>
            <Textarea value={form.ghi_chu} onChange={set("ghi_chu")} placeholder="Ghi chú thêm..." rows={2} />
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose}>Hủy</Button>
          <Button onClick={handleSubmit} disabled={isSubmitting} className="bg-emerald-600 hover:bg-emerald-700">
            {isSubmitting ? "Đang lưu..." : "Thêm máy"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
