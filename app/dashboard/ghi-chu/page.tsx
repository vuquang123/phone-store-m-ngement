// app/dashboard/ghi-chu/page.tsx
"use client"

import { useMemo, useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { ProtectedRoute } from "@/components/auth/protected-route"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { ResponsiveTable, CardField, type ResponsiveColumn } from "@/components/ui/responsive-table"
import { RefreshButton } from "@/components/ui/refresh-button"
import { useToast } from "@/hooks/use-toast"
import { Loader2, NotebookPen, CheckCircle2 } from "lucide-react"

type NoteStatus = "chua_xu_ly" | "hoan_thanh"
interface Note {
  id: string
  noiDung: string
  nguoiTao: string
  nguoiHoanThanh?: string
  createdAt: string
  completedAt?: string
  status: NoteStatus
}

const VN_TZ = "Asia/Ho_Chi_Minh"

function fmtDateTime(iso?: string): string {
  if (!iso) return "—"
  const d = new Date(iso)
  if (isNaN(d.getTime())) return iso
  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit", timeZone: VN_TZ,
  }).format(d)
}
function vnDayKey(iso?: string): string {
  if (!iso) return ""
  const d = new Date(iso)
  if (isNaN(d.getTime())) return ""
  // en-CA -> "yyyy-mm-dd"
  return new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", day: "2-digit", timeZone: VN_TZ }).format(d)
}

function StatusBadge({ status }: { status: NoteStatus }) {
  if (status === "hoan_thanh") {
    return <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-500/15 dark:text-emerald-400">Hoàn thành</Badge>
  }
  return <Badge className="bg-orange-100 text-orange-700 hover:bg-orange-100 dark:bg-orange-500/15 dark:text-orange-400">Chưa xử lý</Badge>
}

