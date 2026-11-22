"use client"
// Bộ lọc theo cột cho trang Sửa dữ liệu: chọn nhiều giá trị cùng lúc (OR trong một cột, AND giữa các cột).
import { useMemo, useState } from "react"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import { ChevronDown, X } from "lucide-react"

export const EMPTY_LABEL = "(trống)"
export const foldKey = (s: string) =>
  s.normalize("NFD").replace(/\p{Diacritic}/gu, "").replace(/đ/g, "d").replace(/Đ/g, "D").toLowerCase().replace(/\s+/g, " ").trim()

/** Khoá gom nhóm của một ô: không phân biệt hoa/thường, dấu cách thừa. Ô trống = "". */
export const cellKey = (v: string) => foldKey(v || "")

export type FacetValue = { key: string; label: string; count: number }

export function ColumnFilter({
  label,
  values,
  selected,
  onChange,
  onRemove,
  render,
}: {
  label: string
  values: FacetValue[]
  selected: string[]
  onChange: (next: string[]) => void
  onRemove?: () => void
  render?: (label: string) => React.ReactNode
}) {
  const [q, setQ] = useState("")
  const sel = new Set(selected)
  const shown = useMemo(() => {
    const t = foldKey(q)
    return values.filter((v) => !t || foldKey(v.label).includes(t))
  }, [values, q])
  const toggle = (k: string) => {
    const n = new Set(sel)
    if (n.has(k)) n.delete(k)
    else n.add(k)
    onChange([...n])
  }
  const active = selected.length > 0
  const summary = active
    ? selected.length === 1
      ? values.find((v) => v.key === selected[0])?.label ?? selected[0]
      : `${selected.length} giá trị`
    : ""

  return (
    <Popover onOpenChange={(o) => !o && setQ("")}>
      <PopoverTrigger asChild>
        <button
          className={cn(
            "inline-flex h-9 max-w-[260px] items-center gap-1 rounded-md border px-3 text-sm",
            active ? "border-blue-500 bg-blue-50 text-blue-800 dark:bg-blue-950 dark:text-blue-200" : "bg-background hover:bg-muted",
          )}
        >
          <span className="whitespace-nowrap">{label}</span>
          {active ? <span className="truncate font-semibold">: {summary || EMPTY_LABEL}</span> : null}
          <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-60" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 p-2">
        <Input autoFocus className="h-8" placeholder={`Tìm trong ${label.toLowerCase()}…`} value={q} onChange={(e) => setQ(e.target.value)} />
        <div className="mt-2 flex items-center justify-between text-xs">
          <button className="text-blue-600 hover:underline" onClick={() => onChange([...new Set([...selected, ...shown.map((v) => v.key)])])}>
            Chọn {q ? "các mục đang hiện" : "tất cả"}
          </button>
          <button className="text-muted-foreground hover:underline" onClick={() => onChange([])}>Bỏ chọn</button>
        </div>
        <div className="mt-1 max-h-72 overflow-auto">
          {shown.map((v) => (
            <label key={v.key} className="flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 text-sm hover:bg-muted">
              <input type="checkbox" checked={sel.has(v.key)} onChange={() => toggle(v.key)} />
              <span className="min-w-0 flex-1 truncate">{v.key === "" ? <i className="text-muted-foreground">{EMPTY_LABEL}</i> : render ? render(v.label) : v.label}</span>
              <span className="text-xs tabular-nums text-muted-foreground">{v.count}</span>
            </label>
          ))}
          {shown.length === 0 ? <div className="px-1.5 py-2 text-sm text-muted-foreground">Không có giá trị nào</div> : null}
        </div>
        {onRemove ? (
          <button className="mt-2 flex w-full items-center justify-center gap-1 border-t pt-2 text-xs text-muted-foreground hover:text-red-600" onClick={onRemove}>
            <X className="h-3 w-3" /> Bỏ bộ lọc này
          </button>
        ) : null}
      </PopoverContent>
    </Popover>
  )
}

/** Đọc ngày kiểu Sheet (8/10/2026, 2026-10-08, "16:45 22/11/2026") thành "yyyy-mm-dd" để so sánh. */
export function dayKey(raw: string): string {
  const s = String(raw || "").trim()
  const m = s.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/)
  if (m) return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/)
  return iso ? `${iso[1]}-${iso[2]}-${iso[3]}` : ""
}
