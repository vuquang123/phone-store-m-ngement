"use client"
// Hộp "Chi phí CNC" khi quản lý bấm Xong máy gửi CNC: nhập chi phí từng máy, app cộng vào Giá nhập (giá vốn) trên kho.
// Máy Lock điền sẵn chi phí mặc định (Tài chính → Cài đặt). Máy khách ngoài không có trong kho nên không hỏi.
import { useEffect, useState } from "react"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { OTien, vnd } from "@/components/tai-chinh/chung"

export type MayCnc = { imei: string; id?: string; ten_san_pham: string; loai_may?: string; nguon?: string; noi_dung?: string }

const laKhachNgoai = (m: MayCnc) => /khách/i.test(m.nguon || "")
const laLock = (m: MayCnc) => /lock/i.test(m.loai_may || "")

export function CncChiPhiDialog({
  open,
  may,
  dangGui,
  onClose,
  onConfirm,
}: {
  open: boolean
  may: MayCnc[]
  dangGui?: boolean
  onClose: () => void
  onConfirm: (chiPhi: Record<string, number>) => void
}) {
  const [macDinh, setMacDinh] = useState(0)
  const [cp, setCp] = useState<Record<string, number | "">>({})
  const dsHoi = may.filter((m) => !laKhachNgoai(m) && m.imei)

  useEffect(() => {
    if (!open) return
    let huy = false
    fetch("/api/kho-hang/complete-cnc", { cache: "no-store" })
      .then((r) => r.json())
      .catch(() => ({}))
      .then((j: any) => {
        if (huy) return
        const md = Number(j?.chiPhiCncLock) || 0
        setMacDinh(md)
        setCp(Object.fromEntries(dsHoi.map((m) => [m.imei, laLock(m) && md ? md : ""])))
      })
    return () => {
      huy = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, may])

  const tong = dsHoi.reduce((s, m) => s + (Number(cp[m.imei]) || 0), 0)
  const xacNhan = () => {
    const out: Record<string, number> = {}
    for (const m of dsHoi) {
      const n = Number(cp[m.imei]) || 0
      if (n > 0) out[m.imei] = n
    }
    onConfirm(out)
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Xong {may.length} máy · chi phí CNC</DialogTitle>
          <DialogDescription>
            Chi phí nhập ở đây được cộng vào Giá nhập (giá vốn) của máy trong kho, nên lãi khi bán đã trừ phần này. Nợ đầu hàng không đổi. Bỏ trống = không có chi phí.
          </DialogDescription>
        </DialogHeader>
        <div className="max-h-[50vh] space-y-2 overflow-y-auto">
          {dsHoi.map((m) => (
            <div key={m.imei} className="flex items-center justify-between gap-2 text-sm">
              <div className="min-w-0">
                <div className="truncate font-medium">{m.ten_san_pham}</div>
                <div className="text-xs text-muted-foreground">
                  {m.imei.slice(-5)} · {m.loai_may || "—"}
                  {m.noi_dung ? ` · ${m.noi_dung}` : ""}
                </div>
              </div>
              <OTien className="w-36 text-right" value={cp[m.imei] ?? ""} onChange={(v) => setCp({ ...cp, [m.imei]: v })} placeholder="0" />
            </div>
          ))}
          {may.length > dsHoi.length && <p className="text-xs text-muted-foreground">{may.length - dsHoi.length} máy khách ngoài: không tính chi phí vào kho.</p>}
          {!macDinh && dsHoi.some(laLock) && <p className="text-xs text-muted-foreground">Chưa đặt chi phí CNC mặc định cho máy Lock (Tài chính → Cài đặt).</p>}
        </div>
        <DialogFooter className="items-center gap-2 sm:justify-between">
          <span className="text-sm">
            Tổng chi phí: <b className="tabular-nums">{vnd(tong)}</b>
          </span>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>
              Huỷ
            </Button>
            <Button className="bg-green-600 hover:bg-green-700" onClick={xacNhan} disabled={dangGui}>
              Xong
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
