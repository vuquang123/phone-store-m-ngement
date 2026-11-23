"use client"
// Quản trị dữ liệu · Nhập lô từ Excel (quản lý + chủ shop): chọn/tạo lô, tải file Excel của đầu hàng,
// xem trước, điền giá, rồi nhập cả lô vào kho + sổ lô. ID máy tự tạo từ IMEI như khi nhập tay.
import { useEffect, useMemo, useRef, useState } from "react"
import { ProtectedRoute } from "@/components/auth/protected-route"
import { QuanTriTabs } from "@/components/quan-tri/quan-tri-tabs"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useToast } from "@/hooks/use-toast"
import { useAuthMe } from "@/hooks/use-auth-me"
import { cn } from "@/lib/utils"
import { docFileBang } from "@/lib/client/doc-bang-tinh"
import { OTien, vnd } from "@/components/tai-chinh/chung"
import { FileSpreadsheet, Loader2, Upload } from "lucide-react"

type LoNgan = { ma: string; dauHang: string; ngayNhap: string }
type May = {
  ten: string; mau: string; imei: string; serial: string; dungLuong: string; pin: string; tinhTrang: string
  loai: string; dangSim: string; ghiChu: string; giaNhap: number | ""; giaBan: number | ""
  loi: string
}

const bo = (s: string) =>
  String(s || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/gi, "d")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")

const COT: Record<keyof Omit<May, "loi">, string[]> = {
  ten: ["ten", "tensanpham", "tenmay", "model", "dongmay", "sanpham", "may"],
  mau: ["mau", "mausac", "color"],
  imei: ["imei", "imei1", "soimei"],
  serial: ["serial", "seri", "sn", "soserial"],
  dungLuong: ["dungluong", "dl", "bonho", "rom", "capacity"],
  pin: ["pin", "battery", "pinsac"],
  tinhTrang: ["hinhthuc", "tinhtrang", "tinhtrangmay", "ngoaihinh", "dep"],
  loai: ["loai", "loaimay", "phienban", "ban"],
  dangSim: ["dangsim", "sim"],
  ghiChu: ["ghichu", "note"],
  giaNhap: ["gianhap", "von", "giavon", "gia"],
  giaBan: ["giaban", "giale"],
}

function phanTich(hang: string[][]) {
  // tìm dòng tiêu đề trong 15 dòng đầu: dòng có cột IMEI hoặc Serial
  let h = -1
  for (let i = 0; i < Math.min(15, hang.length); i++) {
    const n = (hang[i] || []).map(bo)
    if (n.some((x) => COT.imei.includes(x) || COT.serial.includes(x))) {
      h = i
      break
    }
  }
  if (h < 0) throw new Error("Không thấy cột IMEI hoặc Serial trong file. Dòng tiêu đề cần có chữ IMEI.")
  const tieuDe = hang[h].map(bo)
  const viTri: Partial<Record<keyof typeof COT, number>> = {}
  for (const [k, ds] of Object.entries(COT) as [keyof typeof COT, string[]][]) {
    const i = tieuDe.findIndex((x) => ds.includes(x))
    if (i !== -1) viTri[k] = i
  }
  const so = (s: string) => {
    const d = String(s || "").replace(/[^\d]/g, "")
    return d ? Number(d) : ("" as const)
  }
  const ds: May[] = []
  for (const r of hang.slice(h + 1)) {
    if (!r || !r.some((x) => String(x || "").trim())) continue
    const g = (k: keyof typeof COT) => (viTri[k] !== undefined ? String(r[viTri[k]!] ?? "").trim() : "")
    const imei = g("imei").replace(/\s/g, "")
    const serial = g("serial").replace(/\s/g, "").toUpperCase()
    if (!imei && !serial && !g("ten")) continue
    ds.push({
      ten: g("ten"),
      mau: g("mau"),
      imei,
      serial,
      dungLuong: g("dungLuong"),
      pin: g("pin"),
      tinhTrang: g("tinhTrang"),
      loai: g("loai"),
      dangSim: g("dangSim"),
      ghiChu: g("ghiChu"),
      giaNhap: so(g("giaNhap")),
      giaBan: so(g("giaBan")),
      loi: "",
    })
  }
  return { ds, cot: Object.keys(viTri) as (keyof typeof COT)[] }
}

