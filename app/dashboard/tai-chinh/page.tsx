"use client"
// Tài chính · Tổng quan (chỉ chủ shop): tiền hiện có, tài sản ròng, vốn tồn, nợ đầu hàng, lãi tháng, tuổi tồn, cảnh báo.
import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { ProtectedRoute } from "@/components/auth/protected-route"
import { Button } from "@/components/ui/button"
import { useToast } from "@/hooks/use-toast"
import { DangTai, KhungTrang, Nhan, The, goiApi, vnd } from "@/components/tai-chinh/chung"
import { RefreshCw } from "lucide-react"

type TongQuan = {
  homNay: string
  khachConNo: number
  tienHienCo: { coDuLieu: boolean; tong: number; tienDon: number; sapVe: number; soNguon: number; capNhatLuc: string; soNgayCu: number | null }
  taiSanRong: number | null
  vonTon: number
  soMayTon: number
  mayChuaCoLo: number
  mayThieuGiaNhap: number
  tongNo: number
  noDenHan7: number
  quaHan: number
  laiThang: number
  doanhThuThang: number
  chiPhiLoThang: number
  chiPhiNgoaiThang: number
  soMayBanThang: number
  ton15: number
  ton30: number
  tuoi: Record<"0-7" | "8-15" | "16-30" | ">30", { n: number; von: number }>
  lich: { d7: number; d14: number; d30: number }
  canhBao: { maLo: string; conLai: number; vonTon: number }[]
  top5: { ten: string; imei: string; serial: string; maLo: string; tuoi: number; diem: number; giaBanMucTieu: number; deXuat: { giaDeXuat: number; canDuyet: boolean } | null }[]
}

const doCu = (n: number | null) => (n === null ? "có nguồn chưa nhập" : n <= 0 ? "cập nhật hôm nay" : n === 1 ? "cập nhật hôm qua" : `cập nhật ${n} ngày trước`)

const MAU_TUOI: Record<string, string> = { "0-7": "bg-emerald-500", "8-15": "bg-sky-500", "16-30": "bg-amber-500", ">30": "bg-red-500" }

