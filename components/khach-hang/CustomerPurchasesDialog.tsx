"use client"

import { useEffect, useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"

interface Props {
  isOpen: boolean
  onClose: () => void
  phone: string
}

// module-scope cache: giữ kết quả trong session (tab)
const purchasesCache: Map<string, any[]> = new Map()

function normalizePhone(p: any) {
  const s = String(p || "").replace(/\D/g, "")
  if (s.startsWith('84')) return '0' + s.slice(2)
  return s
}

export default function CustomerPurchasesDialog({ isOpen, onClose, phone }: Props) {
  const [items, setItems] = useState<any[] | null>(null)

  useEffect(() => {
    let mounted = true
    if (!isOpen) return

    const target = normalizePhone(phone)
    if (!target) {
      setItems([])
      return
    }

    // Nếu đã có cache thì dùng luôn
    const cached = purchasesCache.get(target)
    if (cached) {
      setItems(cached)
      return
    }

    const fetchData = async () => {
      try {
        setItems(null)
        const res = await fetch('/api/ban-hang')
        if (!res.ok) throw new Error('failed to fetch')
        const d = await res.json()
        const rows = Array.isArray(d.data) ? d.data : []

        const matched: any[] = []
        for (const r of rows) {
          const rawPhone = r.so_dien_thoai || r["Số Điện Thoại"] || (r.khach_hang && (r.khach_hang.so_dien_thoai || r.khach_hang.sdt)) || ''
          const rowPhone = normalizePhone(rawPhone)
          const imei = r.imei || r["IMEI"] || (r.san_pham && r.san_pham.imei) || ''
          if (!rowPhone) continue
          if (rowPhone === target && imei) {
              // Extract price from possible columns
              const rawPrice = r.gia_ban ?? r["Giá Bán"] ?? r.giaBan ?? ''
              let priceNum = 0
              if (typeof rawPrice === 'number') priceNum = rawPrice
                else if (rawPrice) {
                  // remove any non-digit characters (dots, commas, currency symbols)
                  const cleaned = String(rawPrice).replace(/[^\d]/g, '')
                const p = Number(cleaned)
                if (Number.isFinite(p)) priceNum = p
              }
              matched.push({
                ten_san_pham: r.ten_san_pham || r["Tên Sản Phẩm"] || (r.san_pham && r.san_pham.ten_san_pham) || '',
                imei: imei,
                serial: r.serial || (r.san_pham && r.san_pham.serial) || '',
                ngay_xuat: r.ngay_xuat || r["Ngày Xuất"] || '',
                gia_ban: priceNum,
              })
            }
        }
        if (!mounted) return
        purchasesCache.set(target, matched)
        setItems(matched)
      } catch (err) {
        if (!mounted) return
        setItems([])
      }
    }
    fetchData()
    return () => { mounted = false }
  }, [isOpen, phone])

  return (
    <Dialog open={isOpen} onOpenChange={(v) => { if (!v) onClose() }}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Danh sách máy đã mua — {phone}</DialogTitle>
        </DialogHeader>
        <div className="mt-2">
          {items === null ? (
            <div className="text-sm text-muted-foreground">Đang tải...</div>
          ) : items.length === 0 ? (
            <div className="text-sm text-muted-foreground">Không có dữ liệu</div>
          ) : (
            <div className="space-y-2">
              {items.map((it, idx) => (
                <div key={idx} className="p-2 border rounded text-sm">
                  <div className="flex items-start justify-between">
                    <div className="font-medium">{it.ten_san_pham || 'Thiết bị'}</div>
                    {typeof it.gia_ban === 'number' && it.gia_ban > 0 && (
                      <div className="text-sm font-medium text-slate-800 ml-4">₫{Number(it.gia_ban).toLocaleString('vi-VN')}</div>
                    )}
                  </div>
                  <div className="mt-1">
                    {it.imei && <div className="text-xs font-mono text-muted-foreground">IMEI: {it.imei}</div>}
                    {it.serial && <div className="text-xs font-mono text-muted-foreground">Serial: {it.serial}</div>}
                    {it.ngay_xuat && <div className="text-xs text-slate-500 mt-1">{it.ngay_xuat}</div>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="mt-4 flex justify-end">
          <Button onClick={onClose}>Đóng</Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
