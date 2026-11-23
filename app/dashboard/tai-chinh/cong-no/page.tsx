"use client"
// Tài chính · Công nợ đầu hàng: nợ theo từng đầu hàng/lô, hạn trả, lịch tiền 7/14/30 ngày, ghi nhận trả tiền (FIFO).
import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { ProtectedRoute } from "@/components/auth/protected-route"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { useToast } from "@/hooks/use-toast"
import { DangTai, KhungTrang, Nhan, OTien, The, goiApi, homNayISO, ngayVN, vnd } from "@/components/tai-chinh/chung"

type Khoan = { maLo: string; dauHangId: string; ngayNhap: string; hanTra: string; conLai: number; noGoc: number; daTra: number; soNgayConLai: number; mau: "xanh" | "vang" | "do" | "het"; vonTon: number; canhBaoCheo: boolean; chiNhanh: string }
type Nhom = { dauHang: { id: string; ten: string; sdt: string; soNgayNo: number; nganHang: string; stk: string }; tongNo: number; quaHan: number; khoan: Khoan[]; lanTra: { id: string; ngay: string; soTien: number; phanBo: Record<string, number>; nguonTien: string; ghiChu: string; nguoiGhi: string }[] }
type Data = { tongNo: number; quaHan: number; lich: { d7: number; d14: number; d30: number }; theoDauHang: Nhom[]; canhBao: Khoan[]; nguonTien: { id: string; name: string; balance: number }[] }

const MAU = { xanh: "xanh", vang: "vang", do: "do", het: "xam" } as const
const chuHan = (k: Khoan) => (k.conLai <= 0 ? "Đã trả đủ" : k.soNgayConLai < 0 ? `Quá hạn ${-k.soNgayConLai} ngày` : k.soNgayConLai === 0 ? "Hạn hôm nay" : `Còn ${k.soNgayConLai} ngày`)

/** Xem trước phân bổ FIFO giống hệt máy chủ: lô chọn trước, rồi theo hạn trả, rồi ngày nhập. */
function phanBoThu(soTien: number, khoan: Khoan[], maLo: string) {
  const ds = khoan.filter((k) => k.conLai > 0).sort((a, b) => (a.maLo === maLo ? -1 : b.maLo === maLo ? 1 : 0) || a.hanTra.localeCompare(b.hanTra) || a.ngayNhap.localeCompare(b.ngayNhap))
  let con = soTien
  const out: [string, number][] = []
  for (const k of ds) {
    if (con <= 0) break
    const t = Math.min(con, k.conLai)
    out.push([k.maLo, t])
    con -= t
  }
  return { out, du: con }
}

