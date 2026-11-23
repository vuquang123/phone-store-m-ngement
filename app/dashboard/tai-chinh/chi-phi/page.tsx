"use client"
// Tài chính · Chi phí ngoài: nhập nhanh quảng cáo, phụ kiện lẻ, ship đơn ngoài... Trừ vào lãi tháng (và lãi lô nếu gắn lô).
import { useCallback, useEffect, useState } from "react"
import { ProtectedRoute } from "@/components/auth/protected-route"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"
import { DangTai, KhungTrang, OTien, The, goiApi, homNayISO, ngayVN, vnd } from "@/components/tai-chinh/chung"

type Dong = { id: string; ngay: string; loai: string; soTien: number; maDon: string; maLo: string; nguonTien: string; ghiChu: string; nguoiGhi: string; daHuy: boolean; trangThai: string }
type Data = { thang: string; ds: Dong[]; theoLoai: Record<string, number>; tong: number; loai: string[]; nguonTien: { id: string; name: string; balance: number }[] }

function Trang() {
  const { toast } = useToast()
  const [thang, setThang] = useState(homNayISO().slice(0, 7))
  const [d, setD] = useState<Data | null>(null)
  const [f, setF] = useState({ loai: "Quảng cáo", soTien: "" as number | "", ngay: homNayISO(), ghiChu: "", maDon: "", maLo: "", nguonTienId: "" })
  const [them, setThem] = useState(false)
  const [dang, setDang] = useState(false)
  const tai = useCallback(async () => {
    try {
      setD(await goiApi(`/api/tai-chinh/chi-phi?thang=${thang}`))
    } catch (e: any) {
      toast({ title: "Không tải được", description: e.message, variant: "destructive" })
    }
  }, [thang, toast])
  useEffect(() => {
    tai()
  }, [tai])
  const luu = async () => {
    setDang(true)
    try {
      await goiApi("/api/tai-chinh/chi-phi", "POST", f)
      toast({ title: `Đã ghi ${f.loai} ${vnd(Number(f.soTien))}` })
      setF({ ...f, soTien: "", ghiChu: "", maDon: "", maLo: "" })
      tai()
    } catch (e: any) {
      toast({ title: "Không ghi được", description: e.message, variant: "destructive" })
    } finally {
      setDang(false)
    }
  }
  const huy = async (x: Dong) => {
    if (!window.confirm(`Huỷ khoản ${x.loai} ${vnd(x.soTien)} ngày ${ngayVN(x.ngay)}?${x.nguonTien && x.nguonTien !== "Ngoài app" ? ` Tiền sẽ được cộng lại vào ${x.nguonTien}.` : ""}`)) return
    try {
      await goiApi(`/api/tai-chinh/chi-phi?id=${encodeURIComponent(x.id)}`, "DELETE")
      tai()
    } catch (e: any) {
      toast({ title: "Không huỷ được", description: e.message, variant: "destructive" })
    }
  }
  return (
    <KhungTrang tieuDe="Chi phí ngoài" moTa="Quảng cáo, phụ kiện lẻ, phí ship đơn ngoài… Trừ vào lãi tháng ở Tổng quan và lãi hôm nay trong báo cáo 21h.">
      <div className="rounded-xl border bg-card p-3">
        <div className="mb-2 flex flex-wrap gap-1">
          {(d?.loai || ["Quảng cáo", "Phụ kiện lẻ", "Ship đơn ngoài", "Khác"]).map((l) => (
            <button key={l} className={cn("rounded-full border px-3 py-1 text-sm", f.loai === l && "bg-foreground text-background")} onClick={() => setF({ ...f, loai: l })}>
              {l}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
          <OTien value={f.soTien} onChange={(v) => setF({ ...f, soTien: v })} placeholder="Số tiền" />
          <Input type="date" value={f.ngay} onChange={(e) => setF({ ...f, ngay: e.target.value })} />
          <Input className="col-span-2" placeholder="Ghi chú (vd: FB ads tuần 47)" value={f.ghiChu} onChange={(e) => setF({ ...f, ghiChu: e.target.value })} onKeyDown={(e) => e.key === "Enter" && Number(f.soTien) && luu()} />
        </div>
        {them && (
          <div className="mt-2 grid grid-cols-2 gap-2 md:grid-cols-3">
            <Input placeholder="Mã đơn (nếu có)" value={f.maDon} onChange={(e) => setF({ ...f, maDon: e.target.value })} />
            <Input placeholder="Mã lô (trừ vào lãi lô)" value={f.maLo} onChange={(e) => setF({ ...f, maLo: e.target.value.toUpperCase() })} />
            <select className="col-span-2 h-9 rounded-md border bg-background px-2 text-sm md:col-span-1" value={f.nguonTienId} onChange={(e) => setF({ ...f, nguonTienId: e.target.value })}>
              <option value="">Không trừ nguồn tiền</option>
              {d?.nguonTien.map((a) => (
                <option key={a.id} value={a.id}>
                  Trừ từ {a.name} · {vnd(a.balance)}
                </option>
              ))}
            </select>
          </div>
        )}
        <div className="mt-2 flex items-center justify-between">
          <button className="text-xs text-muted-foreground underline" onClick={() => setThem((x) => !x)}>
            {them ? "Ẩn bớt" : "Gắn đơn / lô / trừ nguồn tiền"}
          </button>
          <Button onClick={luu} disabled={dang || !Number(f.soTien)}>
            {dang ? "Đang ghi…" : "Ghi chi phí"}
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">Tháng</span>
        <Input type="month" className="w-44" value={thang} onChange={(e) => setThang(e.target.value)} />
      </div>
      {!d ? (
        <DangTai />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
            <The nhan="Tổng chi phí ngoài" giaTri={vnd(d.tong)} />
            {Object.entries(d.theoLoai).map(([k, v]) => (
              <The key={k} nhan={k} giaTri={vnd(v)} />
            ))}
          </div>
          <div className="divide-y rounded-xl border bg-card text-sm">
            {d.ds.map((x) => (
              <div key={x.id} className={cn("flex items-center justify-between gap-2 px-3 py-2", x.daHuy && "text-muted-foreground line-through")}>
                <div className="min-w-0">
                  <div>
                    <span className="font-medium">{x.loai}</span> · {ngayVN(x.ngay)}
                    {x.ghiChu && ` · ${x.ghiChu}`}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {[x.maDon && `đơn ${x.maDon}`, x.maLo && `lô ${x.maLo}`, x.nguonTien, x.nguoiGhi].filter(Boolean).join(" · ")}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span className="tabular-nums">{vnd(x.soTien)}</span>
                  {!x.daHuy && (
                    <Button size="sm" variant="ghost" onClick={() => huy(x)}>
                      Huỷ
                    </Button>
                  )}
                </div>
              </div>
            ))}
            {!d.ds.length && <div className="py-8 text-center text-muted-foreground">Chưa có chi phí nào trong tháng</div>}
          </div>
        </>
      )}
    </KhungTrang>
  )
}

export default function Page() {
  return (
    <ProtectedRoute requiredRole="chu_shop">
      <Trang />
    </ProtectedRoute>
  )
}
