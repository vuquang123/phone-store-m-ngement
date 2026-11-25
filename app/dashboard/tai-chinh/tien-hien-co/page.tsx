"use client"
// Tài chính · Tiền hiện có (chỉ chủ shop): nhập số dư thật của từng nguồn tiền (tiền mặt, tài khoản, ví...).
// Tổng này dùng cho Tổng quan (tài sản ròng) và báo cáo 21h (đủ tiền trả nợ hay không).
import { useCallback, useEffect, useMemo, useState } from "react"
import { ProtectedRoute } from "@/components/auth/protected-route"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useToast } from "@/hooks/use-toast"
import { DangTai, KhungTrang, Nhan, OTien, The, goiApi, vnd } from "@/components/tai-chinh/chung"
import { Eye, EyeOff, Pencil, Plus, Save, X } from "lucide-react"

type Nguon = { id: string; ten: string; loai: string; soDu: number; chiNhanh: string; thuTu: number; an: boolean; ghiChu: string; capNhatLuc: string; nguoiCapNhat: string }
type TomTat = { coDuLieu: boolean; tong: number; soNguon: number; capNhatLuc: string; capNhatCuNhat: string; soNgayCu: number | null }
type LichSu = { thoiGian: string; idNguon: string; tenNguon: string; soDuCu: number | null; soDuMoi: number | null; chenhLech: number; nguoiGhi: string; ghiChu: string }
type Data = { nguon: Nguon[]; tomTat: TomTat; tomTatTatCa: TomTat; lichSu: LichSu[]; loai: string[]; chiNhanh: string[]; active: string }

const doCu = (n: number | null) => (n === null ? "Có nguồn chưa nhập số dư" : n <= 0 ? "Cập nhật hôm nay" : n === 1 ? "Cập nhật hôm qua" : `Cập nhật ${n} ngày trước`)

