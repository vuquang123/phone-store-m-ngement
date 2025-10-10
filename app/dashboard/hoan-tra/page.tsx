"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Search, Eye, RotateCcw } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { useToast } from "@/hooks/use-toast"
import { formatDistanceToNow, parse } from "date-fns"
import { vi } from "date-fns/locale"

interface ReturnOrder {
  id: string
  ma_don_hang?: string
  khach_hang: string
  so_dien_thoai?: string
  san_pham?: string
  imei?: string
  ly_do?: string
  trang_thai?: string
  so_tien_hoan?: number
  ngay_yeu_cau?: string
  nguoi_xu_ly?: string
  ngay_xu_ly?: string
  ghi_chu?: string
}

export default function HoanTraPage() {
  const [returns, setReturns] = useState<ReturnOrder[]>([])
  const [filteredReturns, setFilteredReturns] = useState<ReturnOrder[]>([])
  const [searchTerm, setSearchTerm] = useState("")
  const [loading, setLoading] = useState(true)
  const { toast } = useToast()
  const [selected, setSelected] = useState<ReturnOrder | null>(null)
  const [open, setOpen] = useState(false)
  const dialogRef = useRef<HTMLDivElement | null>(null)
  const [updating, setUpdating] = useState(false)
  const [isManager, setIsManager] = useState(false)

  // Helper: get auth headers like other pages
  function getAuthHeaders(): Record<string, string> {
    try {
      const raw = localStorage.getItem("auth_user")
      const data = raw ? JSON.parse(raw) : {}
      if (typeof data?.email === "string") return { "x-user-email": data.email }
    } catch {}
    return {}
  }
  // local fetch so we can reuse on demand (after create)
  const fetchReturns = useCallback(async () => {
    setLoading(true)
    try {
      const response = await fetch("/api/hoan-tra", { cache: "no-store" })
      const result = await response.json()
      const data = Array.isArray(result.data) ? result.data : []
      const mapped: ReturnOrder[] = data.map((item: any, idx: number) => {
        const note: string = item.ghi_chu || item.ghiChu || ""
        let soTien = 0
        let maDon = ""
        try {
          const m1 = note.match(/Hoàn:\s*([\d\.]+)/i)
          if (m1 && m1[1]) soTien = Number(m1[1].replace(/\D/g, "")) || 0
          const m2 = note.match(/Mã\s*đơn:\s*(DH\d{5})/i)
          if (m2 && m2[1]) maDon = m2[1]
        } catch {}
        return {
          id: item.id || String(idx),
          ma_don_hang: item.ma_don_hang || maDon || "",
          khach_hang: item.khach_hang || "",
          so_dien_thoai: item.so_dien_thoai || "",
          san_pham: item.san_pham || "",
          imei: item.imei || "",
          ly_do: item.ly_do || "",
          trang_thai: item.trang_thai || "Đang xử lý",
          so_tien_hoan: soTien,
          ngay_yeu_cau: item.ngay_yeu_cau || "",
          nguoi_xu_ly: item.nguoi_xu_ly || "",
          ngay_xu_ly: item.ngay_xu_ly || "",
          ghi_chu: note,
        }
      })
      setReturns(mapped)
      setFilteredReturns(mapped)
    } catch (error) {
      setReturns([])
      setFilteredReturns([])
      toast({ title: "Lỗi tải dữ liệu hoàn trả", description: String(error), variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => {
    fetchReturns()
  }, [fetchReturns])

  // Resolve role to hide complete button for non-managers
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/auth/me", { cache: "no-store", headers: getAuthHeaders() })
        if (res.ok) {
          const me = await res.json()
          setIsManager(me?.role === "quan_ly")
        } else {
          setIsManager(false)
        }
      } catch {
        setIsManager(false)
      }
    })()
  }, [])

  useEffect(() => {
    const s = searchTerm.trim().toLowerCase()
    const filtered = returns.filter((r) => {
      if (!s) return true
      return (
        (r.ma_don_hang || "").toLowerCase().includes(s) ||
        (r.khach_hang || "").toLowerCase().includes(s) ||
        (r.san_pham || "").toLowerCase().includes(s) ||
        (r.so_dien_thoai || "").toLowerCase().includes(s) ||
        (r.imei || "").toLowerCase().includes(s)
      )
    })
    setFilteredReturns(filtered)
  }, [returns, searchTerm])

  const getStatusBadge = (status?: string) => {
    const s = (status || '').toLowerCase()
    if (s.includes('xử lý') || s.includes('dang')) return <Badge variant="secondary">Đang xử lý</Badge>
    if (s.includes('hoàn') || s.includes('thành')) return <Badge className="bg-green-500">Đã hoàn tất</Badge>
    if (s.includes('từ chối')) return <Badge variant="destructive">Từ chối</Badge>
    return <Badge variant="outline">—</Badge>
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("vi-VN", {
      style: "currency",
      currency: "VND",
    }).format(amount)
  }

  // Parse chuỗi ngày dạng VN (dd/MM/yyyy[, ]HH:mm:ss) sang Date an toàn
  function parseVNDate(input?: string | null): Date | null {
    if (!input) return null
    const s = String(input).trim()
    if (!s) return null
    // Numeric timestamp
    if (/^\d{10,}$/.test(s)) {
      const t = Number(s)
      if (Number.isFinite(t)) return new Date(t)
    }
    const candidates = [
      "dd/MM/yyyy, HH:mm:ss",
      "dd/MM/yyyy HH:mm:ss",
      "dd/MM/yyyy, HH:mm",
      "dd/MM/yyyy HH:mm",
      "dd/MM/yyyy",
    ] as const
    for (const fmt of candidates) {
      try {
        const d = parse(s, fmt, new Date())
        if (!isNaN(d.getTime())) return d
      } catch {}
    }
    // Fallback (ít tin cậy trên mobile/Safari)
    try {
      const d = new Date(s)
      if (!isNaN(d.getTime())) return d
    } catch {}
    return null
  }

  function relativeFromNowSafe(input?: string | null): string {
    try {
      const d = parseVNDate(input)
      if (!d) return ""
      return formatDistanceToNow(d, { addSuffix: true, locale: vi })
    } catch {
      return ""
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="mt-2 text-muted-foreground">Đang tải...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Hoàn trả</h1>
          <p className="text-muted-foreground">Quản lý các yêu cầu hoàn trả từ khách hàng</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={fetchReturns} title="Làm mới danh sách">
            <RotateCcw className="w-4 h-4 mr-2" />
            Làm mới
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Danh sách hoàn trả</CardTitle>
          <CardDescription>Tổng cộng {returns.length} yêu cầu hoàn trả</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center space-x-2 mb-4">
            <Search className="w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Tìm kiếm theo mã đơn hàng, khách hàng hoặc sản phẩm..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="max-w-sm"
            />
          </div>

          <div className="space-y-4">
            {filteredReturns.map((r) => (
              <div key={r.id} className="p-4 border rounded-lg hover:bg-muted/50">
                {/* Header: Mã đơn + Trạng thái */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="p-2 bg-orange-100 rounded-lg">
                      <RotateCcw className="h-5 w-5 text-orange-600" />
                    </div>
                    <h3 className="font-semibold tracking-tight">{r.ma_don_hang || r.id}</h3>
                  </div>
                  {getStatusBadge(r.trang_thai)}
                </div>

                {/* Body: thông tin chính */}
                <div className="mt-2 grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-3">
                  <div className="space-y-1 text-sm">
                    <div className="text-slate-700">
                      <span className="font-medium">{r.khach_hang}</span>
                      {r.so_dien_thoai && <span className="text-muted-foreground"> • {r.so_dien_thoai}</span>}
                    </div>
                    {(r.san_pham || r.imei) && (
                      <div className="text-muted-foreground">
                        {r.san_pham && <span>{r.san_pham}</span>}
                        {r.imei && <span>{r.san_pham ? ' • ' : ''}IMEI: {r.imei}</span>}
                      </div>
                    )}
                    {typeof r.so_tien_hoan === 'number' && r.so_tien_hoan > 0 && (
                      <div className="font-semibold text-red-600">{formatCurrency(r.so_tien_hoan)}</div>
                    )}
                  </div>
                  <div className="flex items-start sm:items-end justify-between sm:flex-col sm:justify-end sm:text-right gap-3">
                    <div className="text-xs text-muted-foreground">{relativeFromNowSafe(r.ngay_yeu_cau)}</div>
                    {r.ly_do && <div className="text-xs text-slate-600">{r.ly_do}</div>}
                    <Button
                      variant="outline"
                      size="sm"
                      className="shrink-0"
                      onClick={() => { setSelected(r); setOpen(true) }}
                    >
                      <Eye className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {filteredReturns.length === 0 && (
            <div className="text-center py-16 bg-white rounded-lg">
              <h3 className="text-lg font-medium mb-2">Chưa có yêu cầu hoàn trả nào</h3>
              <p className="text-sm text-muted-foreground">Khi có yêu cầu hoàn trả, nội dung sẽ hiển thị tại đây.</p>
            </div>
          )}
        </CardContent>
      </Card>
      {/* Chi tiết hoàn trả: hiển thị Dialog giữa màn hình cho cả mobile/desktop */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          ref={dialogRef}
          tabIndex={-1}
          onOpenAutoFocus={() => {
            // Đảm bảo focus nhảy vào Dialog khi mở để tránh cảnh báo aria-hidden
            dialogRef.current?.focus()
          }}
        >
          <DialogHeader>
            <DialogTitle>Chi tiết hoàn trả</DialogTitle>
            {selected?.ma_don_hang && (
              <DialogDescription>Mã đơn: {selected.ma_don_hang}</DialogDescription>
            )}
          </DialogHeader>
          <div className="space-y-2 text-sm">
            <div><span className="text-slate-500">Khách hàng:</span> <span className="font-medium">{selected?.khach_hang || '-'}</span></div>
            {selected?.so_dien_thoai && <div><span className="text-slate-500">SĐT:</span> {selected.so_dien_thoai}</div>}
            {selected?.san_pham && <div><span className="text-slate-500">Sản phẩm:</span> {selected.san_pham}</div>}
            {selected?.imei && <div><span className="text-slate-500">IMEI:</span> {selected.imei}</div>}
            {typeof selected?.so_tien_hoan === 'number' && selected?.so_tien_hoan! > 0 && (
              <div className="text-red-600 font-semibold">Số tiền hoàn: {new Intl.NumberFormat('vi-VN',{style:'currency',currency:'VND'}).format(selected!.so_tien_hoan!)}</div>
            )}
            {selected?.ly_do && <div><span className="text-slate-500">Lý do:</span> {selected.ly_do}</div>}
            {selected?.trang_thai && <div><span className="text-slate-500">Trạng thái:</span> {selected.trang_thai}</div>}
            {selected?.nguoi_xu_ly && <div><span className="text-slate-500">Người xử lý:</span> {selected.nguoi_xu_ly}</div>}
            {selected?.ngay_xu_ly && <div><span className="text-slate-500">Ngày xử lý:</span> {selected.ngay_xu_ly}</div>}
            {selected?.ghi_chu && <div className="whitespace-pre-wrap"><span className="text-slate-500">Ghi chú:</span> {selected.ghi_chu}</div>}
          </div>
          <div className="mt-4 flex items-center justify-end gap-2">
            {isManager && (selected?.trang_thai || '').toLowerCase().includes('xử lý') && (
              <Button
                disabled={updating}
                onClick={async () => {
                  if (!selected) return
                  setUpdating(true)
                  try {
                    const res = await fetch('/api/hoan-tra', {
                      method: 'PATCH',
                      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
                      body: JSON.stringify({ id: selected.id, action: 'complete' })
                    })
                    const data = await res.json()
                    if (!res.ok) throw new Error(data.error || 'Cập nhật thất bại')
                    // reload list
                    await fetchReturns()
                    setOpen(false)
                  } catch (e: any) {
                    console.error(e)
                    alert(e?.message || 'Lỗi cập nhật')
                  } finally {
                    setUpdating(false)
                  }
                }}
                className="bg-green-600 text-white hover:bg-green-700"
              >
                {updating ? 'Đang cập nhật...' : 'Đánh dấu Hoàn thành'}
              </Button>
            )}
            <Button variant="outline" onClick={() => setOpen(false)}>Đóng</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
 