function Trang() {
  const { toast } = useToast()
  const [d, setD] = useState<Data | null>(null)
  const [tra, setTra] = useState<{ nhom: Nhom; maLo: string } | null>(null)
  const tai = useCallback(async () => {
    try {
      setD(await goiApi("/api/tai-chinh/cong-no"))
    } catch (e: any) {
      toast({ title: "Không tải được", description: e.message, variant: "destructive" })
    }
  }, [toast])
  useEffect(() => {
    tai()
  }, [tai])
  return (
    <KhungTrang tieuDe="Công nợ đầu hàng" moTa="Xanh: còn trên 7 ngày · Vàng: 0–7 ngày · Đỏ: quá hạn. Trả tiền tự trừ vào lô đến hạn trước.">
      {!d ? (
        <DangTai />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
            <The nhan="Tổng nợ" giaTri={vnd(d.tongNo)} />
            <The nhan="Quá hạn" giaTri={vnd(d.quaHan)} mau={d.quaHan ? "do" : undefined} />
            <The nhan="Cần trả trong 7 ngày" giaTri={vnd(d.lich.d7)} mau={d.lich.d7 ? "vang" : undefined} />
            <The nhan="Trong 14 ngày" giaTri={vnd(d.lich.d14)} />
            <The nhan="Trong 30 ngày" giaTri={vnd(d.lich.d30)} />
          </div>
          {d.canhBao.length > 0 && (
            <div className="rounded-xl border border-red-300 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
              <div className="font-medium">Tiền bán lô này đã bị dùng vào việc khác, ưu tiên giữ tiền trả nợ</div>
              {d.canhBao.map((k) => (
                <div key={k.maLo}>
                  {k.maLo}: còn nợ {vnd(k.conLai)}, vốn còn trong tồn {vnd(k.vonTon)} (thiếu {vnd(k.conLai - k.vonTon)})
                </div>
              ))}
            </div>
          )}
          <div className="space-y-3">
            {d.theoDauHang.map((n) => (
              <div key={n.dauHang.id} className="rounded-xl border bg-card">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b p-3">
                  <div>
                    <div className="font-medium">{n.dauHang.ten}</div>
                    <div className="text-xs text-muted-foreground">
                      {n.dauHang.soNgayNo} ngày nợ{n.dauHang.sdt && ` · ${n.dauHang.sdt}`}
                      {n.dauHang.stk && ` · ${n.dauHang.nganHang} ${n.dauHang.stk}`}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <div className="font-semibold tabular-nums">{vnd(n.tongNo)}</div>
                      {n.quaHan > 0 && <div className="text-xs text-red-600">quá hạn {vnd(n.quaHan)}</div>}
                    </div>
                    <Button size="sm" disabled={n.tongNo <= 0} onClick={() => setTra({ nhom: n, maLo: "" })}>
                      Ghi nhận trả tiền
                    </Button>
                  </div>
                </div>
                <div className="divide-y text-sm">
                  {n.khoan.map((k) => (
                    <div key={k.maLo} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
                      <div>
                        <Link className="font-medium underline-offset-2 hover:underline" href={`/dashboard/tai-chinh/lo-hang?ma=${encodeURIComponent(k.maLo)}`}>
                          {k.maLo}
                        </Link>
                        <div className="text-xs text-muted-foreground">
                          Nhập {ngayVN(k.ngayNhap)} · hạn {ngayVN(k.hanTra)} · gốc {vnd(k.noGoc)} · đã trả {vnd(k.daTra)}
                        </div>
                      </div>
                      <div className="flex w-full flex-wrap items-center justify-end gap-2 md:w-auto">
                        <Nhan mau={k.conLai <= 0 ? "xam" : MAU[k.mau]}>{chuHan(k)}</Nhan>
                        {k.canhBaoCheo && <Nhan mau="do">Nợ &gt; vốn tồn</Nhan>}
                        <span className="w-28 text-right font-medium tabular-nums">{vnd(k.conLai)}</span>
                        {k.conLai > 0 && (
                          <Button size="sm" variant="ghost" onClick={() => setTra({ nhom: n, maLo: k.maLo })}>
                            Trả lô này
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
                {n.lanTra.length > 0 && (
                  <details className="border-t px-3 py-2 text-sm">
                    <summary className="cursor-pointer text-muted-foreground">Lịch sử trả ({n.lanTra.length})</summary>
                    {n.lanTra.map((t) => (
                      <div key={t.id} className="flex justify-between py-1">
                        <span>
                          {ngayVN(t.ngay)} · {Object.entries(t.phanBo).map(([m, v]) => `${m}: ${vnd(v)}`).join(", ")}
                          <span className="text-xs text-muted-foreground"> · {t.nguonTien}{t.ghiChu && ` · ${t.ghiChu}`}</span>
                        </span>
                        <span className="tabular-nums">{vnd(t.soTien)}</span>
                      </div>
                    ))}
                  </details>
                )}
              </div>
            ))}
            {!d.theoDauHang.length && <div className="py-10 text-center text-sm text-muted-foreground">Chưa có khoản nợ đầu hàng nào. Tạo lô ở mục Lô hàng.</div>}
          </div>
        </>
      )}
      {tra && d && <TraTienDialog nhom={tra.nhom} maLo={tra.maLo} nguonTien={d.nguonTien} onClose={() => setTra(null)} onDone={tai} />}
    </KhungTrang>
  )
}

function TraTienDialog({ nhom, maLo: maLoBanDau, nguonTien, onClose, onDone }: { nhom: Nhom; maLo: string; nguonTien: Data["nguonTien"]; onClose: () => void; onDone: () => void }) {
  const { toast } = useToast()
  const [soTien, setSoTien] = useState<number | "">("")
  const [maLo, setMaLo] = useState(maLoBanDau)
  const [ngay, setNgay] = useState(homNayISO())
  const [nguon, setNguon] = useState("")
  const [ghiChu, setGhiChu] = useState("")
  const [dang, setDang] = useState(false)
  const xem = useMemo(() => phanBoThu(Number(soTien) || 0, nhom.khoan, maLo), [soTien, nhom, maLo])
  const luu = async () => {
    setDang(true)
    try {
      await goiApi("/api/tai-chinh/cong-no", "POST", { dauHangId: nhom.dauHang.id, soTien, ngay, maLo, nguonTienId: nguon, ghiChu })
      toast({ title: `Đã ghi nhận trả ${vnd(Number(soTien))} cho ${nhom.dauHang.ten}` })
      onDone()
      onClose()
    } catch (e: any) {
      toast({ title: "Không ghi được", description: e.message, variant: "destructive" })
    } finally {
      setDang(false)
    }
  }
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Trả tiền cho {nhom.dauHang.ten}</DialogTitle>
          <DialogDescription>Đang nợ {vnd(nhom.tongNo)}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 text-sm">
          <label className="grid gap-1">
            Số tiền
            <OTien autoFocus value={soTien} onChange={setSoTien} />
          </label>
          <div className="grid grid-cols-2 gap-2">
            <label className="grid gap-1">
              Ngày trả
              <Input type="date" value={ngay} onChange={(e) => setNgay(e.target.value)} />
            </label>
            <label className="grid gap-1">
              Trả cho lô
              <select className="h-9 rounded-md border bg-background px-2" value={maLo} onChange={(e) => setMaLo(e.target.value)}>
                <option value="">Tự động (hạn sớm trước)</option>
                {nhom.khoan.filter((k) => k.conLai > 0).map((k) => (
                  <option key={k.maLo} value={k.maLo}>
                    {k.maLo} · {vnd(k.conLai)}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label className="grid gap-1">
            Trừ tiền từ
            <select className="h-9 rounded-md border bg-background px-2" value={nguon} onChange={(e) => setNguon(e.target.value)}>
              <option value="">Không trừ (đã trả ngoài app)</option>
              {nguonTien.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name} · {vnd(a.balance)}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1">
            Ghi chú
            <Input value={ghiChu} onChange={(e) => setGhiChu(e.target.value)} />
          </label>
          {Number(soTien) > 0 && (
            <div className="rounded-md bg-muted p-2 text-xs">
              <div className="mb-1 font-medium">Sẽ trừ vào:</div>
              {xem.out.map(([m, v]) => (
                <div key={m} className="flex justify-between">
                  <span>{m}</span>
                  <span className="tabular-nums">{vnd(v)}</span>
                </div>
              ))}
              {xem.du > 0 && <div className="mt-1 text-red-600">Vượt tổng nợ {vnd(xem.du)}, không ghi được.</div>}
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Huỷ
          </Button>
          <Button onClick={luu} disabled={dang || !Number(soTien) || xem.du > 0}>
            {dang ? "Đang ghi…" : "Xác nhận"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default function Page() {
  return (
    <ProtectedRoute requiredRole="chu_shop">
      <Trang />
    </ProtectedRoute>
  )
}
