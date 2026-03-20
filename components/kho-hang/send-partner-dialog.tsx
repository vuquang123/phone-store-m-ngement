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
  const { sendPartner, isSendingPartner } = useInventoryActions()

  const handleConfirm = async () => {
    if (!partnerName.trim()) {
      toast.error("Vui lòng nhập tên đối tác")
      return
    }

    try {
      const productIds = selectedProducts.map(p => p.id || p.ID || p["ID Máy"])
      await sendPartner({
        productIds,
        partnerName,
        employeeId,
        products: selectedProducts
      })
      onOpenChange(false)
      setPartnerName("")
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
            Giao máy cho đối tác
          </DialogTitle>
          <DialogDescription>
            Xác nhận giao {selectedProducts.length} sản phẩm cho đối tác xem máy.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="partnerName">Tên đối tác / Thợ</Label>
            <Input
              id="partnerName"
              placeholder="Nhập tên đối tác..."
              value={partnerName}
              onChange={(e) => setPartnerName(e.target.value)}
              className="col-span-3"
              autoFocus
            />
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
                        IMEI: {p.imei || "—"}
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
            disabled={isSendingPartner || !partnerName.trim()}
            className="bg-purple-600 hover:bg-purple-700 text-white"
          >
            {isSendingPartner ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Đang xử lý...
              </>
            ) : (
              "Xác nhận giao"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
