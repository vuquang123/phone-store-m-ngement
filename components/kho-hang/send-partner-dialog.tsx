"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"
import { useInventoryActions } from "@/hooks/use-inventory-actions"
import { toast } from "sonner"
import { Loader2, User } from "lucide-react"
import { normalizePhoneVN } from "@/lib/utils/inventory-helpers"

interface SendPartnerDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  selectedProducts: any[]
  employeeId?: string
  onSuccess?: () => void
}

export function SendPartnerDialog({ 
  open, 
  onOpenChange, 
  selectedProducts, 
  employeeId,
  onSuccess 
}: SendPartnerDialogProps) {
  const [partnerName, setPartnerName] = useState("")
  const [partnerPhone, setPartnerPhone] = useState("")
  const { sendPartner, isSendingPartner } = useInventoryActions()
  const phoneOk = !!normalizePhoneVN(partnerPhone)
  const canSubmit = !!partnerName.trim() && phoneOk

  const handleConfirm = async () => {
    if (!partnerName.trim()) {
      toast.error("Vui lòng nhập tên đối tác")
      return
    }
    if (!phoneOk) {
      toast.error("Vui lòng nhập SĐT đối tác hợp lệ (9–11 số)")
      return
    }

    try {
      const productIds = selectedProducts.map(p => p.id || p.ID || p["ID Máy"])
      await sendPartner({
        productIds,
        partnerName: partnerName.trim(),
        partnerPhone: normalizePhoneVN(partnerPhone),
        employeeId,
        products: selectedProducts
      })
      onOpenChange(false)
      setPartnerName("")
      setPartnerPhone("")
      if (onSuccess) onSuccess()
    } catch (error) {
      // toast recorded in hook
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User className="w-5 h-5 text-purple-600" />
            Gửi máy cho đối tác
          </DialogTitle>
          <DialogDescription>
            Gửi {selectedProducts.length} máy cho thợ / khách sỉ giữ. Máy sẽ ẩn khỏi danh sách bán và nằm ở tab
            <b> Máy gửi đối tác</b>, sau đó anh xuất bán hoặc hoàn kho. Chưa cần nhập giá.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="partnerName">Tên đối tác / thợ <span className="text-red-500">*</span></Label>
              <Input
                id="partnerName"
                placeholder="VD: Anh Tâm thợ"
                value={partnerName}
                onChange={(e) => setPartnerName(e.target.value)}
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="partnerPhone">SĐT <span className="text-red-500">*</span></Label>
              <Input
                id="partnerPhone"
                type="tel"
                inputMode="tel"
                placeholder="09xx xxx xxx"
                value={partnerPhone}
                onChange={(e) => setPartnerPhone(e.target.value)}
                aria-invalid={!!partnerPhone && !phoneOk}
                className={partnerPhone && !phoneOk ? "border-red-400 focus-visible:ring-red-400" : ""}
              />
              {partnerPhone && !phoneOk ? <p className="text-xs text-red-500">SĐT cần 9–11 số</p> : null}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Danh sách sản phẩm đã chọn:</Label>
            <ScrollArea className="h-[200px] w-full rounded-md border p-2">
              <div className="space-y-2">
                {selectedProducts.map((p, idx) => (
                  <div key={idx} className="text-sm p-2 bg-muted/50 rounded-lg flex justify-between items-start">
                    <div className="space-y-1">
                      <p className="font-medium text-purple-700">
                        {p.ten_san_pham || p.tenSP || p["Tên Sản Phẩm"]}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {p.mau_sac || p.mauSac} | {p.dung_luong || p.dungLuong}
                      </p>
                      <p className="text-[10px] font-mono">
                        {p.imei ? `IMEI: ${p.imei}` : p.serial ? `Serial: ${p.serial}` : "IMEI: —"}
                      </p>
                    </div>
                    {p.tinh_trang && (
                      <Badge variant="outline" className="text-[10px] whitespace-nowrap">
                        {p.tinh_trang}
                      </Badge>
                    )}
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Hủy
          </Button>
          <Button 
            onClick={handleConfirm} 
            disabled={isSendingPartner || !canSubmit}
            className="bg-purple-600 hover:bg-purple-700 text-white"
          >
            {isSendingPartner ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Đang xử lý...
              </>
            ) : (
              "Gửi đối tác"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
