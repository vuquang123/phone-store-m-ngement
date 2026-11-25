"use client"
// Tài chính · Tiền hiện có (chỉ chủ shop): nhập số dư thật của từng nguồn tiền (tiền mặt, tài khoản, ví...).
// Tổng này dùng cho Tổng quan (tài sản ròng) và báo cáo 21h (đủ tiền trả nợ hay không).
// Tiền đơn bán tự cộng: tiền mặt -> quỹ tiền mặt, chuyển khoản / quẹt thẻ (sau N ngày) -> nguồn đã chọn.
import { useCallback, useEffect, useMemo, useState } from "react"
import { ProtectedRoute } from "@/components/auth/protected-route"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useToast } from "@/hooks/use-toast"
import { DangTai, KhungTrang, Nhan, OTien, The, goiApi, vnd } from "@/components/tai-chinh/chung"
import { Eye, EyeOff, Pencil, Plus, Save, X } from "lucide-react"

type Nguon = { id: string; ten: string; loai: string; soDu: number; soDuTinh: number; tienDon: number; sapVe: number; chiNhanh: string; thuTu: number; an: boolean; ghiChu: string; capNhatLuc: string; nguoiCapNhat: string }
type TomTat = { coDuLieu: boolean; tong: number; daNhap: number; tienDon: number; sapVe: number; soNguon: number; capNhatLuc: string; capNhatCuNhat: string; soNgayCu: number | null }
type Khoan = { maDon: string; luc: string; hinhThuc: string; traLai: boolean; soTien: number; hieuLuc: string; nguonId: string; chiNhanh: string; trangThai: string; coHoanTra: boolean }
type CaiDatTD = { tienMat: string; chuyenKhoan: string; the: string; soNgayThe: number; tuKhop: { tienMat: boolean; chuyenKhoan: boolean; the: boolean } }
type LichSu = { thoiGian: string; idNguon: string; tenNguon: string; soDuCu: number | null; soDuMoi: number | null; chenhLech: number; nguoiGhi: string; ghiChu: string }
type Data = { nguon: Nguon[]; tomTat: TomTat; tomTatTatCa: TomTat; tienDon: { caiDat: CaiDatTD; khoan: Khoan[] }; lichSu: LichSu[]; loai: string[]; chiNhanh: string[]; active: string }

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
  const [td, setTd] = useState<{ tienMat: string; chuyenKhoan: string; the: string; soNgayThe: string }>({ tienMat: "", chuyenKhoan: "", the: "", soNgayThe: "2" })
  const [xemHetKhoan, setXemHetKhoan] = useState(false)

  const tai = useCallback(async () => {
    try {
      const r = await goiApi<Data>("/api/tai-chinh/tien-hien-co")
      setD(r)
      // Ô nhập hiện số dư HIỆN TẠI (đã cộng tiền đơn). Lưu = lấy số này làm mốc mới.
      setNhap(Object.fromEntries(r.nguon.filter((n) => !n.an).map((n) => [n.id, n.capNhatLuc ? n.soDuTinh : ""])))
      const c = r.tienDon.caiDat
      setTd({ tienMat: c.tienMat, chuyenKhoan: c.chuyenKhoan, the: c.the, soNgayThe: String(c.soNgayThe) })
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
  const coDoi = dangDung.some((n) => nhap[n.id] !== (n.capNhatLuc ? n.soDuTinh : ""))
  const tenNguon = (id: string) => d?.nguon.find((n) => n.id === id)?.ten || ""
  const luuTienDon = async () => {
    try {
      await goiApi("/api/tai-chinh/tien-hien-co", "PUT", { tienDon: td })
      toast({ title: "Đã lưu nguồn nhận tiền đơn" })
      await tai()
    } catch (e: any) {
      toast({ title: "Không lưu được", description: e.message, variant: "destructive" })
    }
  }
  const taoQuyTienMat = async () => {
    try {
      await goiApi("/api/tai-chinh/tien-hien-co", "POST", { ten: "Quỹ tiền mặt", loai: "Tiền mặt", chiNhanh: "" })
      toast({ title: "Đã tạo Quỹ tiền mặt", description: "Nhập số tiền mặt đang có rồi bấm Lưu số dư" })
      await tai()
    } catch (e: any) {
      toast({ title: "Không tạo được", description: e.message, variant: "destructive" })
    }
  }

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
              phu={d.tomTat.tienDon ? `${d.tomTat.soNguon} nguồn · đã nhập ${vnd(d.tomTat.daNhap)} + tiền đơn ${vnd(d.tomTat.tienDon)}` : `${d.tomTat.soNguon} nguồn`}
              mau={d.tomTat.coDuLieu ? "xanh" : undefined}
            />
            <The
              nhan="Cập nhật lúc"
              giaTri={d.tomTat.capNhatLuc || "Chưa nhập"}
              phu={d.tomTat.coDuLieu ? doCu(d.tomTat.soNgayCu) : "Nhập số dư rồi bấm Lưu"}
              mau={d.tomTat.soNgayCu === null || d.tomTat.soNgayCu > 2 ? "vang" : undefined}
            />
            {d.tomTat.sapVe !== 0 && <The nhan="Tiền quẹt thẻ sắp về" giaTri={vnd(d.tomTat.sapVe)} phu="Chưa tính vào tổng, tự cộng khi tới ngày" mau="xanh" />}
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
                      <span>{n.capNhatLuc ? `Nhập ${vnd(n.soDu)} lúc ${n.capNhatLuc}${n.nguoiCapNhat ? ` · ${n.nguoiCapNhat}` : ""}` : "Chưa nhập số dư"}</span>
                      {n.tienDon !== 0 && <span className="text-emerald-700">· tiền đơn {n.tienDon > 0 ? "+" : ""}{vnd(n.tienDon)}</span>}
                      {n.sapVe !== 0 && <span className="text-sky-700">· sắp về {vnd(n.sapVe)}</span>}
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

          <section className="rounded-xl border bg-card p-3 text-sm">
            <h2 className="mb-1 font-medium">Tiền đơn bán tự cộng vào</h2>
            <p className="mb-2 text-xs text-muted-foreground">
              Khi xuất đơn, phần thanh toán được cộng vào nguồn đã chọn (tính từ lúc nhập số dư gần nhất). Quẹt thẻ cộng sau số ngày bên dưới. Thu máy, góp, COD, đặt cọc trước không cộng.
            </p>
            <div className="grid gap-2 md:grid-cols-4">
              {(
                [
                  ["tienMat", "Tiền mặt"],
                  ["chuyenKhoan", "Chuyển khoản"],
                  ["the", "Quẹt thẻ"],
                ] as const
              ).map(([k, nhan]) => (
                <label key={k} className="grid gap-1">
                  <span className="text-xs text-muted-foreground">
                    {nhan}
                    {d.tienDon.caiDat.tuKhop[k] && td[k] === d.tienDon.caiDat[k] ? " (tự khớp theo tên, bấm Lưu để chốt)" : ""}
                  </span>
                  <select className="h-9 rounded-md border bg-background px-2" value={td[k]} onChange={(e) => setTd({ ...td, [k]: e.target.value })}>
                    <option value="">— Không cộng —</option>
                    {dangDung.map((n) => (
                      <option key={n.id} value={n.id}>
                        {n.ten}
                      </option>
                    ))}
                  </select>
                </label>
              ))}
              <label className="grid gap-1">
                <span className="text-xs text-muted-foreground">Tiền quẹt thẻ về sau (ngày)</span>
                <Input inputMode="numeric" value={td.soNgayThe} onChange={(e) => setTd({ ...td, soNgayThe: e.target.value.replace(/\D/g, "") })} />
              </label>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Button size="sm" variant="outline" onClick={luuTienDon}>
                Lưu nguồn nhận
              </Button>
              {!td.tienMat && (
                <span className="flex flex-wrap items-center gap-2 text-amber-700">
                  Chưa có nguồn nhận tiền mặt, tiền mặt của đơn chưa được cộng.
                  {!dangDung.some((n) => n.loai === "Tiền mặt") && (
                    <Button size="sm" variant="outline" onClick={taoQuyTienMat}>
                      <Plus className="mr-1 h-4 w-4" /> Tạo “Quỹ tiền mặt”
                    </Button>
                  )}
                </span>
              )}
            </div>
          </section>

          <section className="rounded-xl border bg-card p-3">
            <h2 className="mb-2 text-sm font-medium">Tiền từ đơn bán</h2>
            <div className="divide-y text-sm">
              {(xemHetKhoan ? d.tienDon.khoan : d.tienDon.khoan.slice(0, 15)).map((k, i) => (
                <div key={i} className="flex flex-wrap items-center justify-between gap-2 py-1.5">
                  <div className="min-w-0">
                    <div>
                      <span className="font-medium">Đơn {k.maDon}</span>
                      <span className="text-muted-foreground">
                        {" "}
                        · {k.traLai ? `Trả lại khách (${k.hinhThuc})` : k.hinhThuc} → {tenNguon(k.nguonId) || "chưa gán nguồn"}
                      </span>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Xuất đơn {k.luc}
                      {k.hieuLuc !== k.luc ? ` · tiền về ${k.hieuLuc}` : ""}
                      {k.chiNhanh ? ` · ${k.chiNhanh}` : ""}
                      {k.coHoanTra && <span className="text-amber-700"> · có máy hoàn trả, tiền hoàn chưa trừ (kiểm lại số dư)</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Nhan mau={k.trangThai === "Đã cộng" ? "xanh" : k.trangThai === "Sắp về" ? "xanhduong" : k.trangThai === "Đơn đã hoàn trả" ? "xam" : "vang"}>{k.trangThai}</Nhan>
                    <span className={k.soTien >= 0 ? "tabular-nums text-emerald-700" : "tabular-nums text-red-700"}>
                      {k.soTien >= 0 ? "+" : ""}
                      {vnd(k.soTien)}
                    </span>
                  </div>
                </div>
              ))}
              {!d.tienDon.khoan.length && <div className="py-4 text-center text-muted-foreground">Chưa có đơn nào sau lần nhập số dư gần nhất</div>}
            </div>
            {d.tienDon.khoan.length > 15 && (
              <button className="mt-2 text-sm text-muted-foreground underline" onClick={() => setXemHetKhoan(!xemHetKhoan)}>
                {xemHetKhoan ? "Thu gọn" : `Xem cả ${d.tienDon.khoan.length} khoản`}
              </button>
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
