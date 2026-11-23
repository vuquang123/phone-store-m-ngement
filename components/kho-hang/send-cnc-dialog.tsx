"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { toast } from "sonner"
import { useInventoryActions } from "@/hooks/use-inventory-actions"
import { useAuthMe } from "@/hooks/use-auth-me"
import { Badge } from "@/components/ui/badge"

interface SendCNCDialogProps {
  isOpen: boolean
  onClose: () => void
  selectedProducts: any[]
  onSuccess?: () => void
}

export function SendCNCDialog({ isOpen, onClose, selectedProducts, onSuccess }: SendCNCDialogProps) {
  const { me } = useAuthMe()
  const { sendCNC, isSendingCNC } = useInventoryActions()
  const [cncAddress, setCncAddress] = useState("")
  const [isAddingNewAddress, setIsAddingNewAddress] = useState(false)
  const [newAddress, setNewAddress] = useState("")
  const [employeeId, setEmployeeId] = useState("")
  const [doSim, setDoSim] = useState("Không rõ")
  // Việc cần làm: CNC, thay pin, sửa lỗi... (gõ tự do). Mặc định CNC như trước.
  const [noiDung, setNoiDung] = useState("CNC")
  const isCNC = /cnc/i.test(noiDung)

  // Lấy danh sách địa chỉ từ window (giống AddCNCMachineDialog)
  const [addresses, setAddresses] = useState<{ label: string, value: string }[]>([])

  useEffect(() => {
    if (me?.employeeId) {
      setEmployeeId(me.employeeId)
    }
  }, [me])

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const defaultAddresses = [
        { label: 'Tâm Táo (Thủ Đức)', value: 'Tâm Táo (9A Đường số 6, KP5, Linh Tây, Thủ Đức)' },
        { label: 'QH store (Tân Bình)', value: 'QH store (5 đường Năm Châu, phường 11, Tân Bình)' },
        { label: 'EX shop (Tân Bình)', value: 'EX shop (95 Thành Mỹ, Phường 8, Tân Bình)' },
      ]
      setAddresses(defaultAddresses)
    }
  }, [])

  const handleSend = async () => {
    if (!noiDung.trim()) {
      toast.error("Vui lòng nhập nội dung xử lý (VD: CNC, thay pin, sửa lỗi...)")
      return
    }
    if (!cncAddress && !newAddress) {
      toast.error("Vui lòng chọn hoặc nhập nơi xử lý")
      return
    }

    const finalAddress = isAddingNewAddress ? newAddress : cncAddress
    const productIds = selectedProducts.map(p => p.id || p.id_may || p.imei)

    try {
      await sendCNC({
        productIds,
        cncAddress: finalAddress,
        employeeId,
        products: selectedProducts,
        doSim: isCNC && doSim !== "Không rõ" ? doSim : "",
        noiDung: noiDung.trim(),
      })
      toast.success(`Đã gửi ${selectedProducts.length} máy đi xử lý: ${noiDung.trim()}`)
      setNoiDung("CNC")
      if (onSuccess) onSuccess()
      onClose()
    } catch (error: any) {
      toast.error("Lỗi khi gửi xử lý: " + error.message)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-card max-w-md w-[90%]">
        <DialogHeader>
          <DialogTitle>Gửi máy đi xử lý</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label className="text-muted-foreground text-xs">Sản phẩm đã chọn ({selectedProducts.length})</Label>
            <div className="max-h-[220px] space-y-2 overflow-y-auto rounded-md border bg-muted/40 p-2">
              {selectedProducts.map((p, i) => (
                <div key={p.id || i} className="rounded-md border bg-card p-2.5 text-xs shadow-sm">
                  <div className="mb-1 flex items-start justify-between gap-2">
                    <span className="font-semibold text-foreground">{p.ten_san_pham}</span>
                    <Badge variant="secondary" className="h-5 shrink-0 py-0 text-[10px] font-normal">
                      {p.tinh_trang || "N/A"}
                    </Badge>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5 text-muted-foreground">
                    <span>{p.mau_sac}</span>
                    {p.dung_luong && <span>•</span>}
                    <span>{p.dung_luong}</span>
                  </div>
                  <div className="mt-1 font-mono text-muted-foreground">{p.imei ? `IMEI: ${p.imei}` : p.serial ? `Serial: ${p.serial}` : "IMEI: —"}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="noi-dung-xu-ly">Nội dung xử lý <span className="text-red-500">*</span></Label>
            <Input
              id="noi-dung-xu-ly"
              value={noiDung}
              onChange={(e) => setNoiDung(e.target.value)}
              placeholder="VD: CNC, thay pin, sửa lỗi Face ID..."
              autoFocus
            />
          </div>

          {isCNC && (
          <div className="space-y-2">
            <Label>Kiểu Dạng Sim</Label>
            <Select value={doSim} onValueChange={setDoSim}>
              <SelectTrigger className="bg-card">
                <SelectValue placeholder="Chọn kiểu dạng sim..." />
              </SelectTrigger>
              <SelectContent className="bg-card">
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
          )}

          <div className="space-y-2">
            <Label>Nơi xử lý (địa chỉ / tên thợ)</Label>
            {!isAddingNewAddress ? (
              <div className="flex gap-2">
                <Select value={cncAddress} onValueChange={setCncAddress}>
                  <SelectTrigger className="bg-card">
                    <SelectValue placeholder="Chọn nơi xử lý..." />
                  </SelectTrigger>
                  <SelectContent className="bg-card">
                    {addresses.map(addr => (
                      <SelectItem key={addr.value} value={addr.value}>{addr.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button variant="outline" size="sm" onClick={() => setIsAddingNewAddress(true)}>Thêm mới</Button>
              </div>
            ) : (
              <div className="space-y-2">
                <Input
                  placeholder="Nhập nơi xử lý mới (địa chỉ, tên thợ)..."
                  value={newAddress}
                  onChange={e => setNewAddress(e.target.value)}
                  autoFocus
                />
                <div className="flex gap-2">
                  <Button variant="ghost" size="sm" onClick={() => setIsAddingNewAddress(false)}>Quay lại</Button>
                </div>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label>Mã nhân viên thực hiện</Label>
            <Input value={employeeId} onChange={e => setEmployeeId(e.target.value)} placeholder="NV001" />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isSendingCNC}>Hủy</Button>
          <Button onClick={handleSend} disabled={isSendingCNC}>
            {isSendingCNC ? "Đang gửi..." : "Gửi đi xử lý"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