function kiemTra(ds: May[]): May[] {
  const dem = new Map<string, number>()
  for (const m of ds) for (const id of [m.imei, m.serial].filter(Boolean)) dem.set(id, (dem.get(id) || 0) + 1)
  return ds.map((m) => {
    let loi = ""
    if (!m.imei && !m.serial) loi = "Thiếu IMEI/Serial"
    else if (m.imei && !/^\d{15}$/.test(m.imei)) loi = "IMEI không đủ 15 số"
    else if ([m.imei, m.serial].filter(Boolean).some((id) => (dem.get(id) || 0) > 1)) loi = "Trùng trong file"
    else if (!m.ten) loi = "Thiếu tên máy"
    return { ...m, loi }
  })
}

const TEN_COT: Record<string, string> = { ten: "Tên", mau: "Màu", imei: "IMEI", serial: "Serial", dungLuong: "Dung lượng", pin: "Pin", tinhTrang: "Hình thức", loai: "Loại", dangSim: "Dạng sim", ghiChu: "Ghi chú", giaNhap: "Giá nhập", giaBan: "Giá bán" }
const LOAI_GOI_Y = ["Lock", "Quốc tế", "Wifi", "4G"]

function Trang() {
  const { toast } = useToast()
  const { me } = useAuthMe()
  const fileRef = useRef<HTMLInputElement>(null)
  const [lo, setLo] = useState<LoNgan[]>([])
  const [dauHang, setDauHang] = useState<{ id: string; ten: string }[]>([])
  const [maLo, setMaLo] = useState("")
  const [taoMoi, setTaoMoi] = useState(false)
  const [loMoi, setLoMoi] = useState({ dauHangId: "", ngayNhap: new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 10) })
  const [tenFile, setTenFile] = useState("")
  const [ds, setDs] = useState<May[]>([])
  const [cotThay, setCotThay] = useState<string[]>([])
  const [loaiChung, setLoaiChung] = useState("Lock")
  const [gnChung, setGnChung] = useState<number | "">("")
  const [gbChung, setGbChung] = useState<number | "">("")
  const [dang, setDang] = useState(false)
  const [ketQua, setKetQua] = useState<{ added: number; boQua: string[]; soLo: any; maLo: string } | null>(null)

  const taiLo = async () => {
    try {
      const r = await fetch("/api/tai-chinh/lo-nhap", { cache: "no-store" })
      const j = await r.json()
      setLo((j.lo || []).filter((l: LoNgan) => !l.ma.startsWith("LO-CU")))
      setDauHang(j.dauHang || [])
    } catch {}
  }
  useEffect(() => {
    taiLo()
  }, [])

  const chonFile = async (f: File | undefined) => {
    if (!f) return
    setKetQua(null)
    try {
      const { ds: d, cot } = phanTich(await docFileBang(f))
      if (!d.length) throw new Error("File không có dòng máy nào")
      setTenFile(f.name)
      setCotThay(cot)
      setDs(kiemTra(d))
    } catch (e: any) {
      toast({ title: "Không đọc được file", description: e.message, variant: "destructive" })
    } finally {
      if (fileRef.current) fileRef.current.value = ""
    }
  }

  const sua = (i: number, k: keyof May, v: any) => setDs((x) => kiemTra(x.map((m, j) => (j === i ? { ...m, [k]: v } : m))))
  const hopLe = ds.filter((m) => !m.loi)
  const giaNhapCuoi = (m: May) => (m.giaNhap !== "" ? m.giaNhap : gnChung)
  const giaBanCuoi = (m: May) => (m.giaBan !== "" ? m.giaBan : gbChung)
  const thieuGia = hopLe.filter((m) => !giaNhapCuoi(m)).length
  const tongVon = hopLe.reduce((s, m) => s + (Number(giaNhapCuoi(m)) || 0), 0)
  const loChon = lo.find((l) => l.ma === maLo)
  const tatCa = me?.activeBranch === "all"

  const nhap = async () => {
    setDang(true)
    try {
      let ma = maLo
      let ngay = loChon?.ngayNhap || ""
      let tenDH = loChon?.dauHang || ""
      if (taoMoi) {
        if (!loMoi.dauHangId) throw new Error("Chọn đầu hàng cho lô mới")
        const r = await fetch("/api/tai-chinh/lo-nhap", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(loMoi) })
        const j = await r.json()
        if (!r.ok) throw new Error(j.error || "Không tạo được lô")
        ma = j.ma
        ngay = loMoi.ngayNhap
        tenDH = dauHang.find((d) => d.id === loMoi.dauHangId)?.ten || ""
      }
      if (!ma) throw new Error("Chọn lô hoặc tạo lô mới")
      const products = hopLe.map((m) => ({
        ten_san_pham: m.ten,
        loai_may: m.loai || loaiChung,
        dung_luong: m.dungLuong,
        mau_sac: m.mau,
        imei: m.imei,
        serial: m.serial,
        pin: m.pin,
        tinh_trang: m.tinhTrang,
        do_sim: m.dangSim,
        ghi_chu: m.ghiChu,
        gia_nhap: giaNhapCuoi(m),
        gia_ban: giaBanCuoi(m),
        ngay_nhap: ngay || undefined,
        nguon_nhap: tenDH,
      }))
      const r = await fetch("/api/kho-hang", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ products, ma_lo: ma, bo_qua_trung: true, employeeId: me?.name || me?.email || "" }),
      })
      const j = await r.json()
      if (!r.ok) throw new Error(j.error || `Lỗi ${r.status}`)
      setKetQua({ added: j.added, boQua: j.bo_qua || [], soLo: j.so_lo, maLo: ma })
      setDs([])
      setTenFile("")
      setTaoMoi(false)
      setMaLo(ma)
      taiLo()
      toast({ title: `Đã nhập ${j.added} máy vào kho, lô ${ma}` })
    } catch (e: any) {
      toast({ title: "Không nhập được", description: e.message, variant: "destructive" })
    } finally {
      setDang(false)
    }
  }

  const o = "h-8 w-full min-w-0 rounded border bg-background px-1.5 text-sm"
  return (
    <div className="space-y-4 p-4 md:p-6">
      <QuanTriTabs />
      <div>
        <h1 className="text-xl font-semibold md:text-2xl">Nhập lô từ Excel</h1>
        <p className="text-sm text-muted-foreground">
          File cần dòng tiêu đề có các cột: Tên, Màu, IMEI (hoặc Serial), Dung lượng, Pin, Hình thức. Có thể thêm cột Loại, Giá nhập, Giá bán, Dạng sim, Ghi chú. ID máy tự tạo từ IMEI.
        </p>
      </div>
      {tatCa && <div className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm dark:bg-amber-950/40">Đang xem tất cả chi nhánh. Chọn DEV PỒ hoặc T1s ở góc trên trước khi nhập.</div>}

      <section className="space-y-2 rounded-xl border bg-card p-3">
        <div className="font-medium">1. Lô nhập</div>
        <div className="flex flex-wrap gap-2 text-sm">
          <button className={cn("rounded-md border px-3 py-1", !taoMoi && "bg-foreground text-background")} onClick={() => setTaoMoi(false)}>
            Lô có sẵn
          </button>
          <button className={cn("rounded-md border px-3 py-1", taoMoi && "bg-foreground text-background")} onClick={() => setTaoMoi(true)}>
            Tạo lô mới
          </button>
        </div>
        {!taoMoi ? (
          <select className="h-9 w-full rounded-md border bg-background px-2 text-sm md:w-96" value={maLo} onChange={(e) => setMaLo(e.target.value)}>
            <option value="">Chọn lô</option>
            {lo.map((l) => (
              <option key={l.ma} value={l.ma}>
                {l.ma} · {l.dauHang} · {l.ngayNhap.split("-").reverse().join("/")}
              </option>
            ))}
          </select>
        ) : (
          <div className="flex flex-wrap gap-2">
            <select className="h-9 rounded-md border bg-background px-2 text-sm" value={loMoi.dauHangId} onChange={(e) => setLoMoi({ ...loMoi, dauHangId: e.target.value })}>
              <option value="">Chọn đầu hàng</option>
              {dauHang.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.ten}
                </option>
              ))}
            </select>
            <Input type="date" className="w-44" value={loMoi.ngayNhap} onChange={(e) => setLoMoi({ ...loMoi, ngayNhap: e.target.value })} />
            <span className="w-full text-xs text-muted-foreground">Đầu hàng chưa có thì chủ shop thêm ở Tài chính → Đầu hàng & CTV. Chi phí lô, tiền đã trả, hạn trả nhập ở Tài chính → Lô hàng.</span>
          </div>
        )}
      </section>

      <section className="space-y-2 rounded-xl border bg-card p-3">
        <div className="font-medium">2. Giá và loại máy chung cho cả lô</div>
        <p className="text-xs text-muted-foreground">Dùng cho máy nào trong file không có cột tương ứng. Sửa riêng từng máy ở bảng bên dưới.</p>
        <div className="grid grid-cols-1 gap-2 text-sm md:grid-cols-3">
          <label className="grid gap-1">
            Loại máy
            <div className="flex gap-1">
              <Input value={loaiChung} onChange={(e) => setLoaiChung(e.target.value)} list="loai-goi-y" />
              <datalist id="loai-goi-y">
                {LOAI_GOI_Y.map((l) => (
                  <option key={l} value={l} />
                ))}
              </datalist>
            </div>
          </label>
          <label className="grid gap-1">
            Giá nhập mỗi máy
            <OTien value={gnChung} onChange={setGnChung} />
          </label>
          <label className="grid gap-1">
            Giá bán mỗi máy
            <OTien value={gbChung} onChange={setGbChung} />
          </label>
        </div>
      </section>

      <section className="space-y-2 rounded-xl border bg-card p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="font-medium">3. File máy</div>
          <div className="flex items-center gap-2">
            {tenFile && (
              <span className="flex items-center gap-1 text-sm text-muted-foreground">
                <FileSpreadsheet className="h-4 w-4" /> {tenFile}
              </span>
            )}
            <input ref={fileRef} type="file" accept=".xlsx,.csv,.tsv,.txt" className="hidden" onChange={(e) => chonFile(e.target.files?.[0])} />
            <Button size="sm" variant="outline" onClick={() => fileRef.current?.click()}>
              <Upload className="mr-1 h-4 w-4" /> {tenFile ? "Chọn file khác" : "Tải file Excel lên"}
            </Button>
          </div>
        </div>
        {!ds.length && !ketQua && (
          <div
            className="rounded-lg border-2 border-dashed p-6 text-center text-sm text-muted-foreground"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault()
              chonFile(e.dataTransfer.files?.[0])
            }}
          >
            Kéo file .xlsx hoặc .csv vào đây, hoặc bấm “Tải file Excel lên”. Google Sheets: Tệp → Tải xuống → .xlsx.
          </div>
        )}
        {ketQua && (
          <div className="rounded-lg border border-emerald-300 bg-emerald-50 p-3 text-sm dark:bg-emerald-950/40">
            Đã nhập {ketQua.added} máy vào kho và sổ lô {ketQua.maLo}.
            {ketQua.boQua.length > 0 && <div className="text-amber-700">Bỏ qua {ketQua.boQua.length} máy đã có trong kho: {ketQua.boQua.join(", ")}</div>}
            {ketQua.soLo && ketQua.soLo.ok === false && <div className="text-red-600">{ketQua.soLo.error}</div>}
          </div>
        )}
        {ds.length > 0 && (
          <>
            <div className="text-xs text-muted-foreground">
              Đọc được {ds.length} máy · cột nhận ra: {cotThay.map((k) => TEN_COT[k] || k).join(", ")}
              {ds.length - hopLe.length > 0 && <span className="text-red-600"> · {ds.length - hopLe.length} dòng lỗi sẽ bị bỏ qua</span>}
            </div>
            <div className="overflow-x-auto rounded-lg border">
              <table className="w-full min-w-[980px] text-sm">
                <thead className="bg-muted/50 text-xs text-muted-foreground">
                  <tr className="[&>th]:px-1.5 [&>th]:py-2 [&>th]:text-left">
                    <th>#</th>
                    <th>Tên</th>
                    <th>Màu</th>
                    <th>IMEI / Serial</th>
                    <th>Dung lượng</th>
                    <th>Pin</th>
                    <th>Hình thức</th>
                    <th>Loại</th>
                    <th>Giá nhập</th>
                    <th>Giá bán</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {ds.map((m, i) => (
                    <tr key={i} className={cn("border-t [&>td]:px-1.5 [&>td]:py-1", m.loi && "bg-red-50 dark:bg-red-950/30")}>
                      <td className="text-xs text-muted-foreground">{i + 1}</td>
                      <td><input className={o} value={m.ten} onChange={(e) => sua(i, "ten", e.target.value)} /></td>
                      <td><input className={o} value={m.mau} onChange={(e) => sua(i, "mau", e.target.value)} /></td>
                      <td className="min-w-[150px]"><input className={cn(o, "font-mono text-xs")} value={m.imei || m.serial} onChange={(e) => sua(i, m.imei || !m.serial ? "imei" : "serial", e.target.value.trim())} /></td>
                      <td><input className={o} value={m.dungLuong} onChange={(e) => sua(i, "dungLuong", e.target.value)} /></td>
                      <td><input className={o} value={m.pin} onChange={(e) => sua(i, "pin", e.target.value)} /></td>
                      <td><input className={o} value={m.tinhTrang} onChange={(e) => sua(i, "tinhTrang", e.target.value)} /></td>
                      <td><input className={o} value={m.loai} placeholder={loaiChung} onChange={(e) => sua(i, "loai", e.target.value)} /></td>
                      <td className="w-32"><OTien className="h-8" value={m.giaNhap} placeholder={gnChung ? vnd(gnChung) : "0"} onChange={(v) => sua(i, "giaNhap", v)} /></td>
                      <td className="w-32"><OTien className="h-8" value={m.giaBan} placeholder={gbChung ? vnd(gbChung) : "0"} onChange={(v) => sua(i, "giaBan", v)} /></td>
                      <td className="whitespace-nowrap text-xs">
                        {m.loi ? <span className="text-red-600">{m.loi}</span> : null}
                        <button className="ml-1 text-muted-foreground hover:text-red-600" title="Bỏ dòng này" onClick={() => setDs((x) => kiemTra(x.filter((_, j) => j !== i)))}>
                          ✕
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-sm">
                {hopLe.length} máy · tổng giá nhập <b>{vnd(tongVon)}</b>
                {thieuGia > 0 && <span className="text-amber-700"> · {thieuGia} máy chưa có giá nhập (lãi sẽ tính sai, sửa sau được)</span>}
              </div>
              <Button onClick={nhap} disabled={dang || !hopLe.length || tatCa || (!taoMoi && !maLo) || (taoMoi && !loMoi.dauHangId)}>
                {dang ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : null}
                Nhập {hopLe.length} máy vào kho
              </Button>
            </div>
          </>
        )}
      </section>
    </div>
  )
}

export default function Page() {
  return (
    <ProtectedRoute requiredRole="quan_ly">
      <Trang />
    </ProtectedRoute>
  )
}