function Trang() {
  const { toast } = useToast()
  const [d, setD] = useState<TongQuan | null>(null)
  const [dang, setDang] = useState(false)
  const tai = useCallback(async () => {
    setDang(true)
    try {
      setD(await goiApi<TongQuan>("/api/tai-chinh/tong-quan"))
    } catch (e: any) {
      toast({ title: "Không tải được", description: e.message, variant: "destructive" })
    } finally {
      setDang(false)
    }
  }, [toast])
  useEffect(() => {
    tai()
  }, [tai])

  const maxN = d ? Math.max(1, ...Object.values(d.tuoi).map((x) => x.n)) : 1
  return (
    <KhungTrang
      tieuDe="Tài chính"
      moTa="Số liệu tính trực tiếp từ kho, đơn bán, sổ lô và các lần trả nợ."
      phai={
        <Button variant="outline" size="sm" onClick={tai} disabled={dang}>
          <RefreshCw className={dang ? "mr-1 h-4 w-4 animate-spin" : "mr-1 h-4 w-4"} /> Tải lại
        </Button>
      }
    >
      {!d ? (
        <DangTai />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
            <The
              nhan="Tiền hiện có"
              giaTri={d.tienHienCo.coDuLieu ? vnd(d.tienHienCo.tong) : "Chưa nhập"}
              phu={
                <Link className="underline" href="/dashboard/tai-chinh/tien-hien-co">
                  {d.tienHienCo.coDuLieu
                    ? `${d.tienHienCo.soNguon} nguồn · ${doCu(d.tienHienCo.soNgayCu)}${d.tienHienCo.tienDon ? ` · gồm tiền đơn ${vnd(d.tienHienCo.tienDon)}` : ""}${d.tienHienCo.sapVe ? ` · thẻ sắp về ${vnd(d.tienHienCo.sapVe)}` : ""}`
                    : "Nhập số dư các nguồn tiền"}
                </Link>
              }
              mau={!d.tienHienCo.coDuLieu || d.tienHienCo.soNgayCu === null || d.tienHienCo.soNgayCu > 2 ? "vang" : undefined}
            />
            <The
              nhan="Tài sản ròng"
              giaTri={d.taiSanRong === null ? "—" : vnd(d.taiSanRong)}
              phu={
                d.taiSanRong === null
                  ? "Cần nhập Tiền hiện có"
                  : `Tiền ${vnd(d.tienHienCo.tong)} + tồn ${vnd(d.vonTon)} + khách nợ ${vnd(d.khachConNo)} − nợ đầu hàng ${vnd(d.tongNo)}`
              }
              mau={d.taiSanRong !== null && d.taiSanRong < 0 ? "do" : d.taiSanRong !== null ? "xanh" : undefined}
            />
            <The nhan="Khách còn nợ" giaTri={vnd(d.khachConNo)} phu="Trả góp / COD chưa về, chưa đánh dấu đã thu đủ" />
            <The
              nhan="Tiền so với nợ 7 ngày"
              giaTri={!d.tienHienCo.coDuLieu ? "—" : d.tienHienCo.tong >= d.lich.d7 ? "Đủ" : `Thiếu ${vnd(d.lich.d7 - d.tienHienCo.tong)}`}
              phu={d.tienHienCo.coDuLieu ? `Nợ đến hạn 7 ngày ${vnd(d.lich.d7)}` : "Cần nhập Tiền hiện có"}
              mau={!d.tienHienCo.coDuLieu ? undefined : d.tienHienCo.tong >= d.lich.d7 ? "xanh" : "do"}
            />
            <The nhan="Vốn đang nằm trong tồn" giaTri={vnd(d.vonTon)} phu={`${d.soMayTon} máy`} />
            <The nhan="Tổng nợ đầu hàng" giaTri={vnd(d.tongNo)} phu={d.quaHan ? `Quá hạn ${vnd(d.quaHan)}` : "Không có khoản quá hạn"} mau={d.quaHan ? "do" : undefined} />
            <The nhan="Nợ đến hạn 7 ngày" giaTri={vnd(d.lich.d7)} phu={`14 ngày: ${vnd(d.lich.d14)} · 30 ngày: ${vnd(d.lich.d30)}`} mau={d.lich.d7 ? "vang" : undefined} />
            <The
              nhan="Lãi tháng này"
              giaTri={vnd(d.laiThang)}
              phu={`${d.soMayBanThang} máy · DT ${vnd(d.doanhThuThang)} · đã trừ chi phí lô ${vnd(d.chiPhiLoThang)}, chi phí ngoài ${vnd(d.chiPhiNgoaiThang)}`}
              mau={d.laiThang < 0 ? "do" : "xanh"}
            />
            <The nhan="Máy tồn trên 15 ngày" giaTri={d.ton15} mau={d.ton15 ? "vang" : undefined} />
            <The nhan="Máy tồn trên 30 ngày" giaTri={d.ton30} mau={d.ton30 ? "do" : undefined} />
            <The nhan="Máy chưa có lô" giaTri={d.mayChuaCoLo} phu={d.mayChuaCoLo ? <Link className="underline" href="/dashboard/tai-chinh/lo-hang">Gán vào lô</Link> : "Đủ"} />
            <The nhan="Máy thiếu giá nhập" giaTri={d.mayThieuGiaNhap} phu="Cần nhập để tính lãi đúng" mau={d.mayThieuGiaNhap ? "vang" : undefined} />
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded-xl border bg-card p-3">
              <div className="mb-2 text-sm font-medium">Tuổi tồn kho</div>
              <div className="space-y-2">
                {(Object.keys(d.tuoi) as (keyof TongQuan["tuoi"])[]).map((k) => (
                  <div key={k} className="flex items-center gap-2 text-sm">
                    <div className="w-20 shrink-0 whitespace-nowrap text-muted-foreground">{k} ngày</div>
                    <div className="h-5 flex-1 rounded bg-muted">
                      <div className={`h-5 rounded ${MAU_TUOI[k]}`} style={{ width: `${(d.tuoi[k].n / maxN) * 100}%` }} />
                    </div>
                    <div className="w-36 shrink-0 text-right tabular-nums">
                      {d.tuoi[k].n} máy · {vnd(d.tuoi[k].von)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="rounded-xl border bg-card p-3">
              <div className="mb-2 flex items-center justify-between text-sm font-medium">
                Top 5 máy cần đẩy <Link href="/dashboard/tai-chinh/bao-cao-21h" className="text-xs font-normal underline">Xem đủ</Link>
              </div>
              <div className="divide-y text-sm">
                {d.top5.map((m) => (
                  <div key={m.imei || m.serial} className="flex items-center justify-between gap-2 py-1.5">
                    <div className="min-w-0">
                      <div className="truncate">{m.ten}</div>
                      <div className="text-xs text-muted-foreground">
                        {m.tuoi} ngày · {m.maLo || "chưa có lô"} · điểm {m.diem}
                      </div>
                    </div>
                    <div className="shrink-0 text-right tabular-nums">
                      <div>{vnd(m.giaBanMucTieu)}</div>
                      {m.deXuat && m.deXuat.giaDeXuat < m.giaBanMucTieu && <div className="text-xs text-amber-700">→ {vnd(m.deXuat.giaDeXuat)}</div>}
                    </div>
                  </div>
                ))}
                {!d.top5.length && <div className="py-4 text-center text-muted-foreground">Không có máy tồn</div>}
              </div>
            </div>
          </div>

          {d.canhBao.length > 0 && (
            <div className="rounded-xl border border-red-300 bg-red-50 p-3 text-sm dark:border-red-900 dark:bg-red-950/40">
              <div className="font-medium text-red-700 dark:text-red-300">Tiền bán lô đã bị dùng vào việc khác, ưu tiên giữ tiền trả nợ</div>
              <div className="mt-1 flex flex-wrap gap-2">
                {d.canhBao.map((k) => (
                  <Link key={k.maLo} href={`/dashboard/tai-chinh/lo-hang?ma=${encodeURIComponent(k.maLo)}`}>
                    <Nhan mau="do">
                      {k.maLo}: nợ {vnd(k.conLai)} &gt; vốn tồn {vnd(k.vonTon)}
                    </Nhan>
                  </Link>
                ))}
              </div>
            </div>
          )}
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