function GhiChuContent() {
  const qc = useQueryClient()
  const { toast } = useToast()
  const [noiDung, setNoiDung] = useState("")
  const [creating, setCreating] = useState(false)
  const [completingId, setCompletingId] = useState<string | null>(null)

  const { data, isLoading, isFetching, refetch } = useQuery<{ items: Note[] }>({
    queryKey: ["ghi-chu"],
    queryFn: async () => {
      const res = await fetch("/api/ghi-chu", { cache: "no-store" })
      const json = await res.json()
      if (!json?.success) throw new Error(json?.error || "Lỗi tải ghi chú")
      return { items: (json.items as Note[]) || [] }
    },
    staleTime: 30_000,
  })

  const notes = data?.items ?? []
  const todayKey = vnDayKey(new Date().toISOString())

  const chuaXuLy = useMemo(
    () => notes.filter((n) => n.status === "chua_xu_ly").sort((a, b) => (a.createdAt || "").localeCompare(b.createdAt || "")),
    [notes],
  )
  const homNay = useMemo(
    () => notes.filter((n) => vnDayKey(n.createdAt) === todayKey || vnDayKey(n.completedAt) === todayKey),
    [notes, todayKey],
  )
  const lichSu = useMemo(
    () =>
      notes
        .filter((n) => n.status === "hoan_thanh")
        .sort((a, b) => (b.completedAt || b.createdAt || "").localeCompare(a.completedAt || a.createdAt || "")),
    [notes],
  )

  async function handleCreate() {
    const value = noiDung.trim()
    if (!value) {
      toast({ title: "Nội dung trống", description: "Vui lòng nhập nội dung ghi chú", variant: "destructive" })
      return
    }
    setCreating(true)
    try {
      const res = await fetch("/api/ghi-chu", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ noiDung: value }),
      })
      const json = await res.json()
      if (!json?.success) throw new Error(json?.error || "Lỗi tạo ghi chú")
      setNoiDung("")
      toast({ title: "Đã tạo ghi chú", description: "Đã gửi thông báo bàn giao ca" })
      qc.invalidateQueries({ queryKey: ["ghi-chu"] })
    } catch (e: any) {
      toast({ title: "Tạo thất bại", description: String(e?.message || e), variant: "destructive" })
    } finally {
      setCreating(false)
    }
  }

  async function handleComplete(id: string) {
    setCompletingId(id)
    try {
      const res = await fetch("/api/ghi-chu", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      })
      const json = await res.json()
      if (!json?.success) throw new Error(json?.error || "Lỗi cập nhật")
      toast({ title: "Đã hoàn thành", description: "Ghi chú được đánh dấu hoàn thành" })
      qc.invalidateQueries({ queryKey: ["ghi-chu"] })
    } catch (e: any) {
      toast({ title: "Cập nhật thất bại", description: String(e?.message || e), variant: "destructive" })
    } finally {
      setCompletingId(null)
    }
  }

  /* --------------------------- cột cho từng bảng --------------------------- */
  const colNgayTao: ResponsiveColumn<Note> = {
    key: "createdAt", header: "Ngày tạo", className: "whitespace-nowrap",
    cell: (n) => fmtDateTime(n.createdAt),
  }
  const colNguoiTao: ResponsiveColumn<Note> = {
    key: "nguoiTao", header: "Người tạo", className: "whitespace-nowrap",
    cell: (n) => n.nguoiTao || "—",
  }
  const colNoiDung: ResponsiveColumn<Note> = {
    key: "noiDung", header: "Nội dung", className: "max-w-[420px]",
    cell: (n) => <span className="whitespace-pre-wrap break-words">{n.noiDung}</span>,
  }
  const colTrangThai: ResponsiveColumn<Note> = {
    key: "status", header: "Trạng thái", cell: (n) => <StatusBadge status={n.status} />,
  }
  const colNguoiHoanThanh: ResponsiveColumn<Note> = {
    key: "nguoiHoanThanh", header: "Người hoàn thành", className: "whitespace-nowrap",
    cell: (n) => n.nguoiHoanThanh || "—",
  }
  const colNgayHoanThanh: ResponsiveColumn<Note> = {
    key: "completedAt", header: "Ngày hoàn thành", className: "whitespace-nowrap",
    cell: (n) => fmtDateTime(n.completedAt),
  }
  const colHanhDong: ResponsiveColumn<Note> = {
    key: "action", header: "", className: "text-right",
    cell: (n) => (
      <Button size="sm" onClick={() => handleComplete(n.id)} disabled={completingId === n.id}>
        {completingId === n.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
        <span className="ml-1">Hoàn thành</span>
      </Button>
    ),
  }

  const rowKey = (n: Note) => n.id

  /* ------------------------------ render cards ----------------------------- */
  const renderChuaXuLyCard = (n: Note) => (
    <Card>
      <CardContent className="space-y-2 p-4">
        <p className="whitespace-pre-wrap break-words text-sm font-medium">{n.noiDung}</p>
        <CardField label="Ngày tạo">{fmtDateTime(n.createdAt)}</CardField>
        <CardField label="Người tạo">{n.nguoiTao || "—"}</CardField>
        <Button className="w-full" size="sm" onClick={() => handleComplete(n.id)} disabled={completingId === n.id}>
          {completingId === n.id ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-1 h-4 w-4" />}
          Hoàn thành
        </Button>
      </CardContent>
    </Card>
  )
  const renderHomNayCard = (n: Note) => (
    <Card>
      <CardContent className="space-y-2 p-4">
        <div className="flex items-start justify-between gap-2">
          <p className="whitespace-pre-wrap break-words text-sm font-medium">{n.noiDung}</p>
          <StatusBadge status={n.status} />
        </div>
        <CardField label="Ngày tạo">{fmtDateTime(n.createdAt)}</CardField>
        <CardField label="Người tạo">{n.nguoiTao || "—"}</CardField>
        <CardField label="Người hoàn thành">{n.nguoiHoanThanh || "—"}</CardField>
        <CardField label="Ngày hoàn thành">{fmtDateTime(n.completedAt)}</CardField>
      </CardContent>
    </Card>
  )
  const renderLichSuCard = (n: Note) => (
    <Card>
      <CardContent className="space-y-2 p-4">
        <p className="whitespace-pre-wrap break-words text-sm font-medium">{n.noiDung}</p>
        <CardField label="Ngày tạo">{fmtDateTime(n.createdAt)}</CardField>
        <CardField label="Người tạo">{n.nguoiTao || "—"}</CardField>
        <CardField label="Ngày hoàn thành">{fmtDateTime(n.completedAt)}</CardField>
        <CardField label="Người hoàn thành">{n.nguoiHoanThanh || "—"}</CardField>
      </CardContent>
    </Card>
  )

  const loadingBlock = (
    <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
      <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Đang tải…
    </div>
  )

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <NotebookPen className="h-6 w-6 text-primary" />
          <h1 className="text-xl font-semibold sm:text-2xl">Ghi chú bàn giao ca</h1>
        </div>
        <RefreshButton onRefresh={() => { refetch() }} loading={isFetching} label />
      </div>

      {/* Tạo nhanh */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Tạo ghi chú</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Textarea
            placeholder="Nội dung ghi chú (vấn đề cần ca sau xử lý)…"
            value={noiDung}
            onChange={(e) => setNoiDung(e.target.value)}
            rows={3}
          />
          <div className="flex justify-end">
            <Button onClick={handleCreate} disabled={creating}>
              {creating ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <NotebookPen className="mr-1 h-4 w-4" />}
              Tạo ghi chú
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 1) Chưa xử lý */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Chưa xử lý <span className="text-muted-foreground">({chuaXuLy.length})</span></CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? loadingBlock : (
            <ResponsiveTable<Note>
              columns={[colNgayTao, colNguoiTao, colNoiDung, colHanhDong]}
              data={chuaXuLy}
              rowKey={rowKey}
              renderCard={renderChuaXuLyCard}
              minWidth="min-w-[640px]"
              emptyText="Không có ghi chú nào đang chờ xử lý"
            />
          )}
        </CardContent>
      </Card>

      {/* 2) Hôm nay */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Hôm nay <span className="text-muted-foreground">({homNay.length})</span></CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? loadingBlock : (
            <ResponsiveTable<Note>
              columns={[colNgayTao, colNguoiTao, colNoiDung, colTrangThai, colNguoiHoanThanh, colNgayHoanThanh]}
              data={homNay}
              rowKey={rowKey}
              renderCard={renderHomNayCard}
              minWidth="min-w-[820px]"
              emptyText="Hôm nay chưa có ghi chú"
            />
          )}
        </CardContent>
      </Card>

      {/* 3) Lịch sử */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Lịch sử <span className="text-muted-foreground">({lichSu.length})</span></CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? loadingBlock : (
            <ResponsiveTable<Note>
              columns={[colNgayTao, colNguoiTao, colNoiDung, colNgayHoanThanh, colNguoiHoanThanh]}
              data={lichSu}
              rowKey={rowKey}
              renderCard={renderLichSuCard}
              minWidth="min-w-[760px]"
              emptyText="Chưa có ghi chú hoàn thành"
            />
          )}
        </CardContent>
      </Card>
    </div>
  )
}

export default function GhiChuPage() {
  return (
    <ProtectedRoute>
      <GhiChuContent />
    </ProtectedRoute>
  )
}
