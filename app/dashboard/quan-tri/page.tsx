// app/dashboard/quan-tri/page.tsx
// Trang "Quản trị dữ liệu": sửa kho hàng, phụ kiện, khách hàng... như một bảng tính.
// - Bấm vào ô để sửa (Enter: lưu tạm & xuống dòng, Tab: sang phải, Esc: huỷ).
// - Ô đã sửa tô vàng; bấm "Lưu" để ghi tất cả một lần. Nếu người khác vừa sửa cùng ô thì báo xung đột.
// - Chọn nhiều dòng để sửa hàng loạt / xoá. Xuất & nhập file CSV (mở bằng Excel).
"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { ProtectedRoute } from "@/components/auth/protected-route"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { useToast } from "@/hooks/use-toast"
import {
  Download,
  Loader2,
  Plus,
  RefreshCw,
  Save,
  Search,
  Trash2,
  Undo2,
  Upload,
  Wand2,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
} from "lucide-react"

type Row = { rowNumber: number; cells: string[] }
type TableData = { table: string; label: string; header: (string | null)[]; rows: Row[]; loadedAt: string }
type Edits = Record<string, string> // key `${rowNumber}:${col}` -> giá trị mới

const PAGE_SIZE = 100
/** Cột do hệ thống tự ghi, không hiện trong form thêm dòng (so khớp không dấu, chữ thường). */
const INTERNAL_COLUMNS = ["dang xu ly", "tg msg xu ly"]
const ALL = "__all__"
const ek = (row: number, col: number) => `${row}:${col}`

