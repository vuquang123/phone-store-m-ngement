"use client"
// Tài chính · Cài đặt: ngưỡng tuổi tồn, ngưỡng lãi, hệ số Lock, trọng số điểm ưu tiên, chân bài đăng, Telegram riêng chủ shop.
import { useCallback, useEffect, useState } from "react"
import { ProtectedRoute } from "@/components/auth/protected-route"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { useToast } from "@/hooks/use-toast"
import { DangTai, KhungTrang, Nhan, goiApi } from "@/components/tai-chinh/chung"

type Data = { caiDat: Record<string, number | string>; macDinh: Record<string, number | string>; moTa: Record<string, string>; telegramDaKetNoi: boolean; chanBaiDang: string }
const NHOM: { ten: string; khoa: string[] }[] = [
  { ten: "Tuổi tồn", khoa: ["tuoi1", "tuoi2", "tuoi3", "heSoLock"] },
  { ten: "Lãi và giá đề xuất", khoa: ["laiCao", "laiThap", "laiToiThieu", "laiGiuLaiCao16_30", "giamLaiCao8_15", "loToiDaTren30"] },
  { ten: "Điểm ưu tiên bán", khoa: ["wTuoi", "wTuoiSau", "wNoDenHan", "wGiaVon", "wLaiCao"] },
  { ten: "Thưởng CTV", khoa: ["thuongCtv8_15", "thuongCtv16_30", "thuongCtvTren30"] },
  { ten: "Báo cáo", khoa: ["gioBaoCao"] },
]

function Trang() {
  const { toast } = useToast()
  const [d, setD] = useState<Data | null>(null)
  const [f, setF] = useState<Record<string, string>>({})
  const [chan, setChan] = useState("")
  const [link, setLink] = useState("")
  const tai = useCallback(async () => {
    try {
      const r = await goiApi<Data>("/api/tai-chinh/cai-dat")
      setD(r)
      setF(Object.fromEntries(Object.entries(r.caiDat).map(([k, v]) => [k, String(v)])))
      setChan(r.chanBaiDang)
    } catch (e: any) {
      toast({ title: "Không tải được", description: e.message, variant: "destructive" })
    }
  }, [toast])
  useEffect(() => {
    tai()
  }, [tai])
  const luu = async () => {
    try {
      await goiApi("/api/tai-chinh/cai-dat", "PUT", { caiDat: f, chanBaiDang: chan })
      toast({ title: "Đã lưu cài đặt" })
      tai()
    } catch (e: any) {
      toast({ title: "Không lưu được", description: e.message, variant: "destructive" })
    }
  }
  const tg = async (action: "lien-ket" | "thu" | "huy") => {
    try {
      const r = await goiApi<{ link?: string }>("/api/tai-chinh/cai-dat", "POST", { action })
      if (r.link) {
        setLink(r.link)
        window.open(r.link, "_blank")
      } else toast({ title: action === "thu" ? "Đã gửi tin thử" : "Đã bỏ liên kết" })
      if (action === "huy") tai()
    } catch (e: any) {
      toast({ title: "Lỗi Telegram", description: e.message, variant: "destructive" })
    }
  }
  return (
    <KhungTrang tieuDe="Cài đặt tài chính" phai={<Button onClick={luu}>Lưu cài đặt</Button>}>
      {!d ? (
        <DangTai />
      ) : (
        <>
          <section className="rounded-xl border bg-card p-3 text-sm">
            <div className="mb-2 flex items-center gap-2 font-medium">
              Telegram riêng của chủ shop {d.telegramDaKetNoi ? <Nhan mau="xanh">Đã kết nối</Nhan> : <Nhan mau="vang">Chưa kết nối</Nhan>}
            </div>
            <p className="mb-2 text-muted-foreground">Báo cáo 21h gửi riêng vào Telegram của anh. Bấm “Kết nối”, Telegram mở ra, bấm Start là xong (link dùng được 30 phút).</p>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={() => tg("lien-ket")}>
                {d.telegramDaKetNoi ? "Kết nối lại" : "Kết nối Telegram"}
              </Button>
              {d.telegramDaKetNoi && (
                <>
                  <Button size="sm" variant="outline" onClick={() => tg("thu")}>
                    Gửi tin thử
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => tg("huy")}>
                    Bỏ kết nối
                  </Button>
                </>
              )}
            </div>
            {link && (
              <p className="mt-2 break-all text-xs">
                Nếu Telegram không tự mở: <a className="underline" href={link} target="_blank" rel="noreferrer">{link}</a>. Bấm Start xong thì tải lại trang này.
              </p>
            )}
          </section>
          {NHOM.map((n) => (
            <section key={n.ten} className="rounded-xl border bg-card p-3">
              <h2 className="mb-2 font-medium">{n.ten}</h2>
              <div className="grid gap-3 md:grid-cols-2">
                {n.khoa.map((k) => (
                  <label key={k} className="grid gap-1 text-sm">
                    <span>{d.moTa[k] || k}</span>
                    <Input value={f[k] ?? ""} inputMode={k === "gioBaoCao" ? "text" : "decimal"} onChange={(e) => setF({ ...f, [k]: e.target.value })} />
                    <span className="text-xs text-muted-foreground">Mặc định: {typeof d.macDinh[k] === "number" ? Number(d.macDinh[k]).toLocaleString("vi-VN") : d.macDinh[k]}</span>
                  </label>
                ))}
              </div>
            </section>
          ))}
          <section className="rounded-xl border bg-card p-3">
            <h2 className="mb-2 font-medium">Chân bài đăng báo giá</h2>
            <Textarea rows={3} value={chan} onChange={(e) => setChan(e.target.value)} />
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
