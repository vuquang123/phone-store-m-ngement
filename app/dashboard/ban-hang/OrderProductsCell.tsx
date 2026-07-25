"use client"
import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Loader2 } from "lucide-react"

interface Props {
  orderId: string
  editableCosts?: boolean
}

export default function OrderProductsCell({ orderId, editableCosts = false }: Props) {
  const [products, setProducts] = useState<any[] | null>(null)
  const [warrantyPackages, setWarrantyPackages] = useState<string>("")
  const [expanded, setExpanded] = useState(false)
  const [costDrafts, setCostDrafts] = useState<Record<string, string>>({})
  const [savingKey, setSavingKey] = useState<string | null>(null)

  const loadOrderProducts = () => {
    if (!orderId) {
      setProducts([])
      return
    }
    fetch(`/api/ban-hang/${orderId}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        const chiTiet = Array.isArray(data?.chi_tiet) ? data.chi_tiet : []
        const machines = chiTiet.filter((it:any) => it.san_pham && (it.san_pham.imei || it.san_pham.serial || it.san_pham.ten_san_pham))
        setProducts(machines)
        setWarrantyPackages(String(data?.goi_bh || "").trim())
        setCostDrafts(
          Object.fromEntries(
            machines.map((it: any) => [it.id, String(Number(it.gia_nhap || 0))]),
          ),
        )
      })
      .catch(() => setProducts([]))
  }

  useEffect(() => {
    let mounted = true
    if (!orderId) { setProducts([]); return }
    fetch(`/api/ban-hang/${orderId}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (!mounted) return
        const chiTiet = Array.isArray(data?.chi_tiet) ? data.chi_tiet : []
        const machines = chiTiet.filter((it:any) => it.san_pham && (it.san_pham.imei || it.san_pham.serial || it.san_pham.ten_san_pham))
        setProducts(machines)
        setWarrantyPackages(String(data?.goi_bh || "").trim())
        setCostDrafts(
          Object.fromEntries(
            machines.map((it: any) => [it.id, String(Number(it.gia_nhap || 0))]),
          ),
        )
      })
      .catch(() => {
        if (mounted) {
          setProducts([])
          setWarrantyPackages("")
        }
      })
    return () => { mounted = false }
  }, [orderId])

  const saveGiaNhap = async (item: any) => {
    if (!editableCosts || !item?.row_number) return
    const nextGiaNhap = Number(String(costDrafts[item.id] || "").replace(/[^\d]/g, ""))
    setSavingKey(item.id)
    try {
      const res = await fetch(`/api/ban-hang/${encodeURIComponent(orderId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          row_number: item.row_number,
          gia_nhap: nextGiaNhap,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error || "Không thể cập nhật giá nhập")
      loadOrderProducts()
    } catch (e: any) {
      alert(e?.message || "Không thể cập nhật giá nhập")
    } finally {
      setSavingKey(null)
    }
  }

  if (products === null) return <span className="text-xs text-muted-foreground">Đang tải...</span>
  if (!products.length) return <span className="text-muted-foreground">-</span>

  // Mobile: show at most 2 items + "+n" toggle
  const visibleCount = 2
  const showCompact = typeof window !== 'undefined' && window.innerWidth < 768
  const list = showCompact && !expanded ? products.slice(0, visibleCount) : products

  return (
    <div className="space-y-1.5 max-w-[220px]">
      {list.map((p, i) => (
        <div key={p.id || p.san_pham?.imei || i} className="text-xs leading-tight">
          <div className="font-medium break-words">{p.san_pham?.ten_san_pham || p.san_pham?.model || 'Thiết bị'}</div>
          {p.san_pham?.mau_sac && <div className="text-muted-foreground">{p.san_pham.mau_sac}</div>}
          {(p.san_pham?.imei || p.san_pham?.serial) && (
            <div className="text-muted-foreground font-mono break-all">
              {p.san_pham.imei || p.san_pham.serial}
            </div>
          )}
          {editableCosts && (
            <div className="mt-2 rounded-md border p-2 space-y-2 bg-muted/30 min-w-[220px]">
              <div className="text-[11px] text-muted-foreground">
                Lãi: <span className="font-medium text-foreground">₫{Number(p.lai || 0).toLocaleString("vi-VN")}</span>
              </div>
              <div className="flex items-center gap-2">
                <Input
                  value={costDrafts[p.id] ? `₫${Number(costDrafts[p.id] || 0).toLocaleString("vi-VN")}` : ""}
                  onChange={(e) => {
                    const digits = e.target.value.replace(/[^\d]/g, "")
                    setCostDrafts((prev) => ({ ...prev, [p.id]: digits }))
                  }}
                  className="h-8 text-xs"
                />
                <Button size="sm" className="h-8 shrink-0 text-xs px-2" disabled={savingKey === p.id} onClick={() => saveGiaNhap(p)}>
                  {savingKey === p.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Lưu"}
                </Button>
              </div>
            </div>
          )}
        </div>
      ))}
      {showCompact && products.length > visibleCount && (
        <button type="button" onClick={() => setExpanded(!expanded)} className="text-xs text-blue-600 underline">
          {expanded ? 'Ẩn bớt' : `+${products.length - visibleCount} thiết bị khác`}
        </button>
      )}
      {warrantyPackages && (
        <div className="rounded-md border border-emerald-200 bg-emerald-50/70 px-2 py-1 text-[11px] text-emerald-700">
          BH: {warrantyPackages}
        </div>
      )}
    </div>
  )
}
