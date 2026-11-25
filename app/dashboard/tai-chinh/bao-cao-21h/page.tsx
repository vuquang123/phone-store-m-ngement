"use client"
// Tài chính · Báo cáo 21h: xem báo cáo lúc này, lịch sử các ngày, bài đăng soạn sẵn, áp dụng giá đề xuất.
import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { ProtectedRoute } from "@/components/auth/protected-route"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"
import { DangTai, KhungTrang, Nhan, OTien, The, goiApi, ngayVN, vnd } from "@/components/tai-chinh/chung"
import { Copy, Send } from "lucide-react"

type Top = { ten: string; imei: string; maLo: string; tuoi: number; diem: number; giaHienTai: number; giaDeXuat: number; canDuyet: boolean; lyDo: string; dongKho: number }
type BaoCao = {
  ngay: string; chiNhanh: string; taoLuc: string
  homNay: { soMay: number; soDon: number; doanhThu: number; lai: number; daThu: number; chiPhiNgoai?: number }
  apLuc: { no3: number; no7: number; quaHan: number; tienHienCo: number; nguonTien: "nhap_tay" | "nguon_tien" | "tien_hien_co"; tienCapNhatLuc?: string; tienSoNgayCu?: number | null; tienSapVe?: number; tienThieu: number; giaVonTB: number; soMayCanBan: number }
  top: Top[]
  thuongCtv: { ten: string; imei: string; tuoi: number; thuong: number }[]
  baiDang: string
}
type LichSu = { ngay: string; chiNhanh: string; taoLuc: string; daGui: string; noiDung: BaoCao | null }

