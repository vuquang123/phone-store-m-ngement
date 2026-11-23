"use client"
// Ô chọn đầu hàng có dòng "+ Thêm đầu hàng mới": gõ tên (và số ngày nợ) là tạo luôn, tự chọn đầu hàng vừa tạo.
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

const MOI = "__moi__"

export function ChonDauHang({
  value,
  onChange,
  dauHang,
  onCreated,
  className,
  hienSoNgay = true,
}: {
  value: string
  onChange: (id: string) => void
  dauHang: { id: string; ten: string; soNgayNo?: number }[]
  onCreated: (dh: { id: string; ten: string; soNgayNo: number }) => void
  className?: string
  hienSoNgay?: boolean
}) {
  const [moi, setMoi] = useState(false)
  const [ten, setTen] = useState("")
  const [soNgay, setSoNgay] = useState("7")
  const [dang, setDang] = useState(false)
  const [loi, setLoi] = useState("")

  const tao = async () => {
    if (!ten.trim()) return setLoi("Nhập tên đầu hàng")
    setDang(true)
    setLoi("")
    try {
      const r = await fetch("/api/tai-chinh/lo-nhap", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "dau-hang", ten: ten.trim(), soNgayNo: Number(soNgay) || 0 }),
      })
      const j = await r.json()
      if (!r.ok) throw new Error(j.error || "Không tạo được đầu hàng")
      onCreated({ id: j.id, ten: j.ten, soNgayNo: Number(soNgay) || 0 })
      onChange(j.id)
      setMoi(false)
      setTen("")
    } catch (e: any) {
      setLoi(e.message)
    } finally {
      setDang(false)
    }
  }

  if (moi)
    return (
      <div className={cn("flex flex-wrap items-center gap-2", className)}>
        <Input
          autoFocus
          className="h-9 min-w-0 flex-1"
          placeholder="Tên đầu hàng mới"
          value={ten}
          onChange={(e) => setTen(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault()
              tao()
            }
            if (e.key === "Escape") setMoi(false)
          }}
        />
        {hienSoNgay && (
          <label className="flex items-center gap-1 text-xs text-muted-foreground">
            Nợ
            <Input className="h-9 w-16" inputMode="numeric" value={soNgay} onChange={(e) => setSoNgay(e.target.value.replace(/\D/g, ""))} />
            ngày
          </label>
        )}
        <Button type="button" size="sm" className="h-9" disabled={dang} onClick={tao}>
          {dang ? "Đang lưu…" : "Thêm"}
        </Button>
        <Button type="button" size="sm" variant="ghost" className="h-9" onClick={() => setMoi(false)}>
          Huỷ
        </Button>
        {loi && <span className="w-full text-xs text-red-600">{loi}</span>}
      </div>
    )
  return (
    <select
      className={cn("h-9 rounded-md border bg-background px-2 text-sm", className)}
      value={value}
      onChange={(e) => (e.target.value === MOI ? setMoi(true) : onChange(e.target.value))}
    >
      <option value="">Chọn đầu hàng</option>
      {dauHang.map((d) => (
        <option key={d.id} value={d.id}>
          {d.ten}
          {d.soNgayNo !== undefined ? ` (${d.soNgayNo} ngày nợ)` : ""}
        </option>
      ))}
      <option value={MOI}>+ Thêm đầu hàng mới…</option>
    </select>
  )
}
