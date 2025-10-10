"use client"

import { useEffect, useMemo, useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"

export interface PartnerItem {
  id: string
  sheet: string
  row_index: number
  hang?: string
  ten_doi_tac?: string
  sdt_doi_tac?: string
  model?: string
  loai_may?: string
  bo_nho?: string
  pin_pct?: string
  mau?: string
  tinh_trang?: string
  imei?: string
  gia_chuyen?: number
  gia_goi_y_ban?: number
  trang_thai?: string
}

type Props = {
  open: boolean
  onOpenChange: (v: boolean) => void
  onSelect: (item: PartnerItem) => void
}

export function PartnerSelectDialog({ open, onOpenChange, onSelect }: Props) {
  const [loading, setLoading] = useState(false)
  const [items, setItems] = useState<PartnerItem[]>([])
  const [q, setQ] = useState("")
  useEffect(() => {
    if (!open) return
    let cancelled = false
    const fetchItems = async () => {
      try {
        setLoading(true)
        const res = await fetch("/api/doi-tac/hang-order")
        if (!res.ok) throw new Error(await res.text())
        const data = await res.json()
        const arr = Array.isArray(data?.items) ? data.items : []
        if (!cancelled) setItems(arr)
      } catch {
        if (!cancelled) setItems([])
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    fetchItems()
    return () => { cancelled = true }
  }, [open])

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase()
    if (!s) return items
    return items.filter((it) => {
      const hay = [
        it.model,
        it.loai_may,
        it.bo_nho,
        it.mau,
        it.imei,
        it.ten_doi_tac,
        it.sdt_doi_tac,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
      return hay.includes(s)
    })
  }, [q, items])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Chọn máy đối tác</DialogTitle>
          <DialogDescription>
            Danh sách máy từ sheet hàng đối tác. Chọn để thêm vào giỏ hàng, giá nhập sẽ lấy từ Giá Chuyển.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <Input
            placeholder="Tìm theo model, dung lượng, màu, IMEI, tên đối tác..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="bg-white"
          />
          <div className="max-h-[360px] overflow-y-auto border rounded">
            {loading ? (
              <div className="p-4 text-sm text-muted-foreground">Đang tải...</div>
            ) : filtered.length === 0 ? (
              <div className="p-4 text-sm text-muted-foreground">Không có dữ liệu</div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-slate-50 sticky top-0">
                  <tr>
                    <th className="text-left px-3 py-2">Sản phẩm</th>
                    <th className="text-left px-3 py-2">IMEI</th>
                    <th className="text-left px-3 py-2">Giá chuyển</th>
                    <th className="text-left px-3 py-2">Gợi ý bán</th>
                    <th className="text-left px-3 py-2">Đối tác</th>
                    <th className="text-right px-3 py-2">Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((it) => (
                    <tr key={it.id} className="border-b hover:bg-slate-50">
                      <td className="px-3 py-2">
                        <div className="font-medium">{it.model || "(Không tên)"}</div>
                        <div className="text-xs text-muted-foreground">
                          {it.loai_may ? `Loại: ${it.loai_may} • ` : ""}
                          {it.bo_nho ? `Dung lượng: ${it.bo_nho} • ` : ""}
                          {it.mau ? `Màu: ${it.mau}` : ""}
                        </div>
                        {it.tinh_trang && (
                          <div className="text-[11px] text-muted-foreground">{it.tinh_trang}</div>
                        )}
                      </td>
                      <td className="px-3 py-2 font-mono text-xs">{it.imei || "-"}</td>
                      <td className="px-3 py-2">{it.gia_chuyen ? `₫${it.gia_chuyen.toLocaleString("vi-VN")}` : "-"}</td>
                      <td className="px-3 py-2">{it.gia_goi_y_ban ? `₫${it.gia_goi_y_ban.toLocaleString("vi-VN")}` : <Badge variant="outline">Tự nhập</Badge>}</td>
                      <td className="px-3 py-2">
                        <div className="text-xs">{it.ten_doi_tac || "-"}</div>
                        <div className="text-[11px] text-muted-foreground">{it.sdt_doi_tac || ""}</div>
                      </td>
                      <td className="px-3 py-2 text-right">
                        <Button
                          size="sm"
                          onClick={() => {
                            onSelect(it)
                            onOpenChange(false)
                          }}
                        >
                          Thêm
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