function Trang() {
  const { toast } = useToast()
  const [data, setData] = useState<{ hienTai: BaoCao; lichSu: LichSu[] } | null>(null)
  const [xem, setXem] = useState<"hien" | number>("hien")
  const [chon, setChon] = useState<Set<string>>(new Set())
  const [xacNhan, setXacNhan] = useState(false)
  const [soDu, setSoDu] = useState<number | "">("")
  const [dang, setDang] = useState("")
  const tai = useCallback(async () => {
    try {
      setData(await goiApi("/api/tai-chinh/bao-cao-21h"))
    } catch (e: any) {
      toast({ title: "Không tải được", description: e.message, variant: "destructive" })
    }
  }, [toast])
  useEffect(() => {
    tai()
  }, [tai])
  const b: BaoCao | null = !data ? null : xem === "hien" ? data.hienTai : data.lichSu[xem]?.noiDung || null
  const coTheHa = useMemo(() => (b?.top || []).filter((m) => m.giaDeXuat < m.giaHienTai && m.dongKho), [b])
  useEffect(() => {
    setChon(new Set(coTheHa.filter((m) => !m.canDuyet).map((m) => m.imei)))
  }, [coTheHa])

  const chay = async (gui: boolean) => {
    setDang(gui ? "gui" : "chay")
    try {
      const r = await goiApi<{ daGui: string }>("/api/tai-chinh/bao-cao-21h", "POST", { action: "chay", gui })
      toast({ title: gui ? r.daGui : "Đã lưu báo cáo hôm nay" })
      await tai()
    } catch (e: any) {
      toast({ title: "Lỗi", description: e.message, variant: "destructive" })
    } finally {
      setDang("")
    }
  }
  const apDung = async () => {
    setDang("gia")
    try {
      const items = coTheHa.filter((m) => chon.has(m.imei)).map((m) => ({ dongKho: m.dongKho, imei: m.imei, giaMoi: m.giaDeXuat, lyDo: m.lyDo }))
      const r = await goiApi<{ updated: number }>("/api/tai-chinh/bao-cao-21h", "POST", { action: "ap-dung-gia", items })
      toast({ title: `Đã đổi giá ${r.updated} máy trong kho` })
      setXacNhan(false)
      await tai()
    } catch (e: any) {
      toast({ title: "Không áp dụng được", description: e.message, variant: "destructive" })
    } finally {
      setDang("")
    }
  }
  const luuSoDu = async () => {
    try {
      await goiApi("/api/tai-chinh/cai-dat", "PUT", { soDuTay: soDu === "" ? "" : soDu })
      toast({ title: soDu === "" ? "Đã bỏ số dư nhập tay" : "Đã lưu số dư hôm nay" })
      tai()
    } catch (e: any) {
      toast({ title: "Lỗi", description: e.message, variant: "destructive" })
    }
  }

  return (
    <KhungTrang
      tieuDe="Báo cáo 21h"
      moTa="Tự chạy 21:00 mỗi tối và gửi riêng cho chủ shop qua Telegram. Ở đây xem lại, chạy tay, áp dụng giá."
      phai={
        <div className="flex gap-2">
          <Button variant="outline" size="sm" disabled={!!dang} onClick={() => chay(false)}>
            Lưu bản hôm nay
          </Button>
          <Button size="sm" disabled={!!dang} onClick={() => chay(true)}>
            <Send className="mr-1 h-4 w-4" /> {dang === "gui" ? "Đang gửi…" : "Gửi Telegram ngay"}
          </Button>
        </div>
      }
    >
      {!data ? (
        <DangTai />
      ) : (
        <>
          <div className="-mx-4 flex gap-1 overflow-x-auto px-4 text-sm md:mx-0 md:px-0">
            <button className={cn("shrink-0 rounded-md border px-3 py-1", xem === "hien" && "bg-foreground text-background")} onClick={() => setXem("hien")}>
              Lúc này
            </button>
            {data.lichSu.map((l, i) => (
              <button key={`${l.ngay}${l.chiNhanh}`} className={cn("shrink-0 rounded-md border px-3 py-1", xem === i && "bg-foreground text-background")} onClick={() => setXem(i)} title={l.daGui}>
                {l.ngay}
              </button>
            ))}
          </div>
          {!b ? (
            <div className="py-8 text-center text-sm text-muted-foreground">Bản này không đọc được</div>
          ) : (
            <>
              <div className="text-xs text-muted-foreground">
                Tạo lúc {b.taoLuc} · {b.chiNhanh}
                {xem !== "hien" && ` · ${data.lichSu[xem as number]?.daGui}`}
              </div>
              <section className="space-y-2">
                <h2 className="font-medium">1. Hôm nay</h2>
                <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
                  <The nhan="Đã bán" giaTri={`${b.homNay.soMay} máy`} phu={`${b.homNay.soDon} đơn`} />
                  <The nhan="Doanh thu" giaTri={vnd(b.homNay.doanhThu)} />
                  <The nhan="Lãi" giaTri={vnd(b.homNay.lai)} phu={b.homNay.chiPhiNgoai ? `Đã trừ chi phí ngoài ${vnd(b.homNay.chiPhiNgoai)}` : undefined} />
                  <The nhan="Tiền đã thu" giaTri={vnd(b.homNay.daThu)} />
                </div>
              </section>
              <section className="space-y-2">
                <h2 className="font-medium">2. Áp lực tiền</h2>
                <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
                  <The nhan="Nợ đến hạn 3 ngày" giaTri={vnd(b.apLuc.no3)} mau={b.apLuc.no3 ? "vang" : undefined} />
                  <The nhan="Nợ đến hạn 7 ngày" giaTri={vnd(b.apLuc.no7)} phu={b.apLuc.quaHan ? `Gồm quá hạn ${vnd(b.apLuc.quaHan)}` : undefined} />
                  <The nhan="Tiền hiện có" giaTri={vnd(b.apLuc.tienHienCo)} phu={
                      b.apLuc.nguonTien === "nhap_tay" ? (
                        "Số nhập tay hôm nay"
                      ) : b.apLuc.nguonTien === "tien_hien_co" ? (
                        <Link className="underline" href="/dashboard/tai-chinh/tien-hien-co">
                          Tiền hiện có · {b.apLuc.tienSoNgayCu == null ? "có nguồn chưa nhập" : b.apLuc.tienSoNgayCu <= 0 ? "cập nhật hôm nay" : `cập nhật ${b.apLuc.tienSoNgayCu} ngày trước`}
                          {b.apLuc.tienSapVe ? ` · thẻ sắp về ${vnd(b.apLuc.tienSapVe)}` : ""}
                        </Link>
                      ) : (
                        "App tự tính (chưa nhập Tiền hiện có)"
                      )
                    }
                    mau={b.apLuc.nguonTien === "tien_hien_co" && (b.apLuc.tienSoNgayCu ?? 99) > 2 ? "vang" : undefined}
                  />
                  <The
                    nhan={b.apLuc.tienThieu > 0 ? "Thiếu" : "Đủ tiền trả nợ 7 ngày"}
                    giaTri={b.apLuc.tienThieu > 0 ? vnd(b.apLuc.tienThieu) : "✓"}
                    phu={b.apLuc.tienThieu > 0 ? `Cần bán ~${b.apLuc.soMayCanBan} máy (giá vốn TB ${vnd(b.apLuc.giaVonTB)})` : undefined}
                    mau={b.apLuc.tienThieu > 0 ? "do" : "xanh"}
                  />
                </div>
                {xem === "hien" && (
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <span className="text-muted-foreground">Số dư thật hôm nay (nếu khác app):</span>
                    <OTien className="w-40" value={soDu} onChange={setSoDu} placeholder="Bỏ trống = tự tính" />
                    <Button size="sm" variant="outline" onClick={luuSoDu}>
                      Lưu
                    </Button>
                  </div>
                )}
              </section>
              <section className="space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 className="font-medium">3. Top 10 máy cần đẩy</h2>
                  {xem === "hien" && coTheHa.length > 0 && (
                    <Button size="sm" disabled={!chon.size} onClick={() => setXacNhan(true)}>
                      Áp dụng giá đề xuất ({chon.size})
                    </Button>
                  )}
                </div>
                <div className="divide-y rounded-xl border bg-card text-sm">
                  {b.top.map((m, i) => {
                    const ha = m.giaDeXuat < m.giaHienTai
                    return (
                      <div key={m.imei} className="flex items-start gap-2 px-3 py-2">
                        {xem === "hien" && ha && m.dongKho ? (
                          <input
                            type="checkbox"
                            className="mt-1"
                            checked={chon.has(m.imei)}
                            onChange={(e) => {
                              const s = new Set(chon)
                              e.target.checked ? s.add(m.imei) : s.delete(m.imei)
                              setChon(s)
                            }}
                          />
                        ) : (
                          <span className="w-4 text-xs text-muted-foreground">{i + 1}</span>
                        )}
                        <div className="min-w-0 flex-1">
                          <div className="truncate">{m.ten}</div>
                          <div className="text-xs text-muted-foreground">
                            {m.tuoi} ngày · {m.maLo || "chưa có lô"} · điểm {m.diem} · {m.lyDo}
                          </div>
                        </div>
                        <div className="shrink-0 text-right tabular-nums">
                          <div className={ha ? "text-muted-foreground line-through" : ""}>{vnd(m.giaHienTai)}</div>
                          {ha && <div className="font-medium text-amber-700">{vnd(m.giaDeXuat)}</div>}
                          {m.canDuyet && <Nhan mau="do">cần duyệt</Nhan>}
                        </div>
                      </div>
                    )
                  })}
                  {!b.top.length && <div className="py-6 text-center text-muted-foreground">Không có máy tồn</div>}
                </div>
              </section>
              <section className="space-y-2">
                <div className="flex items-center justify-between">
                  <h2 className="font-medium">4. Bài đăng soạn sẵn</h2>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      navigator.clipboard.writeText(b.baiDang)
                      toast({ title: "Đã chép bài đăng" })
                    }}
                  >
                    <Copy className="mr-1 h-4 w-4" /> Chép
                  </Button>
                </div>
                <Textarea readOnly rows={10} value={b.baiDang} className="font-mono text-xs" />
              </section>
              {b.thuongCtv.length > 0 && (
                <section className="space-y-2">
                  <h2 className="font-medium">5. Đề xuất thưởng CTV (máy 16+ ngày)</h2>
                  <div className="divide-y rounded-xl border bg-card text-sm">
                    {b.thuongCtv.map((m) => (
                      <div key={m.imei} className="flex justify-between px-3 py-2">
                        <span className="min-w-0 truncate">
                          {m.ten} · {m.tuoi} ngày
                        </span>
                        <span className="shrink-0 tabular-nums">+{vnd(m.thuong)}</span>
                      </div>
                    ))}
                  </div>
                </section>
              )}
            </>
          )}
        </>
      )}
      <Dialog open={xacNhan} onOpenChange={setXacNhan}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Đổi giá bán trong kho?</DialogTitle>
            <DialogDescription>Giá mới hiện ngay cho nhân viên. Mỗi lần đổi được lưu vào lịch sử giá.</DialogDescription>
          </DialogHeader>
          <div className="max-h-[50vh] divide-y overflow-y-auto text-sm">
            {coTheHa
              .filter((m) => chon.has(m.imei))
              .map((m) => (
                <div key={m.imei} className="flex justify-between gap-2 py-1.5">
                  <span className="min-w-0 truncate">{m.ten}</span>
                  <span className="shrink-0 tabular-nums">
                    {vnd(m.giaHienTai)} → <b>{vnd(m.giaDeXuat)}</b>
                    {m.canDuyet && <span className="ml-1 text-red-600">(dưới vốn/sàn)</span>}
                  </span>
                </div>
              ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setXacNhan(false)}>
              Huỷ
            </Button>
            <Button onClick={apDung} disabled={dang === "gia"}>
              {dang === "gia" ? "Đang đổi…" : "Đồng ý đổi giá"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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
