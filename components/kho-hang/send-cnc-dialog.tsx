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
import { ScrollArea } from "@/components/ui/scroll-area"
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
    if (!cncAddress && !newAddress) {
      toast.error("Vui lòng chọn hoặc nhập địa chỉ CNC")
      return
    }

    const finalAddress = isAddingNewAddress ? newAddress : cncAddress
    const productIds = selectedProducts.map(p => p.id_may || p.imei || p.id)

    try {
      await sendCNC({
        productIds,
        cncAddress: finalAddress,
        employeeId,
        products: selectedProducts,
        doSim: doSim === "Không rõ" ? "" : doSim
      })
      toast.success(`Đã gửi ${selectedProducts.length} sản phẩm đi CNC`)
      if (onSuccess) onSuccess()
      onClose()
    } catch (error: any) {
      toast.error("Lỗi khi gửi CNC: " + error.message)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-white max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-blue-700">Gửi sản phẩm đi CNC</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label className="text-slate-500 text-xs">Sản phẩm đã chọn ({selectedProducts.length})</Label>
            <ScrollArea className="h-[180px] w-full rounded-md border border-slate-100 bg-slate-50/50 p-2">
              <div className="space-y-2">
                {selectedProducts.map((p, i) => (
                  <div key={p.id || i} className="bg-white p-2 rounded border border-slate-100 shadow-sm text-xs">
                    <div className="flex justify-between items-start mb-1">
                      <span className="font-semibold text-slate-800">{p.ten_san_pham}</span>
                      <Badge variant="outline" className="text-[10px] py-0 h-4 border-slate-200 text-slate-500 font-normal">
                        {p.tinh_trang || "N/A"}
                      </Badge>
                    </div>
                    <div className="flex gap-2 text-slate-500">
                      <span>{p.mau_sac}</span>
                      <span>•</span>
                      <span>{p.dung_luong}</span>
                    </div>
                    <div className="mt-1 font-mono text-blue-600 font-medium">
                      IMEI: {p.imei}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>

          <div className="space-y-2">
            <Label>Kiểu Dạng Sim</Label>
            <Select value={doSim} onValueChange={setDoSim}>
              <SelectTrigger className="bg-white">
                <SelectValue placeholder="Chọn kiểu dạng sim..." />
              </SelectTrigger>
              <SelectContent className="bg-white">
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

          <div className="space-y-2">
            <Label>Địa chỉ CNC (Nơi nhận)</Label>
            {!isAddingNewAddress ? (
              <div className="flex gap-2">
                <Select value={cncAddress} onValueChange={setCncAddress}>
                  <SelectTrigger className="bg-white">
                    <SelectValue placeholder="Chọn địa chỉ..." />
                  </SelectTrigger>
                  <SelectContent className="bg-white">
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
                  placeholder="Nhập địa chỉ mới..."
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
          <Button onClick={handleSend} disabled={isSendingCNC} className="bg-blue-600 hover:bg-blue-700">
            {isSendingCNC ? "Đang xử lý..." : "Xác nhận gửi CNC"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
