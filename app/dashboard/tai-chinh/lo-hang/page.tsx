"use client"
// Tài chính · Lô hàng: báo cáo từng lô, bấm vào lô xem sổ lô (máy đã bán tô xanh, không bao giờ xoá).
import { Suspense, useCallback, useEffect, useMemo, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { ProtectedRoute } from "@/components/auth/protected-route"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"
import { DangTai, KhungTrang, Nhan, OTien, The, goiApi, homNayISO, ngayVN, pt, vnd, xuatCsv } from "@/components/tai-chinh/chung"
import { ArrowLeft, Download, Plus, Upload } from "lucide-react"
import { ChonDauHang } from "@/components/tai-chinh/chon-dau-hang"

type Lo = { ma: string; dauHangId: string; ngayNhap: string; chiPhiLo: number; chiPhiTinhNo: boolean; daTraLucNhap: number; hanTra: string; tongHoaDon: number; ghiChu: string; chiNhanh: string; trangThai: string }
type DongLo = {
  ma: string; slNhap: number; slBan: number; slTon: number; phanTramBan: number; doanhThu: number; laiDaChot: number; vonTon: number
  laiDuKienTon: number; daThu: number; tongVon: number; phanTramThuHoi: number; tuoiLo: number; noGoc: number; daTra: number; noConLai: number
  hanTra: string; soNgayConLai: number; mau: "xanh" | "vang" | "do" | "het"; huyHieu: string[]; canhBaoCheo: boolean
  lo: Lo; tenDauHang: string; nhom: Record<string, number>; chiPhiNgoai: number
}
type DauHang = { id: string; ten: string; soNgayNo: number }
type MayCT = {
  dong: number; idMay: string; imei: string; serial: string; ten: string; loaiMay: string; dungLuong: string; mau: string; pin: string
  giaNhap: number; giaBanMucTieu: number; giaSan: number; ngayNhap: string; trangThai: string; ctvGiu: string; maDon: string; ngayBan: string
  doanhThu: number; daThu: number; chuaThu: number; daThuDu: boolean; hoaHong: number; phiTraGop: number; phiKhac: number; chiPhiPhuKien: number; chiPhiThem?: number; giaVon?: number
  ctvBan: string; nguoiBan: string; lai: number | null; tuoi: number | null; diem: number | null
  deXuat: { giaDeXuat: number; canDuyet: boolean; lyDo: string } | null
  ghiChu: string
}
type ChiTiet = DongLo & { may: MayCT[]; traNo: { id: string; ngay: string; soTien: number; tongLanTra: number; ghiChu: string; nguoiGhi: string }[]; ctv: { id: string; ten: string }[]; dauHang: DauHang[] }

const MAU_HAN = { xanh: "xanh", vang: "vang", do: "do", het: "xam" } as const
const huyHieuMau = (h: string) => (h === "Đã hoàn vốn" ? "xanh" : h === "Chậm" ? "vang" : "do")

function HanTra({ x }: { x: Pick<DongLo, "noConLai" | "soNgayConLai" | "mau" | "hanTra" | "noGoc"> }) {
  if (!x.noGoc) return <span className="text-muted-foreground">Không tính nợ</span>
  if (x.noConLai <= 0) return <Nhan mau="xam">Đã trả đủ</Nhan>
  return (
    <Nhan mau={MAU_HAN[x.mau]}>
      {x.soNgayConLai < 0 ? `Quá hạn ${-x.soNgayConLai} ngày` : x.soNgayConLai === 0 ? "Hạn hôm nay" : `Còn ${x.soNgayConLai} ngày`} · {ngayVN(x.hanTra)}
    </Nhan>
  )
}

/* ================================ danh sách ================================ */
function DanhSach() {
  const router = useRouter()
  const { toast } = useToast()
  const [data, setData] = useState<{ lo: DongLo[]; dauHang: DauHang[]; chuaLo: any[] } | null>(null)
  const [loc, setLoc] = useState({ dauHang: "", tu: "", den: "", nhom: "", q: "" })
  const [moTao, setMoTao] = useState(false)
  const tai = useCallback(async () => {
    const sp = new URLSearchParams(Object.entries(loc).filter(([, v]) => v) as [string, string][])
    try {
      setData(await goiApi(`/api/tai-chinh/lo-hang?${sp}`))
    } catch (e: any) {
      toast({ title: "Không tải được", description: e.message, variant: "destructive" })
    }
  }, [loc, toast])
  useEffect(() => {
    tai()
  }, [tai])

  const tong = useMemo(() => {
    const ds = data?.lo || []
    return {
      vonTon: ds.reduce((s, x) => s + x.vonTon, 0),
      lai: ds.reduce((s, x) => s + x.laiDaChot, 0),
      no: ds.reduce((s, x) => s + x.noConLai, 0),
    }
  }, [data])

  const xuat = () => {
    if (!data) return
    xuatCsv(`bao-cao-lo-${homNayISO()}.csv`, [
      ["Mã lô", "Đầu hàng", "Ngày nhập", "Tuổi lô", "SL nhập", "SL bán", "SL tồn", "% bán", "Doanh thu", "Lãi đã chốt", "Vốn tồn", "Lãi dự kiến tồn", "% thu hồi", "Nợ còn lại", "Hạn trả", "Huy hiệu", "Chi nhánh"],
      ...data.lo.map((x) => [x.ma, x.tenDauHang, ngayVN(x.lo.ngayNhap), x.tuoiLo, x.slNhap, x.slBan, x.slTon, Math.round(x.phanTramBan), x.doanhThu, x.laiDaChot, x.vonTon, x.laiDuKienTon, Math.round(x.phanTramThuHoi), x.noConLai, ngayVN(x.hanTra), x.huyHieu.join(" "), x.lo.chiNhanh]),
    ])
  }

  return (
    <KhungTrang
      tieuDe="Báo cáo lô hàng"
      moTa="Bấm vào lô để xem từng máy. Máy đã bán vẫn nằm trong sổ lô (tô xanh)."
      phai={
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={xuat} disabled={!data}>
            <Download className="mr-1 h-4 w-4" /> Xuất Excel
          </Button>
          <Button size="sm" onClick={() => setMoTao(true)}>
            <Plus className="mr-1 h-4 w-4" /> Tạo lô
          </Button>
        </div>
      }
    >
      <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
        <select className="h-9 rounded-md border bg-background px-2 text-sm" value={loc.dauHang} onChange={(e) => setLoc({ ...loc, dauHang: e.target.value })}>
          <option value="">Mọi đầu hàng</option>
          {data?.dauHang.map((d) => (
            <option key={d.id} value={d.id}>
              {d.ten}
            </option>
          ))}
        </select>
        <select className="h-9 rounded-md border bg-background px-2 text-sm" value={loc.nhom} onChange={(e) => setLoc({ ...loc, nhom: e.target.value })}>
          <option value="">Mọi loại máy</option>
          <option value="Lock">iPhone Lock</option>
          <option value="Quốc tế">iPhone Quốc tế</option>
          <option value="iPad">iPad</option>
        </select>
        <Input type="date" value={loc.tu} onChange={(e) => setLoc({ ...loc, tu: e.target.value })} title="Nhập từ ngày" />
        <Input type="date" value={loc.den} onChange={(e) => setLoc({ ...loc, den: e.target.value })} title="Đến ngày" />
        <Input placeholder="Tìm mã lô, IMEI…" value={loc.q} onChange={(e) => setLoc({ ...loc, q: e.target.value })} className="col-span-2 md:col-span-1" />
      </div>
      {!data ? (
        <DangTai />
      ) : (
        <>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            <The nhan="Vốn tồn các lô" giaTri={vnd(tong.vonTon)} />
            <The nhan="Lãi đã chốt" giaTri={vnd(tong.lai)} />
            <The nhan="Nợ còn lại" giaTri={vnd(tong.no)} />
          </div>
          <div className="space-y-2 md:hidden">
            {data.lo.map((x) => (
              <button key={x.ma} className="w-full rounded-xl border bg-card p-3 text-left" onClick={() => router.push(`?ma=${encodeURIComponent(x.ma)}`)}>
                <div className="flex items-center justify-between">
                  <span className="font-medium">{x.ma}</span>
                  <span className="text-xs text-muted-foreground">{x.tuoiLo} ngày</span>
                </div>
                <div className="text-xs text-muted-foreground">
                  {x.tenDauHang} · {ngayVN(x.lo.ngayNhap)}
                </div>
                <div className="mt-2 grid grid-cols-2 gap-1 text-xs tabular-nums">
                  <div>Bán {x.slBan}/{x.slNhap}</div>
                  <div>Thu hồi {pt(x.phanTramThuHoi)}</div>
                  <div>Lãi {vnd(x.laiDaChot)}</div>
                  <div>Vốn tồn {vnd(x.vonTon)}</div>
                  <div className="col-span-2">Nợ {vnd(x.noConLai)}</div>
                </div>
                <div className="mt-2 flex flex-wrap gap-1">
                  <HanTra x={x} />
                  {x.huyHieu.map((h) => (
                    <Nhan key={h} mau={huyHieuMau(h)}>
                      {h}
                    </Nhan>
                  ))}
                  {x.canhBaoCheo && x.noConLai > 0 && <Nhan mau="do">Nợ &gt; vốn tồn</Nhan>}
                </div>
              </button>
            ))}
          </div>
          <div className="hidden overflow-x-auto rounded-xl border md:block">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-xs text-muted-foreground">
                <tr className="[&>th]:px-2 [&>th]:py-2 [&>th]:text-right [&>th:first-child]:text-left">
                  <th>Lô</th>
                  <th>Nhập/Bán/Tồn</th>
                  <th>% bán</th>
                  <th>Doanh thu</th>
                  <th>Lãi đã chốt</th>
                  <th>Vốn tồn</th>
                  <th>Lãi dự kiến tồn</th>
                  <th>% thu hồi</th>
                  <th>Nợ còn lại</th>
                  <th className="!text-left">Hạn / trạng thái</th>
                </tr>
              </thead>
              <tbody>
                {data.lo.map((x) => (
                  <tr key={x.ma} className="cursor-pointer border-t hover:bg-muted/40 [&>td]:px-2 [&>td]:py-2 [&>td]:text-right [&>td]:tabular-nums" onClick={() => router.push(`?ma=${encodeURIComponent(x.ma)}`)}>
                    <td className="!text-left">
                      <div className="font-medium">{x.ma}</div>
                      <div className="text-xs text-muted-foreground">
                        {x.tenDauHang} · {ngayVN(x.lo.ngayNhap)} · {x.tuoiLo} ngày
                      </div>
                    </td>
                    <td>
                      {x.slNhap}/{x.slBan}/{x.slTon}
                    </td>
                    <td>{pt(x.phanTramBan)}</td>
                    <td>{vnd(x.doanhThu)}</td>
                    <td className={x.laiDaChot < 0 ? "text-red-600" : ""}>{vnd(x.laiDaChot)}</td>
                    <td>{vnd(x.vonTon)}</td>
                    <td>{vnd(x.laiDuKienTon)}</td>
                    <td>{pt(x.phanTramThuHoi)}</td>
                    <td>{vnd(x.noConLai)}</td>
                    <td className="!text-left">
                      <div className="flex flex-wrap gap-1">
                        <HanTra x={x} />
                        {x.huyHieu.map((h) => (
                          <Nhan key={h} mau={huyHieuMau(h)}>
                            {h}
                          </Nhan>
                        ))}
                        {x.canhBaoCheo && x.noConLai > 0 && <Nhan mau="do">Nợ &gt; vốn tồn</Nhan>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!data.lo.length && <div className="py-8 text-center text-sm text-muted-foreground">Chưa có lô nào khớp bộ lọc</div>}
          {data.chuaLo.length > 0 && (
            <div className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm dark:border-amber-900 dark:bg-amber-950/40">
              Có {data.chuaLo.length} máy đang tồn chưa thuộc lô nào. Mở một lô rồi bấm “Thêm máy tồn vào lô” để thêm vào.
            </div>
          )}
        </>
      )}
      <TaoLoDialog open={moTao} onClose={() => setMoTao(false)} dauHang={data?.dauHang || []} onDone={(ma) => router.push(`?ma=${encodeURIComponent(ma)}`)} />
    </KhungTrang>
  )
}

/* ============================== tạo / sửa lô ============================== */
function TaoLoDialog({ open, onClose, dauHang, onDone, lo }: { open: boolean; onClose: () => void; dauHang: DauHang[]; onDone: (ma: string) => void; lo?: Lo }) {
  const { toast } = useToast()
  const trong = { dauHangId: "", ngayNhap: homNayISO(), chiPhiLo: "" as number | "", chiPhiTraDauHang: false, daTraLucNhap: "" as number | "", hanTra: "", tongHoaDon: "" as number | "", ghiChu: "", trangThai: "" }
  const [f, setF] = useState(trong)
  const [dang, setDang] = useState(false)
  const [themDH, setThemDH] = useState<DauHang[]>([])
  useEffect(() => {
    if (!open) return
    setF(
      lo
        ? { dauHangId: lo.dauHangId, ngayNhap: lo.ngayNhap, chiPhiLo: lo.chiPhiLo || "", chiPhiTraDauHang: lo.chiPhiTinhNo, daTraLucNhap: lo.daTraLucNhap || "", hanTra: lo.hanTra, tongHoaDon: lo.tongHoaDon || "", ghiChu: lo.ghiChu, trangThai: lo.trangThai }
        : trong,
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, lo])
  const luu = async () => {
    setDang(true)
    try {
      if (lo) {
        await goiApi("/api/tai-chinh/lo-hang", "PATCH", { ma: lo.ma, ...f, chiPhiLo: f.chiPhiLo || 0, daTraLucNhap: f.daTraLucNhap || 0, tongHoaDon: f.tongHoaDon || 0 })
        onDone(lo.ma)
      } else {
        const r = await goiApi<{ ma: string }>("/api/tai-chinh/lo-hang", "POST", f)
        toast({ title: `Đã tạo ${r.ma}` })
        onDone(r.ma)
      }
      onClose()
    } catch (e: any) {
      toast({ title: "Không lưu được", description: e.message, variant: "destructive" })
    } finally {
      setDang(false)
    }
  }
  const dsDH = [...dauHang, ...themDH.filter((x) => !dauHang.some((d) => d.id === x.id))]
  const dh = dsDH.find((x) => x.id === f.dauHangId)
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{lo ? `Sửa lô ${lo.ma}` : "Tạo lô nhập"}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3 text-sm">
          <div className="grid gap-1">
            Đầu hàng
            <ChonDauHang value={f.dauHangId} onChange={(id) => setF({ ...f, dauHangId: id })} dauHang={dsDH} onCreated={(x) => setThemDH((t) => [...t, x])} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <label className="grid gap-1">
              Ngày nhập
              <Input type="date" value={f.ngayNhap} onChange={(e) => setF({ ...f, ngayNhap: e.target.value })} />
            </label>
            <label className="grid gap-1">
              Hạn trả nợ
              <Input type="date" value={f.hanTra} onChange={(e) => setF({ ...f, hanTra: e.target.value })} />
              <span className="text-xs text-muted-foreground">Trống = ngày nhập + {dh?.soNgayNo ?? "số"} ngày</span>
            </label>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <label className="grid gap-1">
              Chi phí lô (tổng)
              <OTien value={f.chiPhiLo} onChange={(v) => setF({ ...f, chiPhiLo: v })} />
            </label>
            <label className="grid gap-1">
              Đã trả lúc nhập
              <OTien value={f.daTraLucNhap} onChange={(v) => setF({ ...f, daTraLucNhap: v })} />
            </label>
          </div>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={f.chiPhiTraDauHang} onChange={(e) => setF({ ...f, chiPhiTraDauHang: e.target.checked })} />
            Chi phí lô phải trả cho đầu hàng (cộng vào nợ)
          </label>
          <label className="grid gap-1">
            Tổng hoá đơn đầu hàng (để đối chiếu)
            <OTien value={f.tongHoaDon} onChange={(v) => setF({ ...f, tongHoaDon: v })} />
          </label>
          <label className="grid gap-1">
            Ghi chú
            <Textarea rows={2} value={f.ghiChu} onChange={(e) => setF({ ...f, ghiChu: e.target.value })} />
          </label>
          {lo && (
            <label className="grid gap-1">
              Trạng thái lô
              <select className="h-9 rounded-md border bg-background px-2" value={f.trangThai} onChange={(e) => setF({ ...f, trangThai: e.target.value })}>
                <option value="">Đang mở</option>
                <option value="Đã chốt">Đã chốt (không nhận thêm máy)</option>
                <option value="Lô cũ (không tính nợ)">Lô cũ (không tính nợ)</option>
              </select>
            </label>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Huỷ
          </Button>
          <Button onClick={luu} disabled={dang || !f.dauHangId}>
            {dang ? "Đang lưu…" : "Lưu"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/* ================================ chi tiết lô ================================ */
function ChiTietLo({ ma }: { ma: string }) {
  const router = useRouter()
  const { toast } = useToast()
  const [d, setD] = useState<ChiTiet | null>(null)
  const [sua, setSua] = useState<MayCT | null>(null)
  const [suaLo, setSuaLo] = useState(false)
  const [gan, setGan] = useState(false)
  const [loc, setLoc] = useState<"tat" | "ton" | "ban">("tat")
  const tai = useCallback(async () => {
    try {
      setD(await goiApi(`/api/tai-chinh/lo-hang/${encodeURIComponent(ma)}`))
    } catch (e: any) {
      toast({ title: "Không tải được lô", description: e.message, variant: "destructive" })
    }
  }, [ma, toast])
  useEffect(() => {
    tai()
  }, [tai])
  if (!d) return <KhungTrang tieuDe={ma}><DangTai /></KhungTrang>
  const ds = d.may.filter((m) => (loc === "tat" ? true : loc === "ban" ? m.trangThai === "Đã bán" : m.trangThai !== "Đã bán" && m.trangThai !== "Không còn trong kho"))
  const xuat = () =>
    xuatCsv(`${ma}.csv`, [
      ["IMEI/Serial", "Tên", "Loại", "Dung lượng", "Màu", "Giá nhập", "Giá bán", "Giá sàn", "Trạng thái", "Mã đơn", "Ngày bán", "Doanh thu", "Chưa thu", "Hoa hồng CTV", "Phí trả góp", "Phí khác", "Lãi", "Tuổi"],
      ...d.may.map((m) => [m.imei || m.serial, m.ten, m.loaiMay, m.dungLuong, m.mau, m.giaNhap, m.giaBanMucTieu, m.giaSan, m.trangThai, m.maDon, ngayVN(m.ngayBan), m.doanhThu, m.chuaThu, m.hoaHong, m.phiTraGop, m.phiKhac, m.lai ?? "", m.tuoi ?? ""]),
    ])
  return (
    <KhungTrang
      tieuDe={`Lô ${d.ma}`}
      moTa={`${d.tenDauHang} · nhập ${ngayVN(d.lo.ngayNhap)} · ${d.tuoiLo} ngày · ${d.lo.chiNhanh}${d.lo.trangThai ? ` · ${d.lo.trangThai}` : ""}`}
      phai={
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => router.push("/dashboard/tai-chinh/lo-hang")}>
            <ArrowLeft className="mr-1 h-4 w-4" /> Các lô
          </Button>
          <Button variant="outline" size="sm" onClick={() => setSuaLo(true)}>
            Sửa lô
          </Button>
          <Button variant="outline" size="sm" onClick={() => setGan(true)}>
            Thêm máy vào lô (tồn hoặc đã bán)
          </Button>
          <Button variant="outline" size="sm" onClick={() => router.push(`/dashboard/quan-tri/nhap-lo?lo=${encodeURIComponent(d.ma)}`)}>
            <Upload className="mr-1 h-4 w-4" /> Up file Excel vào lô
          </Button>
          <Button variant="outline" size="sm" onClick={xuat}>
            <Download className="mr-1 h-4 w-4" /> Excel
          </Button>
        </div>
      }
    >
      <div className="flex flex-wrap gap-1">
        <HanTra x={d} />
        {d.huyHieu.map((h) => (
          <Nhan key={h} mau={huyHieuMau(h)}>
            {h}
          </Nhan>
        ))}
      </div>
      {d.canhBaoCheo && d.noConLai > 0 && (
        <div className="rounded-xl border border-red-300 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
          Tiền bán lô này đã bị dùng vào việc khác, ưu tiên giữ tiền trả nợ. Nợ còn {vnd(d.noConLai)} nhưng vốn còn trong tồn chỉ {vnd(d.vonTon)}.
        </div>
      )}
      <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
        <The nhan="Nhập / bán / tồn" giaTri={`${d.slNhap} / ${d.slBan} / ${d.slTon}`} phu={`Đã bán ${pt(d.phanTramBan)}`} />
        <The nhan="Doanh thu" giaTri={vnd(d.doanhThu)} phu={`Đã thu ${vnd(d.daThu)}`} />
        <The nhan="Lãi đã chốt" giaTri={vnd(d.laiDaChot)} phu={`Đã trừ chi phí lô ${vnd(d.lo.chiPhiLo)}${d.chiPhiNgoai ? ` + chi phí ngoài ${vnd(d.chiPhiNgoai)}` : ""}`} mau={d.laiDaChot < 0 ? "do" : undefined} />
        <The nhan="Vốn tồn" giaTri={vnd(d.vonTon)} phu={`Lãi dự kiến ${vnd(d.laiDuKienTon)}`} />
        <The nhan="% thu hồi vốn" giaTri={pt(d.phanTramThuHoi)} phu={`Tổng vốn ${vnd(d.tongVon)}`} mau={d.phanTramThuHoi >= 100 ? "xanh" : undefined} />
        <The nhan="Nợ đầu hàng" giaTri={vnd(d.noConLai)} phu={`Gốc ${vnd(d.noGoc)} · đã trả ${vnd(d.daTra)}`} mau={d.noConLai > 0 ? MAU_HAN[d.mau] === "xam" ? undefined : (MAU_HAN[d.mau] as any) : undefined} />
      </div>

      <div className="flex gap-1 text-sm">
        {(
          [
            ["tat", `Tất cả (${d.may.length})`],
            ["ton", `Còn tồn (${d.slTon})`],
            ["ban", `Đã bán (${d.slBan})`],
          ] as const
        ).map(([k, t]) => (
          <button key={k} className={cn("rounded-md border px-3 py-1", loc === k && "bg-foreground text-background")} onClick={() => setLoc(k)}>
            {t}
          </button>
        ))}
      </div>
      <div className="overflow-x-auto rounded-xl border">
        <table className="w-full min-w-[900px] text-sm">
          <thead className="bg-muted/50 text-xs text-muted-foreground">
            <tr className="[&>th]:px-2 [&>th]:py-2 [&>th]:text-left">
              <th>Máy</th>
              <th>IMEI / Serial</th>
              <th className="!text-right">Giá nhập</th>
              <th className="!text-right">Giá bán</th>
              <th>Trạng thái</th>
              <th className="!text-right">Lãi</th>
              <th>Ghi chú</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {ds.map((m) => {
              const ban = m.trangThai === "Đã bán"
              return (
                <tr key={m.dong} className={cn("border-t align-top [&>td]:px-2 [&>td]:py-2", ban && "bg-emerald-50 dark:bg-emerald-950/30", m.trangThai === "Không còn trong kho" && "bg-muted/40 text-muted-foreground")}>
                  <td>
                    <div className="font-medium">{m.ten}</div>
                    <div className="text-xs text-muted-foreground">{[m.loaiMay, m.dungLuong, m.mau, m.pin && `pin ${m.pin}`].filter(Boolean).join(" · ")}</div>
                  </td>
                  <td className="font-mono text-xs">{m.imei || m.serial}</td>
                  <td className="text-right tabular-nums">
                    {m.giaNhap ? vnd(m.giaNhap) : <span className="text-amber-600">chưa có</span>}
                    {!!m.chiPhiThem && <div className="text-xs text-muted-foreground" title="Lãi tính theo giá nhập trên kho (đã sửa). Nợ đầu hàng vẫn theo giá nhập lô.">giá nhập kho {vnd(m.giaVon ?? m.giaNhap + m.chiPhiThem)}</div>}
                  </td>
                  <td className="text-right tabular-nums">
                    {ban ? vnd(m.doanhThu) : vnd(m.giaBanMucTieu)}
                    {!ban && m.giaSan > 0 && <div className="text-xs text-muted-foreground">sàn {vnd(m.giaSan)}</div>}
                    {!ban && m.deXuat && m.deXuat.giaDeXuat < m.giaBanMucTieu && <div className="text-xs text-amber-700">đề xuất {vnd(m.deXuat.giaDeXuat)}</div>}
                  </td>
                  <td>
                    <div>{m.trangThai}{m.ctvGiu && ` (${m.ctvGiu})`}</div>
                    <div className="text-xs text-muted-foreground">
                      {ban ? `${m.maDon} · ${ngayVN(m.ngayBan)}${m.nguoiBan ? ` · ${m.nguoiBan}` : ""}` : m.tuoi !== null ? `${m.tuoi} ngày` : ""}
                    </div>
                    {ban && m.chuaThu > 0 && <div className="text-xs text-amber-700">chưa thu {vnd(m.chuaThu)}</div>}
                  </td>
                  <td className={cn("text-right tabular-nums", (m.lai ?? 0) < 0 && "text-red-600")}>
                    {m.lai !== null ? vnd(m.lai) : ""}
                    {!ban && m.lai !== null && <div className="text-xs text-muted-foreground">dự kiến</div>}
                    {ban && (m.hoaHong || m.phiTraGop || m.phiKhac || m.chiPhiPhuKien) > 0 && (
                      <div className="text-xs text-muted-foreground" title="Hoa hồng CTV + phí trả góp + phí khác + chi phí thêm/phụ kiện (giá nhập lúc bán − giá nhập lô)">trừ {vnd(m.hoaHong + m.phiTraGop + m.phiKhac + m.chiPhiPhuKien)}</div>
                    )}
                  </td>
                  <td className="max-w-[160px] text-xs text-muted-foreground">{m.ghiChu}</td>
                  <td>
                    <Button variant="ghost" size="sm" onClick={() => setSua(m)}>
                      Sửa
                    </Button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {d.traNo.length > 0 && (
        <div className="rounded-xl border bg-card p-3 text-sm">
          <div className="mb-1 font-medium">Các lần trả nợ cho lô này</div>
          {d.traNo.map((t) => (
            <div key={t.id} className="flex justify-between border-t py-1 first:border-0">
              <span>
                {ngayVN(t.ngay)} {t.ghiChu && `· ${t.ghiChu}`} <span className="text-xs text-muted-foreground">({t.nguoiGhi})</span>
              </span>
              <span className="tabular-nums">
                {vnd(t.soTien)}
                {t.tongLanTra !== t.soTien && <span className="text-xs text-muted-foreground"> / {vnd(t.tongLanTra)}</span>}
              </span>
            </div>
          ))}
        </div>
      )}
      <SuaMayDialog may={sua} ctv={d.ctv} onClose={() => setSua(null)} onDone={tai} />
      <TaoLoDialog open={suaLo} onClose={() => setSuaLo(false)} dauHang={d.dauHang} lo={d.lo} onDone={() => tai()} />
      <GanMayDialog open={gan} ma={d.ma} onClose={() => setGan(false)} onDone={tai} />
    </KhungTrang>
  )
}

function SuaMayDialog({ may, ctv, onClose, onDone }: { may: MayCT | null; ctv: { id: string; ten: string }[]; onClose: () => void; onDone: () => void }) {
  const { toast } = useToast()
  const [f, setF] = useState<any>({})
  const [dang, setDang] = useState(false)
  useEffect(() => {
    if (may)
      setF({ giaNhap: may.giaNhap || "", giaSan: may.giaSan || "", ctvGiu: may.ctvGiu, ctvBan: may.ctvBan, hoaHong: may.hoaHong || "", phiTraGop: may.phiTraGop || "", phiKhac: may.phiKhac || "", daThuDu: may.daThuDu, ghiChu: may.ghiChu || "" })
  }, [may])
  if (!may) return null
  const ban = may.trangThai === "Đã bán"
  const luu = async () => {
    setDang(true)
    try {
      await goiApi("/api/tai-chinh/lo-hang/x", "PATCH", { dong: may.dong, ...f, giaNhap: f.giaNhap || 0, giaSan: f.giaSan || 0, hoaHong: f.hoaHong || 0, phiTraGop: f.phiTraGop || 0, phiKhac: f.phiKhac || 0 })
      onDone()
      onClose()
    } catch (e: any) {
      toast({ title: "Không lưu được", description: e.message, variant: "destructive" })
    } finally {
      setDang(false)
    }
  }
  const chonCtv = (k: string) => (
    <select className="h-9 rounded-md border bg-background px-2" value={f[k] || ""} onChange={(e) => setF({ ...f, [k]: e.target.value })}>
      <option value="">Không</option>
      {ctv.map((c) => (
        <option key={c.id} value={c.ten}>
          {c.ten}
        </option>
      ))}
    </select>
  )
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base">
            {may.ten} · {may.imei || may.serial}
          </DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <label className="grid gap-1">
            Giá nhập
            <OTien value={f.giaNhap} onChange={(v) => setF({ ...f, giaNhap: v })} />
          </label>
          {!ban && (
            <label className="grid gap-1">
              Giá sàn
              <OTien value={f.giaSan} onChange={(v) => setF({ ...f, giaSan: v })} placeholder="= giá nhập" />
            </label>
          )}
          {!ban && <label className="grid gap-1">CTV đang giữ{chonCtv("ctvGiu")}</label>}
          {ban && (
            <>
              <label className="grid gap-1">CTV bán{chonCtv("ctvBan")}</label>
              <label className="grid gap-1">
                Hoa hồng CTV
                <OTien value={f.hoaHong} onChange={(v) => setF({ ...f, hoaHong: v })} />
              </label>
              <label className="grid gap-1">
                Phí trả góp
                <OTien value={f.phiTraGop} onChange={(v) => setF({ ...f, phiTraGop: v })} />
              </label>
              <label className="grid gap-1">
                Phí khác
                <OTien value={f.phiKhac} onChange={(v) => setF({ ...f, phiKhac: v })} />
              </label>
              <label className="col-span-2 flex items-center gap-2">
                <input type="checkbox" checked={!!f.daThuDu} onChange={(e) => setF({ ...f, daThuDu: e.target.checked })} />
                Đã thu đủ tiền (góp / COD đã về)
              </label>
            </>
          )}
          <label className="col-span-2 grid gap-1">
            Ghi chú
            <Textarea rows={2} value={f.ghiChu} onChange={(e) => setF({ ...f, ghiChu: e.target.value })} />
          </label>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Huỷ
          </Button>
          <Button onClick={luu} disabled={dang}>
            {dang ? "Đang lưu…" : "Lưu"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

type MayChon = { khoa: string; ten: string; imei: string; giaNhap: number; ngayNhap: string; phu: string; ngayBan?: string }
type NguonGan = "cu" | "chua" | "ban"
function GanMayDialog({ open, ma, onClose, onDone }: { open: boolean; ma: string; onClose: () => void; onDone: () => void }) {
  const { toast } = useToast()
  const [nguon, setNguon] = useState<NguonGan>("cu")
  const [data, setData] = useState<{ cu: MayChon[]; chua: MayChon[]; ban: MayChon[] } | null>(null)
  const [chon, setChon] = useState<Set<string>>(new Set())
  const [q, setQ] = useState("")
  const [dan, setDan] = useState("")
  const [dang, setDang] = useState(false)
  useEffect(() => {
    if (!open) return
    setChon(new Set())
    setData(null)
    setDan("")
    goiApi<{ chuaLo: any[]; loCu: any[]; daBan: any[] }>("/api/tai-chinh/lo-hang")
      .then((r) => {
        const cu = (r.loCu || []).map((m: any) => ({ khoa: String(m.dong), ten: m.ten, imei: m.imei, giaNhap: m.giaNhap, ngayNhap: m.ngayNhap, phu: [m.dungLuong, m.mau, m.loaiMay].filter(Boolean).join(" · ") }))
        const chua = (r.chuaLo || []).map((m: any) => ({ khoa: String(m.dongKho), ten: m.ten, imei: m.imei, giaNhap: m.giaNhap, ngayNhap: m.ngayNhap, phu: m.chiNhanh }))
        const ban = (r.daBan || []).map((m: any) => ({ khoa: m.khoa, ten: m.ten, imei: m.id, giaNhap: m.giaNhap, ngayNhap: "", ngayBan: m.ngayBan, phu: [m.phu, m.maDon, m.loCu && `đang ở ${m.loCu}`].filter(Boolean).join(" · ") }))
        setData({ cu, chua, ban })
        setNguon(cu.length || !chua.length ? "cu" : "chua")
      })
      .catch(() => setData({ cu: [], chua: [], ban: [] }))
  }, [open])
  const ds = data ? data[nguon] : []
  const loc = ds.filter((m) => !q || `${m.ten} ${m.imei} ${m.phu}`.toLowerCase().includes(q.toLowerCase()))
  const tongChon = ds.filter((m) => chon.has(m.khoa)).reduce((s, m) => s + m.giaNhap, 0)
  const doiNguon = (n: NguonGan) => {
    setNguon(n)
    setChon(new Set())
  }
  const chonTheoDan = () => {
    const ids = new Set(dan.split(/[\s,;]+/).map((x) => x.trim().toUpperCase()).filter(Boolean))
    const s = new Set(chon)
    let n = 0
    for (const m of ds) if (ids.has(String(m.imei).toUpperCase())) s.add(m.khoa), n++
    setChon(s)
    toast({ title: `Đã chọn ${n}/${ids.size} máy theo danh sách dán` })
  }
  const gan = async () => {
    setDang(true)
    try {
      const body = nguon === "ban" ? { daBan: [...chon] } : nguon === "cu" ? { dongSo: [...chon].map(Number) } : { dongKho: [...chon].map(Number) }
      const r = await goiApi<{ added: number }>(`/api/tai-chinh/lo-hang/${encodeURIComponent(ma)}`, "POST", body)
      toast({ title: `Đã đưa ${r.added} máy vào ${ma}` })
      onDone()
      onClose()
    } catch (e: any) {
      toast({ title: "Không chuyển được", description: e.message, variant: "destructive" })
    } finally {
      setDang(false)
    }
  }
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Thêm máy vào {ma}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-wrap gap-1 text-sm">
          <button className={cn("rounded-md border px-3 py-1", nguon === "cu" && "bg-foreground text-background")} onClick={() => doiNguon("cu")}>
            Ở lô cũ ({data?.cu.length ?? "…"})
          </button>
          <button className={cn("rounded-md border px-3 py-1", nguon === "chua" && "bg-foreground text-background")} onClick={() => doiNguon("chua")}>
            Chưa có lô ({data?.chua.length ?? "…"})
          </button>
          <button className={cn("rounded-md border px-3 py-1", nguon === "ban" && "bg-foreground text-background")} onClick={() => doiNguon("ban")}>
            Đã bán ({data?.ban.length ?? "…"})
          </button>
        </div>
        {nguon === "ban" ? (
          <p className="text-xs text-muted-foreground">
            Máy đã xuất bán nhưng chưa thuộc lô của đầu hàng nào. Gắn vào đây thì lô tính đủ số máy, giá nhập (cộng vào nợ lô) và doanh thu, lãi của đơn đã bán.
          </p>
        ) : (
          <p className="text-xs text-muted-foreground">
            Chỉ hiện máy còn trong kho. Giá nhập và ngày nhập của máy giữ nguyên nên tuổi tồn vẫn đúng. Nợ của lô = tổng giá nhập các máy này − “Đã trả lúc nhập” (sửa ở nút Sửa lô).
          </p>
        )}
        <details className="text-sm">
          <summary className="cursor-pointer text-muted-foreground">Dán danh sách IMEI để chọn nhanh</summary>
          <Textarea rows={3} className="mt-1 font-mono text-xs" placeholder="Mỗi IMEI/Serial một dòng (copy cột IMEI từ Excel)" value={dan} onChange={(e) => setDan(e.target.value)} />
          <Button size="sm" variant="outline" className="mt-1" onClick={chonTheoDan} disabled={!dan.trim()}>
            Chọn theo danh sách
          </Button>
        </details>
        <div className="flex gap-2">
          <Input placeholder="Tìm tên, IMEI, màu…" value={q} onChange={(e) => setQ(e.target.value)} />
          <Button
            variant="outline"
            onClick={() => {
              const s = new Set(chon)
              const het = loc.every((m) => s.has(m.khoa))
              loc.forEach((m) => (het ? s.delete(m.khoa) : s.add(m.khoa)))
              setChon(s)
            }}
          >
            {loc.length && loc.every((m) => chon.has(m.khoa)) ? "Bỏ chọn" : "Chọn hết"}
          </Button>
        </div>
        <div className="max-h-[45vh] divide-y overflow-y-auto text-sm">
          {data === null && <DangTai />}
          {data && !loc.length && <div className="py-6 text-center text-muted-foreground">Không có máy nào</div>}
          {loc.map((m) => (
            <label key={m.khoa} className="flex items-center gap-2 py-1.5">
              <input
                type="checkbox"
                checked={chon.has(m.khoa)}
                onChange={(e) => {
                  const s = new Set(chon)
                  e.target.checked ? s.add(m.khoa) : s.delete(m.khoa)
                  setChon(s)
                }}
              />
              <span className="min-w-0 flex-1">
                <span className="block truncate">{m.ten}</span>
                <span className="block break-words text-xs text-muted-foreground">
                  <span className="font-mono">{m.imei}</span> · {m.ngayBan ? `bán ${ngayVN(m.ngayBan)}` : `nhập ${ngayVN(m.ngayNhap)}`} · {m.phu}
                </span>
              </span>
              <span className="text-xs tabular-nums text-muted-foreground">{m.giaNhap ? vnd(m.giaNhap) : "chưa có giá"}</span>
            </label>
          ))}
        </div>
        <DialogFooter className="items-center gap-2">
          <span className="mr-auto text-xs text-muted-foreground">Tổng giá nhập đã chọn: {vnd(tongChon)}</span>
          <Button variant="outline" onClick={onClose}>
            Huỷ
          </Button>
          <Button onClick={gan} disabled={!chon.size || dang}>
            {dang ? "Đang chuyển…" : `Đưa ${chon.size} máy vào lô`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function Trang() {
  const sp = useSearchParams()
  const ma = sp.get("ma")
  return ma ? <ChiTietLo ma={ma} /> : <DanhSach />
}

export default function Page() {
  return (
    <ProtectedRoute requiredRole="chu_shop">
      <Suspense fallback={<DangTai />}>
        <Trang />
      </Suspense>
    </ProtectedRoute>
  )
}