function Trang() {
  const { toast } = useToast()
  const [d, setD] = useState<Data | null>(null)
  const [nhap, setNhap] = useState<Record<string, number | "">>({})
  const [ghiChu, setGhiChu] = useState("")
  const [dangLuu, setDangLuu] = useState(false)
  const [xemAn, setXemAn] = useState(false)
  const [moi, setMoi] = useState<{ ten: string; loai: string; chiNhanh: string; soDu: number | "" }>({ ten: "", loai: "Ngân hàng", chiNhanh: "", soDu: "" })
  const [suaId, setSuaId] = useState<string | null>(null)
  const [suaTen, setSuaTen] = useState("")

  const tai = useCallback(async () => {
    try {
      const r = await goiApi<Data>("/api/tai-chinh/tien-hien-co")
      setD(r)
      setNhap(Object.fromEntries(r.nguon.filter((n) => !n.an).map((n) => [n.id, n.capNhatLuc ? n.soDu : ""])))
    } catch (e: any) {
      toast({ title: "Không tải được", description: e.message, variant: "destructive" })
    }
  }, [toast])
  useEffect(() => {
    tai()
  }, [tai])

  const dangDung = useMemo(() => (d ? d.nguon.filter((n) => !n.an) : []), [d])
  const daAn = useMemo(() => (d ? d.nguon.filter((n) => n.an) : []), [d])
  const tongNhap = dangDung.reduce((s, n) => s + (nhap[n.id] === "" || nhap[n.id] === undefined ? 0 : Number(nhap[n.id])), 0)
  const coDoi = dangDung.some((n) => nhap[n.id] !== (n.capNhatLuc ? n.soDu : ""))

  const luu = async () => {
    setDangLuu(true)
    try {
      const soDu = Object.fromEntries(Object.entries(nhap).filter(([, v]) => v !== ""))
      await goiApi("/api/tai-chinh/tien-hien-co", "PUT", { soDu, ghiChu })
      toast({ title: "Đã lưu tiền hiện có", description: `Tổng ${vnd(tongNhap)}` })
      setGhiChu("")
      await tai()
    } catch (e: any) {
      toast({ title: "Không lưu được", description: e.message, variant: "destructive" })
    } finally {
      setDangLuu(false)
    }
  }
  const them = async () => {
    try {
      await goiApi("/api/tai-chinh/tien-hien-co", "POST", { ...moi, soDu: moi.soDu === "" ? null : moi.soDu })
      toast({ title: `Đã thêm "${moi.ten}"` })
      setMoi({ ten: "", loai: moi.loai, chiNhanh: moi.chiNhanh, soDu: "" })
      await tai()
    } catch (e: any) {
      toast({ title: "Không thêm được", description: e.message, variant: "destructive" })
    }
  }
  const sua = async (id: string, v: Partial<Nguon>) => {
    try {
      await goiApi("/api/tai-chinh/tien-hien-co", "PATCH", { id, ...v })
      setSuaId(null)
      await tai()
    } catch (e: any) {
      toast({ title: "Không sửa được", description: e.message, variant: "destructive" })
    }
  }

  return (
    <KhungTrang
      tieuDe="Tiền hiện có"
      moTa="Nhập số dư thật của từng nguồn tiền. Tổng này dùng để tính tài sản ròng và báo cáo 21h có đủ tiền trả nợ không."
      phai={
        d && dangDung.length > 0 ? (
          <Button onClick={luu} disabled={dangLuu}>
            <Save className="mr-1 h-4 w-4" /> {dangLuu ? "Đang lưu…" : coDoi ? "Lưu số dư" : "Xác nhận số dư hôm nay"}
          </Button>
        ) : undefined
      }
    >
      {!d ? (
        <DangTai />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
            <The
              nhan={d.active === "all" ? "Tổng tiền hiện có" : "Tiền hiện có (chi nhánh đang xem + nguồn chung)"}
              giaTri={vnd(d.tomTat.tong)}
              phu={`${d.tomTat.soNguon} nguồn`}
              mau={d.tomTat.coDuLieu ? "xanh" : undefined}
            />
            <The
              nhan="Cập nhật lúc"
              giaTri={d.tomTat.capNhatLuc || "Chưa nhập"}
              phu={d.tomTat.coDuLieu ? doCu(d.tomTat.soNgayCu) : "Nhập số dư rồi bấm Lưu"}
              mau={d.tomTat.soNgayCu === null || d.tomTat.soNgayCu > 2 ? "vang" : undefined}
            />
            {coDoi && <The nhan="Tổng đang nhập (chưa lưu)" giaTri={vnd(tongNhap)} phu={`Chênh ${vnd(tongNhap - d.tomTat.tong)}`} mau="vang" />}
          </div>

          <section className="rounded-xl border bg-card">
            <div className="divide-y">
              {dangDung.map((n) => (
                <div key={n.id} className="flex flex-wrap items-center gap-2 p-3">
                  <div className="min-w-[10rem] flex-1">
                    {suaId === n.id ? (
                      <div className="flex items-center gap-1">
                        <Input className="h-8" value={suaTen} autoFocus onChange={(e) => setSuaTen(e.target.value)} onKeyDown={(e) => e.key === "Enter" && sua(n.id, { ten: suaTen })} />
                        <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => sua(n.id, { ten: suaTen })}>
                          <Save className="h-4 w-4" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setSuaId(null)}>
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1 font-medium">
                        {n.ten}
                        <button
                          className="text-muted-foreground hover:text-foreground"
                          aria-label="Đổi tên"
                          onClick={() => {
                            setSuaId(n.id)
                            setSuaTen(n.ten)
                          }}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    )}
                    <div className="mt-0.5 flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
                      <Nhan mau="xam">{n.loai}</Nhan>
                      <Nhan mau={n.chiNhanh ? "xanhduong" : "xam"}>{n.chiNhanh || "Chung"}</Nhan>
                      <span>{n.capNhatLuc ? `Cập nhật ${n.capNhatLuc}${n.nguoiCapNhat ? ` · ${n.nguoiCapNhat}` : ""}` : "Chưa nhập số dư"}</span>
                    </div>
                  </div>
                  <OTien className="w-44 text-right" value={nhap[n.id] ?? ""} onChange={(v) => setNhap({ ...nhap, [n.id]: v })} placeholder="Số dư" />
                  <Button size="icon" variant="ghost" className="h-8 w-8" title="Ẩn nguồn (không tính vào tổng)" onClick={() => sua(n.id, { an: true })}>
                    <EyeOff className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              {!dangDung.length && <div className="p-6 text-center text-sm text-muted-foreground">Chưa có nguồn tiền. Thêm “Tiền mặt” và từng tài khoản ngân hàng ở dưới.</div>}
            </div>
            {dangDung.length > 0 && (
              <div className="flex flex-wrap items-center justify-between gap-2 border-t p-3">
                <Input className="max-w-sm" placeholder="Ghi chú lần cập nhật (không bắt buộc)" value={ghiChu} onChange={(e) => setGhiChu(e.target.value)} />
                <div className="text-sm">
                  Tổng: <span className="font-semibold tabular-nums">{vnd(tongNhap)}</span>
                </div>
              </div>
            )}
          </section>

          <section className="rounded-xl border bg-card p-3">
            <h2 className="mb-2 text-sm font-medium">Thêm nguồn tiền</h2>
            <div className="flex flex-wrap items-center gap-2">
              <Input className="w-56" placeholder="VD: Tiền mặt, VCB Dũng, Momo" value={moi.ten} onChange={(e) => setMoi({ ...moi, ten: e.target.value })} />
              <select className="h-9 rounded-md border bg-background px-2 text-sm" value={moi.loai} onChange={(e) => setMoi({ ...moi, loai: e.target.value })}>
                {d.loai.map((l) => (
                  <option key={l}>{l}</option>
                ))}
              </select>
              <select className="h-9 rounded-md border bg-background px-2 text-sm" value={moi.chiNhanh} onChange={(e) => setMoi({ ...moi, chiNhanh: e.target.value })}>
                <option value="">Chung</option>
                {d.chiNhanh.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
              <OTien className="w-40" value={moi.soDu} onChange={(v) => setMoi({ ...moi, soDu: v })} placeholder="Số dư (tuỳ chọn)" />
              <Button variant="outline" onClick={them} disabled={!moi.ten.trim()}>
                <Plus className="mr-1 h-4 w-4" /> Thêm
              </Button>
            </div>
          </section>

          {daAn.length > 0 && (
            <section className="rounded-xl border bg-card p-3 text-sm">
              <button className="text-muted-foreground underline" onClick={() => setXemAn(!xemAn)}>
                {xemAn ? "Ẩn" : "Xem"} {daAn.length} nguồn đã ẩn
              </button>
              {xemAn && (
                <div className="mt-2 divide-y">
                  {daAn.map((n) => (
                    <div key={n.id} className="flex items-center justify-between py-1.5">
                      <span className="text-muted-foreground">
                        {n.ten} · {vnd(n.soDu)}
                      </span>
                      <Button size="sm" variant="ghost" onClick={() => sua(n.id, { an: false })}>
                        <Eye className="mr-1 h-4 w-4" /> Hiện lại
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}

          <section className="rounded-xl border bg-card p-3">
            <h2 className="mb-2 text-sm font-medium">Lịch sử cập nhật</h2>
            <div className="divide-y text-sm">
              {d.lichSu.map((l, i) => (
                <div key={i} className="flex flex-wrap items-center justify-between gap-2 py-1.5">
                  <div className="min-w-0">
                    <div>
                      <span className="font-medium">{l.tenNguon}</span>
                      {l.soDuMoi !== null && (
                        <span className="tabular-nums text-muted-foreground">
                          {" "}
                          {l.soDuCu !== null ? `${vnd(l.soDuCu)} → ` : ""}
                          {vnd(l.soDuMoi)}
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {l.thoiGian} · {l.nguoiGhi}
                      {l.ghiChu ? ` · ${l.ghiChu}` : ""}
                    </div>
                  </div>
                  {l.chenhLech !== 0 && (
                    <span className={l.chenhLech > 0 ? "tabular-nums text-emerald-700" : "tabular-nums text-red-700"}>
                      {l.chenhLech > 0 ? "+" : ""}
                      {vnd(l.chenhLech)}
                    </span>
                  )}
                </div>
              ))}
              {!d.lichSu.length && <div className="py-4 text-center text-muted-foreground">Chưa có lần cập nhật nào</div>}
            </div>
          </section>
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
