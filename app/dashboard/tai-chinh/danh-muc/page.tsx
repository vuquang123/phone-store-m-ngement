"use client"
// Tài chính · Đầu hàng & CTV: danh sách nhà cung cấp (số ngày nợ, tài khoản) và cộng tác viên.
import { useCallback, useEffect, useState } from "react"
import { ProtectedRoute } from "@/components/auth/protected-route"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { useToast } from "@/hooks/use-toast"
import { DangTai, KhungTrang, Nhan, OTien, goiApi, vnd } from "@/components/tai-chinh/chung"
import { Plus } from "lucide-react"

type DauHang = { id: string; ten: string; sdt: string; soNgayNo: number; nganHang: string; stk: string; loaiHang: string; ghiChu: string; trangThai: string }
type Ctv = { id: string; ten: string; sdt: string; hoaHong: number; ghiChu: string; trangThai: string }
type Sua = { loai: "dau-hang"; x: Partial<DauHang> } | { loai: "ctv"; x: Partial<Ctv> }

function Trang() {
  const { toast } = useToast()
  const [d, setD] = useState<{ dauHang: DauHang[]; ctv: Ctv[] } | null>(null)
  const [sua, setSua] = useState<Sua | null>(null)
  const tai = useCallback(async () => {
    try {
      setD(await goiApi("/api/tai-chinh/danh-muc"))
    } catch (e: any) {
      toast({ title: "Không tải được", description: e.message, variant: "destructive" })
    }
  }, [toast])
  useEffect(() => {
    tai()
  }, [tai])
  return (
    <KhungTrang tieuDe="Đầu hàng & CTV">
      {!d ? (
        <DangTai />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          <section className="space-y-2">
            <div className="flex items-center justify-between">
              <h2 className="font-medium">Đầu hàng (nhà cung cấp)</h2>
              <Button size="sm" onClick={() => setSua({ loai: "dau-hang", x: { soNgayNo: 7 } })}>
                <Plus className="mr-1 h-4 w-4" /> Thêm
              </Button>
            </div>
            <div className="divide-y rounded-xl border bg-card text-sm">
              {d.dauHang.map((x) => (
                <button key={x.id} className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left hover:bg-muted/40" onClick={() => setSua({ loai: "dau-hang", x })}>
                  <div className="min-w-0">
                    <div className="font-medium">
                      {x.ten} {x.trangThai === "Ngừng" && <Nhan mau="xam">Ngừng</Nhan>}
                    </div>
                    <div className="text-xs text-muted-foreground">{[x.sdt, x.loaiHang, x.stk && `${x.nganHang} ${x.stk}`].filter(Boolean).join(" · ")}</div>
                  </div>
                  <span className="shrink-0 text-xs">{x.soNgayNo} ngày nợ</span>
                </button>
              ))}
              {!d.dauHang.length && <div className="py-6 text-center text-muted-foreground">Chưa có đầu hàng</div>}
            </div>
          </section>
          <section className="space-y-2">
            <div className="flex items-center justify-between">
              <h2 className="font-medium">Cộng tác viên</h2>
              <Button size="sm" onClick={() => setSua({ loai: "ctv", x: {} })}>
                <Plus className="mr-1 h-4 w-4" /> Thêm
              </Button>
            </div>
            <div className="divide-y rounded-xl border bg-card text-sm">
              {d.ctv.map((x) => (
                <button key={x.id} className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left hover:bg-muted/40" onClick={() => setSua({ loai: "ctv", x })}>
                  <div>
                    <div className="font-medium">
                      {x.ten} {x.trangThai === "Nghỉ" && <Nhan mau="xam">Nghỉ</Nhan>}
                    </div>
                    <div className="text-xs text-muted-foreground">{x.sdt}</div>
                  </div>
                  <span className="text-xs">Hoa hồng {vnd(x.hoaHong)}</span>
                </button>
              ))}
              {!d.ctv.length && <div className="py-6 text-center text-muted-foreground">Chưa có CTV</div>}
            </div>
          </section>
        </div>
      )}
      {sua && <SuaDialog sua={sua} onClose={() => setSua(null)} onDone={tai} />}
    </KhungTrang>
  )
}

function SuaDialog({ sua, onClose, onDone }: { sua: Sua; onClose: () => void; onDone: () => void }) {
  const { toast } = useToast()
  const [f, setF] = useState<any>({ ...sua.x })
  const moi = !sua.x.id
  const luu = async () => {
    try {
      await goiApi("/api/tai-chinh/danh-muc", moi ? "POST" : "PATCH", { loai: sua.loai, ...f })
      onDone()
      onClose()
    } catch (e: any) {
      toast({ title: "Không lưu được", description: e.message, variant: "destructive" })
    }
  }
  const o = (k: string, nhan: string, props: any = {}) => (
    <label className="grid gap-1">
      {nhan}
      <Input value={f[k] ?? ""} onChange={(e) => setF({ ...f, [k]: e.target.value })} {...props} />
    </label>
  )
  return (
    <Dialog open onOpenChange={(x) => !x && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{moi ? "Thêm" : "Sửa"} {sua.loai === "ctv" ? "CTV" : "đầu hàng"}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3 text-sm">
          {o("ten", "Tên")}
          {o("sdt", "Số điện thoại", { inputMode: "tel" })}
          {sua.loai === "dau-hang" ? (
            <>
              {o("soNgayNo", "Số ngày nợ (hạn trả mặc định)", { inputMode: "numeric" })}
              <div className="grid grid-cols-2 gap-2">
                {o("nganHang", "Ngân hàng")}
                {o("stk", "Số tài khoản")}
              </div>
              {o("loaiHang", "Loại hàng hay nhập")}
            </>
          ) : (
            <label className="grid gap-1">
              Hoa hồng mặc định
              <OTien value={f.hoaHong || ""} onChange={(v) => setF({ ...f, hoaHong: v || 0 })} />
            </label>
          )}
          {o("ghiChu", "Ghi chú")}
          {!moi && (
            <label className="grid gap-1">
              Trạng thái
              <select className="h-9 rounded-md border bg-background px-2" value={f.trangThai || ""} onChange={(e) => setF({ ...f, trangThai: e.target.value })}>
                {sua.loai === "ctv" ? (
                  <>
                    <option value="Đang làm">Đang làm</option>
                    <option value="Nghỉ">Nghỉ</option>
                  </>
                ) : (
                  <>
                    <option value="Đang nhập">Đang nhập</option>
                    <option value="Ngừng">Ngừng</option>
                  </>
                )}
              </select>
            </label>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Huỷ
          </Button>
          <Button onClick={luu} disabled={!String(f.ten || "").trim()}>
            Lưu
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
