"use client"
// Ô "Lô nhập" trong form nhập hàng: chọn lô để máy được ghi vào sổ lô. Chủ shop tạo nhanh lô mới tại chỗ.
import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

type LoNgan = { ma: string; dauHang: string; ngayNhap: string }

export function LoNhapPicker({ value, onChange, className }: { value: string; onChange: (ma: string) => void; className?: string }) {
  const [ds, setDs] = useState<LoNgan[]>([])
  const [dauHang, setDauHang] = useState<{ id: string; ten: string }[]>([])
  const [laChu, setLaChu] = useState(false)
  const [moTao, setMoTao] = useState(false)
  const [dh, setDh] = useState("")
  const [ngay, setNgay] = useState(() => new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 10))
  const [dangTao, setDangTao] = useState(false)
  const [loi, setLoi] = useState("")

  const tai = async () => {
    try {
      const r = await fetch("/api/tai-chinh/lo-nhap", { cache: "no-store" })
      if (!r.ok) return
      const j = await r.json()
      setDs((j.lo || []).filter((l: LoNgan) => !l.ma.startsWith("LO-CU")))
      setDauHang(j.dauHang || [])
      setLaChu(!!j.laChuShop)
    } catch {}
  }
  useEffect(() => {
    tai()
  }, [])

  const tao = async () => {
    if (!dh) return setLoi("Chọn đầu hàng")
    setDangTao(true)
    setLoi("")
    try {
      const r = await fetch("/api/tai-chinh/lo-nhap", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ dauHangId: dh, ngayNhap: ngay }) })
      const j = await r.json()
      if (!r.ok) throw new Error(j.error || "Không tạo được lô")
      await tai()
      onChange(j.ma)
      setMoTao(false)
    } catch (e: any) {
      setLoi(e.message)
    } finally {
      setDangTao(false)
    }
  }

  if (!ds.length && !laChu) return null
  return (
    <div className={cn("rounded-lg border bg-muted/30 p-2 text-sm", className)}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-medium">Lô nhập</span>
        <select className="h-8 min-w-0 flex-1 rounded-md border bg-background px-2" value={value} onChange={(e) => onChange(e.target.value)}>
          <option value="">Không chọn lô</option>
          {ds.map((l) => (
            <option key={l.ma} value={l.ma}>
              {l.ma} · {l.dauHang} · {l.ngayNhap.split("-").reverse().join("/")}
            </option>
          ))}
        </select>
        {laChu && (
          <Button type="button" size="sm" variant="outline" className="h-8" onClick={() => setMoTao((x) => !x)}>
            + Lô mới
          </Button>
        )}
      </div>
      {moTao && (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <select className="h-8 rounded-md border bg-background px-2" value={dh} onChange={(e) => setDh(e.target.value)}>
            <option value="">Chọn đầu hàng</option>
            {dauHang.map((d) => (
              <option key={d.id} value={d.id}>
                {d.ten}
              </option>
            ))}
          </select>
          <Input type="date" className="h-8 w-40" value={ngay} onChange={(e) => setNgay(e.target.value)} />
          <Button type="button" size="sm" className="h-8" disabled={dangTao} onClick={tao}>
            {dangTao ? "Đang tạo…" : "Tạo lô"}
          </Button>
          {loi && <span className="text-xs text-red-600">{loi}</span>}
          <span className="w-full text-xs text-muted-foreground">Chi phí lô, tiền đã trả, hạn trả nhập sau ở Tài chính → Lô hàng.</span>
        </div>
      )}
    </div>
  )
}
