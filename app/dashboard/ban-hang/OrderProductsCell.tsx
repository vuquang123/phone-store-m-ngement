"use client"
import { useEffect, useState } from "react"

interface Props { orderId: string }

export default function OrderProductsCell({ orderId }: Props) {
  const [products, setProducts] = useState<any[] | null>(null)
  const [expanded, setExpanded] = useState(false)

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
      })
      .catch(() => { if (mounted) setProducts([]) })
    return () => { mounted = false }
  }, [orderId])

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
        </div>
      ))}
      {showCompact && products.length > visibleCount && (
        <button type="button" onClick={() => setExpanded(!expanded)} className="text-xs text-blue-600 underline">
          {expanded ? 'Ẩn bớt' : `+${products.length - visibleCount} thiết bị khác`}
        </button>
      )}
    </div>
  )
}