/* ------------------------------ CSV ------------------------------ */
function toCsv(header: string[], rows: string[][]): string {
  const esc = (v: string) => (/[",\n\r;]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v)
  return "﻿" + [header, ...rows].map((r) => r.map((v) => esc(String(v ?? ""))).join(",")).join("\r\n")
}
function parseCsv(text: string): string[][] {
  const s = text.replace(/^﻿/, "")
  // Excel tiếng Việt hay lưu CSV bằng dấu ";" — đoán theo dòng đầu
  const firstLine = s.split(/\r?\n/, 1)[0] || ""
  const sep = (firstLine.match(/;/g) || []).length > (firstLine.match(/,/g) || []).length ? ";" : ","
  const out: string[][] = []
  let row: string[] = []
  let cur = ""
  let inQ = false
  for (let i = 0; i < s.length; i++) {
    const ch = s[i]
    if (inQ) {
      if (ch === '"' && s[i + 1] === '"') { cur += '"'; i++ }
      else if (ch === '"') inQ = false
      else cur += ch
    } else if (ch === '"') inQ = true
    else if (ch === sep) { row.push(cur); cur = "" }
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && s[i + 1] === "\n") i++
      row.push(cur); out.push(row); row = []; cur = ""
    } else cur += ch
  }
  if (cur !== "" || row.length) { row.push(cur); out.push(row) }
  return out.filter((r) => r.some((v) => v.trim() !== ""))
}
function download(name: string, content: string) {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = name
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
const fold = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D").toLowerCase()

/* ------------------------------ API ------------------------------ */
async function api(body?: any, query = "") {
  const res = await fetch(`/api/quan-tri${query}`, {
    method: body ? "POST" : "GET",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(json?.error || `Lỗi ${res.status}`)
  return json
}

export default function QuanTriPage() {
  return (
    <ProtectedRoute requiredRole="quan_ly">
      <DataAdmin />
    </ProtectedRoute>
  )
}

function DataAdmin() {
  const { toast } = useToast()
  const [tables, setTables] = useState<{ id: string; label: string }[]>([])
  const [table, setTable] = useState("Kho_Hang")
  const [data, setData] = useState<TableData | null>(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [edits, setEdits] = useState<Edits>({})
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState(ALL)
  const [sort, setSort] = useState<{ col: number; dir: 1 | -1 } | null>(null)
  const [page, setPage] = useState(0)
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [editing, setEditing] = useState<{ row: number; col: number } | null>(null)
  const [draft, setDraft] = useState("")
  const [bulkOpen, setBulkOpen] = useState(false)
  const [bulkCol, setBulkCol] = useState<string>("")
  const [bulkVal, setBulkVal] = useState("")
  const [addOpen, setAddOpen] = useState(false)
  const [addVals, setAddVals] = useState<Record<string, string>>({})
  const [delOpen, setDelOpen] = useState(false)
  const [importPlan, setImportPlan] = useState<{ rows: Record<string, string>[]; summary: any } | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const dirtyCount = Object.keys(edits).length

  /* ----- tải dữ liệu ----- */
  const load = useCallback(
    async (t = table) => {
      setLoading(true)
      try {
        const d = (await api(undefined, `?table=${encodeURIComponent(t)}`)) as TableData
        setData(d)
        setEdits({})
        setSelected(new Set())
        setEditing(null)
      } catch (e: any) {
        toast({ title: "Không tải được dữ liệu", description: e.message, variant: "destructive" as any })
      } finally {
        setLoading(false)
      }
    },
    [table, toast],
  )

  useEffect(() => {
    api(undefined, "?list=1").then((r) => setTables(r.tables || [])).catch(() => {})
  }, [])
  useEffect(() => {
    load(table)
    setSearch("")
    setStatusFilter(ALL)
    setSort(null)
    setPage(0)
  }, [table]) // eslint-disable-line react-hooks/exhaustive-deps

  // Nhắc khi rời trang mà chưa lưu
  useEffect(() => {
    const h = (e: BeforeUnloadEvent) => {
      if (dirtyCount) { e.preventDefault(); e.returnValue = "" }
    }
    window.addEventListener("beforeunload", h)
    return () => window.removeEventListener("beforeunload", h)
  }, [dirtyCount])

  const header = useMemo(() => data?.header || [], [data])
  const visibleCols = useMemo(() => header.map((h, i) => (h === null ? -1 : i)).filter((i) => i >= 0), [header])
  const statusCol = useMemo(() => header.findIndex((h) => fold(String(h || "").trim()) === "trang thai"), [header])
  const statusValues = useMemo(() => {
    if (statusCol < 0 || !data) return []
    const m = new Map<string, number>()
    for (const r of data.rows) {
      const v = r.cells[statusCol]?.trim() || "(trống)"
      m.set(v, (m.get(v) || 0) + 1)
    }
    return Array.from(m.entries()).sort((a, b) => b[1] - a[1])
  }, [data, statusCol])

  const valueOf = useCallback((r: Row, c: number) => edits[ek(r.rowNumber, c)] ?? r.cells[c] ?? "", [edits])

  const filtered = useMemo(() => {
    if (!data) return []
    const terms = fold(search.trim()).split(/\s+/).filter(Boolean)
    let list = data.rows.filter((r) => {
      if (statusFilter !== ALL) {
        const v = r.cells[statusCol]?.trim() || "(trống)"
        if (v !== statusFilter) return false
      }
      if (!terms.length) return true
      const hay = fold(visibleCols.map((c) => valueOf(r, c)).join(" "))
      return terms.every((t) => hay.includes(t))
    })
    if (sort) {
      const num = (s: string) => {
        const d = s.replace(/[^\d-]/g, "")
        return d && /^-?\d+$/.test(d) && /^[\d\s.,đ%-]+$/i.test(s.trim()) ? Number(d) : NaN
      }
      list = [...list].sort((a, b) => {
        const x = valueOf(a, sort.col), y = valueOf(b, sort.col)
        const nx = num(x), ny = num(y)
        const cmp = !isNaN(nx) && !isNaN(ny) ? nx - ny : x.localeCompare(y, "vi", { numeric: true })
        return cmp * sort.dir
      })
    } else {
      list = [...list].reverse() // mới nhất lên đầu
    }
    return list
  }, [data, search, statusFilter, statusCol, sort, visibleCols, valueOf])

  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const pageRows = filtered.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE)
  useEffect(() => { if (page >= pages) setPage(0) }, [pages, page])

  /* ----- sửa ô ----- */
  const startEdit = (row: Row, col: number) => {
    setEditing({ row: row.rowNumber, col })
    setDraft(valueOf(row, col))
  }
  const commit = (move?: "down" | "right" | "left") => {
    if (!editing || !data) return
    const r = data.rows.find((x) => x.rowNumber === editing.row)
    if (r) {
      const orig = r.cells[editing.col] ?? ""
      setEdits((prev) => {
        const next = { ...prev }
        if (draft === orig) delete next[ek(editing.row, editing.col)]
        else next[ek(editing.row, editing.col)] = draft
        return next
      })
    }
    if (!move || !r) return setEditing(null)
    const idx = pageRows.findIndex((x) => x.rowNumber === editing.row)
    const ci = visibleCols.indexOf(editing.col)
    let target: { row: Row; col: number } | null = null
    if (move === "down" && pageRows[idx + 1]) target = { row: pageRows[idx + 1], col: editing.col }
    if (move === "right" && visibleCols[ci + 1] !== undefined) target = { row: r, col: visibleCols[ci + 1] }
    if (move === "left" && ci > 0) target = { row: r, col: visibleCols[ci - 1] }
    if (target) startEdit(target.row, target.col)
    else setEditing(null)
  }

  /* ----- lưu ----- */
  const save = async () => {
    if (!data || !dirtyCount) return
    setSaving(true)
    try {
      const changes = Object.entries(edits).map(([k, value]) => {
        const [row, col] = k.split(":").map(Number)
        const r = data.rows.find((x) => x.rowNumber === row)
        return { row, col, old: r?.cells[col] ?? "", value }
      })
      const res = await api({ action: "update", table, changes })
      if (res.conflicts?.length) {
        toast({
          title: `Đã lưu ${res.saved} ô, ${res.conflicts.length} ô bị xung đột`,
          description: "Có người vừa sửa các ô này. Dữ liệu đã được tải lại, vui lòng kiểm tra và sửa lại nếu cần.",
          variant: "destructive" as any,
        })
      } else {
        toast({ title: `Đã lưu ${res.saved} ô` })
      }
      await load()
    } catch (e: any) {
      toast({ title: "Lưu thất bại", description: e.message, variant: "destructive" as any })
    } finally {
      setSaving(false)
    }
  }

  /* ----- sửa hàng loạt ----- */
  const applyBulk = () => {
    const col = Number(bulkCol)
    if (!data || !Number.isInteger(col) || !selected.size) return
    setEdits((prev) => {
      const next = { ...prev }
      for (const r of data.rows) {
        if (!selected.has(r.rowNumber)) continue
        if ((r.cells[col] ?? "") === bulkVal) delete next[ek(r.rowNumber, col)]
        else next[ek(r.rowNumber, col)] = bulkVal
      }
      return next
    })
    setBulkOpen(false)
    toast({ title: `Đã điền "${bulkVal}" cho ${selected.size} dòng`, description: "Bấm Lưu để ghi vào hệ thống." })
  }

  /* ----- xoá dòng ----- */
  const doDelete = async () => {
    if (!data) return
    setSaving(true)
    try {
      const rows = data.rows.filter((r) => selected.has(r.rowNumber)).map((r) => ({ row: r.rowNumber, cells: r.cells }))
      const res = await api({ action: "delete", table, rows })
      toast({
        title: `Đã xoá ${res.deleted} dòng`,
        description: res.conflicts?.length ? `${res.conflicts.length} dòng vừa bị người khác thay đổi nên không xoá.` : undefined,
      })
      setDelOpen(false)
      await load()
    } catch (e: any) {
      toast({ title: "Xoá thất bại", description: e.message, variant: "destructive" as any })
    } finally {
      setSaving(false)
    }
  }

  /* ----- thêm dòng ----- */
  const doAdd = async () => {
    setSaving(true)
    try {
      const res = await api({ action: "append", table, rows: [addVals] })
      toast({ title: res.added ? "Đã thêm 1 dòng" : "Chưa nhập thông tin nào" })
      setAddOpen(false)
      setAddVals({})
      await load()
    } catch (e: any) {
      toast({ title: "Thêm thất bại", description: e.message, variant: "destructive" as any })
    } finally {
      setSaving(false)
    }
  }

  /* ----- xuất / nhập ----- */
  const exportCsv = () => {
    if (!data) return
    const cols = visibleCols
    const csv = toCsv(cols.map((c) => String(header[c])), filtered.map((r) => cols.map((c) => valueOf(r, c))))
    const stamp = new Date().toISOString().slice(0, 10)
    download(`${table}-${stamp}.csv`, csv)
  }
  const onFile = async (f?: File | null) => {
    if (!f || !data) return
    try {
      const grid = parseCsv(await f.text())
      if (grid.length < 2) throw new Error("File không có dữ liệu")
      const fileHeader = grid[0].map((h) => h.trim())
      const known = new Set(header.filter(Boolean).map((h) => String(h).trim()))
      const cols = fileHeader.map((h) => (known.has(h) ? h : null))
      if (!cols.some(Boolean)) throw new Error("Tiêu đề cột trong file không khớp với bảng. Hãy dùng file Xuất CSV làm mẫu.")
      // map tên cột đã trim về đúng tên gốc trên bảng
      const original = new Map(header.filter(Boolean).map((h) => [String(h).trim(), String(h)]))
      const rows = grid.slice(1).map((r) => {
        const o: Record<string, string> = {}
        cols.forEach((h, i) => { if (h) o[original.get(h)!] = r[i] ?? "" })
        return o
      })
      const summary = await api({ action: "import", table, rows, dryRun: true })
      setImportPlan({ rows, summary: { ...summary, ignored: fileHeader.filter((_, i) => !cols[i]) } })
    } catch (e: any) {
      toast({ title: "Không đọc được file", description: e.message, variant: "destructive" as any })
    } finally {
      if (fileRef.current) fileRef.current.value = ""
    }
  }
  const doImport = async () => {
    if (!importPlan) return
    setSaving(true)
    try {
      const res = await api({ action: "import", table, rows: importPlan.rows })
      toast({ title: "Nhập file xong", description: `Cập nhật ${res.updatedRows} dòng, thêm ${res.added} dòng mới.` })
      setImportPlan(null)
      await load()
    } catch (e: any) {
      toast({ title: "Nhập file thất bại", description: e.message, variant: "destructive" as any })
    } finally {
      setSaving(false)
    }
  }

  const allOnPageSelected = pageRows.length > 0 && pageRows.every((r) => selected.has(r.rowNumber))
  const toggleAllOnPage = () =>
    setSelected((prev) => {
      const next = new Set(prev)
      if (allOnPageSelected) pageRows.forEach((r) => next.delete(r.rowNumber))
      else pageRows.forEach((r) => next.add(r.rowNumber))
      return next
    })

  return (
    <div className="space-y-3 p-2 md:p-4">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="mr-2 text-xl font-semibold">Quản trị dữ liệu</h1>
        <Select
          value={table}
          onValueChange={(v) => {
            if (dirtyCount && !confirm(`Có ${dirtyCount} ô chưa lưu. Bỏ các thay đổi này?`)) return
            setTable(v)
          }}
        >
          <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            {(tables.length ? tables : [{ id: "Kho_Hang", label: "Kho hàng" }]).map((t) => (
              <SelectItem key={t.id} value={t.id}>{t.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button variant="outline" size="sm" onClick={() => load()} disabled={loading}>
          {loading ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-1 h-4 w-4" />} Tải lại
        </Button>
        <div className="ml-auto flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => setAddOpen(true)} disabled={!data}>
            <Plus className="mr-1 h-4 w-4" /> Thêm dòng
          </Button>
          <Button variant="outline" size="sm" onClick={exportCsv} disabled={!data}>
            <Download className="mr-1 h-4 w-4" /> Xuất Excel (CSV)
          </Button>
          <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()} disabled={!data}>
            <Upload className="mr-1 h-4 w-4" /> Nhập file
          </Button>
          <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full max-w-sm">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input className="pl-8" placeholder="Tìm IMEI, tên máy, khách..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(0) }} />
        </div>
        {statusCol >= 0 && (
          <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(0) }}>
            <SelectTrigger className="w-[200px]"><SelectValue placeholder="Trạng thái" /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Mọi trạng thái</SelectItem>
              {statusValues.map(([v, n]) => (
                <SelectItem key={v} value={v}>{v} ({n})</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        <span className="text-sm text-muted-foreground">{filtered.length} dòng</span>
        {selected.size > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary" className="whitespace-nowrap">Đã chọn {selected.size}</Badge>
            <Button size="sm" variant="outline" onClick={() => { setBulkCol(String(visibleCols[0] ?? "")); setBulkVal(""); setBulkOpen(true) }}>
              <Wand2 className="mr-1 h-4 w-4" /> Sửa hàng loạt
            </Button>
            <Button size="sm" variant="outline" className="text-red-600" onClick={() => setDelOpen(true)}>
              <Trash2 className="mr-1 h-4 w-4" /> Xoá
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>Bỏ chọn</Button>
          </div>
        )}
      </div>

      {dirtyCount > 0 && (
        <div className="sticky top-0 z-30 flex items-center gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-100">
          <span>Có <b>{dirtyCount}</b> ô đã sửa, chưa lưu.</span>
          <Button size="sm" onClick={save} disabled={saving} className="ml-auto">
            {saving ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Save className="mr-1 h-4 w-4" />} Lưu
          </Button>
          <Button size="sm" variant="outline" onClick={() => setEdits({})} disabled={saving}>
            <Undo2 className="mr-1 h-4 w-4" /> Huỷ thay đổi
          </Button>
        </div>
      )}

      <div className="overflow-auto rounded-md border" style={{ maxHeight: "calc(100vh - 260px)" }}>
        {!data ? (
          <div className="flex items-center justify-center p-10 text-muted-foreground">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Đang tải...
          </div>
        ) : (
          <table className="w-max min-w-full border-collapse text-sm">
            <thead className="sticky top-0 z-20 bg-muted">
              <tr>
                <th className="sticky left-0 z-30 w-10 border-b bg-muted px-2 py-2">
                  <Checkbox checked={allOnPageSelected} onCheckedChange={toggleAllOnPage} aria-label="Chọn tất cả" />
                </th>
                {visibleCols.map((c) => (
                  <th
                    key={c}
                    className="cursor-pointer select-none whitespace-nowrap border-b px-2 py-2 text-left font-medium"
                    onClick={() => setSort((s) => (s?.col === c ? (s.dir === 1 ? { col: c, dir: -1 } : null) : { col: c, dir: 1 }))}
                  >
                    <span className="inline-flex items-center gap-1">
                      {header[c] || <i className="text-muted-foreground">(cột {c + 1})</i>}
                      <ArrowUpDown className={`h-3 w-3 ${sort?.col === c ? "opacity-100" : "opacity-30"}`} />
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pageRows.map((r) => (
                <tr key={r.rowNumber} className={selected.has(r.rowNumber) ? "bg-blue-50 dark:bg-blue-950/40" : "hover:bg-muted/40"}>
                  <td className="sticky left-0 z-10 border-b bg-background px-2 py-1">
                    <Checkbox
                      checked={selected.has(r.rowNumber)}
                      onCheckedChange={() =>
                        setSelected((prev) => {
                          const next = new Set(prev)
                          next.has(r.rowNumber) ? next.delete(r.rowNumber) : next.add(r.rowNumber)
                          return next
                        })
                      }
                    />
                  </td>
                  {visibleCols.map((c) => {
                    const isEditing = editing?.row === r.rowNumber && editing.col === c
                    const dirty = ek(r.rowNumber, c) in edits
                    const v = valueOf(r, c)
                    return (
                      <td
                        key={c}
                        className={`max-w-[260px] border-b border-l px-0 py-0 align-top ${dirty ? "bg-amber-100 dark:bg-amber-900/50" : ""}`}
                        onClick={() => !isEditing && startEdit(r, c)}
                        title={v}
                      >
                        {isEditing ? (
                          <input
                            autoFocus
                            className="w-full min-w-[120px] bg-white px-2 py-1 outline outline-2 outline-blue-500 dark:bg-zinc-900"
                            value={draft}
                            onChange={(e) => setDraft(e.target.value)}
                            onBlur={() => commit()}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") { e.preventDefault(); commit("down") }
                              else if (e.key === "Tab") { e.preventDefault(); commit(e.shiftKey ? "left" : "right") }
                              else if (e.key === "Escape") { e.preventDefault(); setEditing(null) }
                            }}
                          />
                        ) : (
                          <div className="min-h-[28px] cursor-text truncate px-2 py-1">{v}</div>
                        )}
                      </td>
                    )
                  })}
                </tr>
              ))}
              {!pageRows.length && (
                <tr><td colSpan={visibleCols.length + 1} className="p-8 text-center text-muted-foreground">Không có dòng nào</td></tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {pages > 1 && (
        <div className="flex items-center justify-end gap-2 text-sm">
          <Button size="sm" variant="outline" disabled={page === 0} onClick={() => setPage((p) => p - 1)}><ChevronLeft className="h-4 w-4" /></Button>
          <span>Trang {page + 1}/{pages}</span>
          <Button size="sm" variant="outline" disabled={page >= pages - 1} onClick={() => setPage((p) => p + 1)}><ChevronRight className="h-4 w-4" /></Button>
        </div>
      )}

      {/* Sửa hàng loạt */}
      <Dialog open={bulkOpen} onOpenChange={setBulkOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Sửa hàng loạt {selected.size} dòng</DialogTitle>
            <DialogDescription>Điền cùng một giá trị vào một cột cho các dòng đã chọn. Bấm Lưu sau đó để ghi.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Select value={bulkCol} onValueChange={setBulkCol}>
              <SelectTrigger><SelectValue placeholder="Chọn cột" /></SelectTrigger>
              <SelectContent>
                {visibleCols.map((c) => <SelectItem key={c} value={String(c)}>{header[c] || `(cột ${c + 1})`}</SelectItem>)}
              </SelectContent>
            </Select>
            <Input placeholder="Giá trị mới (để trống = xoá nội dung ô)" value={bulkVal} onChange={(e) => setBulkVal(e.target.value)} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkOpen(false)}>Đóng</Button>
            <Button onClick={applyBulk} disabled={bulkCol === ""}>Điền vào bảng</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Xoá */}
      <Dialog open={delOpen} onOpenChange={setDelOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Xoá {selected.size} dòng?</DialogTitle>
            <DialogDescription>Không hoàn tác được trên web (bản sao lưu hằng đêm vẫn còn). Nên Xuất CSV trước khi xoá nhiều.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDelOpen(false)}>Huỷ</Button>
            <Button variant="destructive" onClick={doDelete} disabled={saving}>
              {saving && <Loader2 className="mr-1 h-4 w-4 animate-spin" />} Xoá
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Thêm dòng */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-5xl">
          <DialogHeader className="space-y-1">
            <DialogTitle>Thêm dòng vào {data?.label}</DialogTitle>
            <DialogDescription>Nhập máy mới số lượng lớn thì dùng màn hình Nhập hàng hoặc Nhập file.</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-x-3 gap-y-2 md:grid-cols-4">
            {visibleCols.map((c) => {
              const h = String(header[c] || "")
              // bỏ các cột hệ thống tự điền (Telegram, đang xử lý)
              if (!h.trim() || INTERNAL_COLUMNS.includes(fold(h.trim()))) return null
              return (
                <label key={c} className="text-[11px] font-medium text-muted-foreground">
                  {h.trim()}
                  <Input className="mt-0.5 h-8 text-sm" value={addVals[h] || ""} onChange={(e) => setAddVals((p) => ({ ...p, [h]: e.target.value }))} />
                </label>
              )
            })}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>Huỷ</Button>
            <Button onClick={doAdd} disabled={saving}>{saving && <Loader2 className="mr-1 h-4 w-4 animate-spin" />} Thêm</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Xác nhận nhập file */}
      <Dialog open={!!importPlan} onOpenChange={(o) => !o && setImportPlan(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nhập file vào {data?.label}</DialogTitle>
            <DialogDescription>Đối chiếu theo cột “{importPlan?.summary?.key}”. Dòng trùng khoá sẽ được cập nhật, dòng chưa có sẽ được thêm mới.</DialogDescription>
          </DialogHeader>
          {importPlan && (
            <ul className="list-disc space-y-1 pl-5 text-sm">
              <li>Cập nhật <b>{importPlan.summary.updatedRows}</b> dòng ({importPlan.summary.updatedCells} ô thay đổi)</li>
              <li>Thêm mới <b>{importPlan.summary.added}</b> dòng</li>
              {importPlan.summary.ignored?.length > 0 && (
                <li className="text-muted-foreground">Bỏ qua cột không có trên bảng: {importPlan.summary.ignored.join(", ")}</li>
              )}
            </ul>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setImportPlan(null)}>Huỷ</Button>
            <Button onClick={doImport} disabled={saving || (!importPlan?.summary?.updatedCells && !importPlan?.summary?.added)}>
              {saving && <Loader2 className="mr-1 h-4 w-4 animate-spin" />} Nhập
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
