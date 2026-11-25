// lib/tai-chinh/bao-cao-21h.ts
// Báo cáo tự động 21:00 mỗi ngày (giờ VN): bán hôm nay, áp lực tiền, top máy cần đẩy,
// bài đăng soạn sẵn, đề xuất thưởng CTV. Lưu lịch sử vào bảng Bao_Cao_21h và gửi Telegram
// riêng cho chủ shop (chat đã liên kết ở Cài đặt tài chính).
import { DateTime } from "luxon"
import { BRANCHES, type ActiveBranch } from "@/lib/branches"
import { listCashAccountsForFinance } from "@/lib/cash-flow/sheets"
import { BANG, damBaoBang, docBang, suaDong, themDong, so } from "./bang"
import { KHOA_PHU } from "./cai-dat"
import { ZONE, ngayVN, theoChiNhanh, type DuLieu, type MaySo } from "./du-lieu"
import { congNo, danhSachUuTien, mayTon, type MayTon } from "./bao-cao"
import { vnd } from "./tinh-toan"
import { docNguonTien, moTaDoCu, tomTatTien } from "./tien-hien-co"

const khoa = (s: unknown) => String(s ?? "").trim().toUpperCase()

export type BaoCao21h = {
  ngay: string
  chiNhanh: string
  taoLuc: string
  homNay: { soMay: number; soDon: number; doanhThu: number; lai: number; daThu: number; chiPhiNgoai?: number }
  apLuc: {
    no3: number
    no7: number
    quaHan: number
    tienHienCo: number
    nguonTien: "nhap_tay" | "nguon_tien" | "tien_hien_co"
    tienCapNhatLuc?: string
    tienSoNgayCu?: number | null
    tienThieu: number
    giaVonTB: number
    soMayCanBan: number
  }
  top: {
    ten: string
    imei: string
    maLo: string
    tuoi: number
    diem: number
    giaHienTai: number
    giaDeXuat: number
    canDuyet: boolean
    lyDo: string
    dongKho: number
  }[]
  thuongCtv: { ten: string; imei: string; tuoi: number; thuong: number }[]
  baiDang: string
}

function moTaMay(m: Pick<MayTon, "ten" | "dungLuong" | "mau" | "loaiMay" | "pin" | "tinhTrang">) {
  const loai = /ipad/i.test(m.ten) ? m.loaiMay : m.loaiMay
  return [m.ten.trim(), m.dungLuong, m.mau, loai, m.pin ? `pin ${String(m.pin).replace(/%$/, "")}%` : "", m.tinhTrang]
    .filter((x) => String(x || "").trim())
    .join(" · ")
}

export async function taoBaoCao21h(d: DuLieu, active: ActiveBranch): Promise<BaoCao21h> {
  const cd = d.caiDat.caiDat
  const hom = d.homNay
  // 1. Hôm nay
  const banHom = theoChiNhanh(d.ban, active).filter((b) => b.ngayBan === hom)
  const soTheoDon = new Map<string, MaySo>()
  for (const m of d.may) if (m.maDon) soTheoDon.set(`${m.maDon}|${khoa(m.imei || m.serial)}`, m)
  let doanhThu = 0
  let lai = 0
  let daThu = 0
  for (const b of banHom) {
    const s = soTheoDon.get(`${b.maDon}|${khoa(b.imei || b.serial)}`)
    doanhThu += b.doanhThu
    lai += b.doanhThu - b.giaNhap - (s ? s.hoaHong + s.phiTraGop + s.phiKhac : 0)
    daThu += s?.daThuDu ? b.doanhThu : b.doanhThu - b.chuaThu
  }
  // chi phí ngoài nhập trong ngày (quảng cáo, phụ kiện lẻ, ship...) trừ vào lãi hôm nay
  const chiPhiNgoai = theoChiNhanh(d.chiPhi, active)
    .filter((c) => c.ngay === hom)
    .reduce((s, c) => s + c.soTien, 0)
  lai -= chiPhiNgoai
  // 2. Áp lực tiền
  const cn = congNo(d, active)
  const no3 = cn.theoDauHang.flatMap((x) => x.khoan).filter((k) => k.conLai > 0 && k.soNgayConLai <= 3).reduce((s, k) => s + k.conLai, 0)
  const no7 = cn.lich.d7
  const tayNgay = d.caiDat.phu[KHOA_PHU.soDuTayNgay]
  const tay = d.caiDat.phu[KHOA_PHU.soDuTay]
  let tienHienCo = 0
  let nguonTien: "nhap_tay" | "nguon_tien" | "tien_hien_co" = "nguon_tien"
  let tienCapNhatLuc = ""
  let tienSoNgayCu: number | null = null
  // Ưu tiên: số nhập tay hôm nay ở trang 21h > bảng Tiền hiện có (chủ shop tự nhập) > tổng nguồn tiền app tự tính
  const thc = tomTatTien(await docNguonTien().catch(() => []), active)
  if (tay !== "" && tayNgay === hom) {
    tienHienCo = so(tay)
    nguonTien = "nhap_tay"
  } else if (thc.coDuLieu) {
    tienHienCo = thc.tong
    nguonTien = "tien_hien_co"
    tienCapNhatLuc = thc.capNhatLuc
    tienSoNgayCu = thc.soNgayCu
  } else {
    const ten = active === "all" ? "" : BRANCHES.find((b) => b.id === active)?.name || ""
    const acc = await listCashAccountsForFinance()
    tienHienCo = acc
      .filter((a) => a.available && (!ten || !a.branch || a.branch === ten))
      .reduce((s, a) => s + a.balance, 0)
  }
  const ton = mayTon(d, active).filter((m) => m.trangThai === "Tồn" || m.trangThai === "CTV giữ")
  const coGia = ton.filter((m) => m.giaNhap > 0)
  const giaVonTB = coGia.length ? Math.round(coGia.reduce((s, m) => s + m.giaNhap, 0) / coGia.length) : 0
  const tienThieu = Math.max(0, no7 - tienHienCo)
  const soMayCanBan = tienThieu > 0 && giaVonTB > 0 ? Math.ceil(tienThieu / giaVonTB) : 0
  // 3. Top 10 máy cần đẩy
  const uuTien = danhSachUuTien(d, active)
  const top = uuTien.slice(0, 10).map((m) => ({
    ten: moTaMay(m),
    imei: m.imei || m.serial,
    maLo: m.maLo,
    tuoi: m.tuoi || 0,
    diem: m.diem || 0,
    giaHienTai: m.giaBanMucTieu,
    giaDeXuat: m.deXuat?.giaDeXuat ?? m.giaBanMucTieu,
    canDuyet: !!m.deXuat?.canDuyet,
    lyDo: m.deXuat?.lyDo || "",
    dongKho: m.dongKho,
  }))
  // 5. Thưởng CTV cho máy nhóm 16+ ngày
  const thuongCtv = uuTien
    .filter((m) => m.deXuat && (m.deXuat.nhomTuoi === "16-30" || m.deXuat.nhomTuoi === ">30") && m.deXuat.thuongCtv > 0)
    .map((m) => ({ ten: moTaMay(m), imei: m.imei || m.serial, tuoi: m.tuoi || 0, thuong: m.deXuat!.thuongCtv }))
  // 4. Bài đăng soạn sẵn
  const dsDang = uuTien.filter((m) => m.giaBanMucTieu > 0).slice(0, 15)
  const baiDang = [
    `🔥 DEV PỒ BÁO GIÁ ${ngayVN(hom)} 🔥`,
    "",
    ...dsDang.map((m) => `📱 ${moTaMay(m)}: ${vnd(m.giaBanMucTieu)}đ`),
    "",
    d.caiDat.phu[KHOA_PHU.chanBaiDang],
  ].join("\n")
  return {
    ngay: hom,
    chiNhanh: active === "all" ? "Tất cả" : BRANCHES.find((b) => b.id === active)?.name || "",
    taoLuc: DateTime.now().setZone(ZONE).toFormat("HH:mm d/M/yyyy"),
    homNay: { soMay: banHom.filter((b) => b.laMay).length, soDon: new Set(banHom.map((b) => b.maDon)).size, doanhThu, lai, daThu, chiPhiNgoai },
    apLuc: { no3, no7, quaHan: cn.quaHan, tienHienCo, nguonTien, tienCapNhatLuc, tienSoNgayCu, tienThieu, giaVonTB, soMayCanBan },
    top,
    thuongCtv,
    baiDang,
  }
}

const esc = (s: string) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")

export function tinTelegram(b: BaoCao21h, link: string) {
  const L: string[] = []
  L.push(`<b>📊 BÁO CÁO 21H · ${esc(b.chiNhanh)} · ${ngayVN(b.ngay)}</b>`)
  L.push("")
  L.push(`<b>1. Hôm nay</b>`)
  L.push(`Bán ${b.homNay.soMay} máy (${b.homNay.soDon} đơn) · Doanh thu ${vnd(b.homNay.doanhThu)}`)
  L.push(`Lãi ${vnd(b.homNay.lai)}${b.homNay.chiPhiNgoai ? ` (đã trừ chi phí ngoài ${vnd(b.homNay.chiPhiNgoai)})` : ""} · Đã thu ${vnd(b.homNay.daThu)}`)
  L.push("")
  L.push(`<b>2. Áp lực tiền</b>`)
  L.push(`Nợ đến hạn 3 ngày: ${vnd(b.apLuc.no3)} · 7 ngày: ${vnd(b.apLuc.no7)}${b.apLuc.quaHan ? ` (quá hạn ${vnd(b.apLuc.quaHan)})` : ""}`)
  L.push(
    `Tiền hiện có: ${vnd(b.apLuc.tienHienCo)}${
      b.apLuc.nguonTien === "nhap_tay"
        ? " (nhập tay hôm nay)"
        : b.apLuc.nguonTien === "tien_hien_co"
          ? ` (${moTaDoCu(b.apLuc.tienSoNgayCu ?? null)}${b.apLuc.tienCapNhatLuc ? `, ${b.apLuc.tienCapNhatLuc}` : ""})`
          : " (app tự tính)"
    }`,
  )
  if (b.apLuc.nguonTien === "tien_hien_co" && (b.apLuc.tienSoNgayCu ?? 99) > 2) L.push(`⚠️ Số tiền đã cũ, vào Tài chính → Tiền hiện có cập nhật lại`)
  if (b.apLuc.tienThieu > 0) L.push(`⚠️ Thiếu ${vnd(b.apLuc.tienThieu)} → cần bán ~${b.apLuc.soMayCanBan} máy ngày mai (giá vốn TB ${vnd(b.apLuc.giaVonTB)})`)
  else L.push(`✅ Đủ tiền trả nợ 7 ngày tới`)
  L.push("")
  L.push(`<b>3. Top máy cần đẩy</b>`)
  b.top.forEach((m, i) => {
    const gia = m.giaDeXuat < m.giaHienTai ? `${vnd(m.giaHienTai)} → <b>${vnd(m.giaDeXuat)}</b>` : vnd(m.giaHienTai)
    L.push(`${i + 1}. ${esc(m.ten)} · ${m.tuoi} ngày · ${gia}${m.canDuyet ? " ❗cần duyệt" : ""}`)
    if (m.lyDo) L.push(`   <i>${esc(m.lyDo)}</i>`)
  })
  if (b.thuongCtv.length) {
    L.push("")
    L.push(`<b>5. Đề xuất thưởng CTV (máy 16+ ngày)</b>`)
    b.thuongCtv.slice(0, 10).forEach((m) => L.push(`• ${esc(m.ten)} · ${m.tuoi} ngày · thưởng ${vnd(m.thuong)}`))
  }
  if (link) {
    L.push("")
    L.push(`Bài đăng soạn sẵn + áp dụng giá: ${esc(link)}`)
  }
  return L.join("\n")
}

/** Lưu (hoặc ghi đè trong ngày) vào bảng Bao_Cao_21h. */
export async function luuBaoCao(b: BaoCao21h, daGui: string) {
  await damBaoBang(BANG.BAO_CAO_21H)
  const { header, dong } = await docBang(BANG.BAO_CAO_21H)
  const row = {
    Ngày: ngayVN(b.ngay),
    "Chi Nhánh": b.chiNhanh,
    "Tạo Lúc": b.taoLuc,
    "Nội Dung": JSON.stringify(b),
    "Bài Đăng": b.baiDang,
    "Đã Gửi Telegram": daGui,
  }
  const cu = dong.find((x) => x["Ngày"] === row["Ngày"] && x["Chi Nhánh"] === b.chiNhanh)
  if (cu) await suaDong(BANG.BAO_CAO_21H, header, [{ dong: cu._dong, giaTri: row }])
  else await themDong(BANG.BAO_CAO_21H, [row])
}

export async function lichSuBaoCao(chiNhanh?: string) {
  const { dong } = await docBang(BANG.BAO_CAO_21H)
  return dong
    .filter((x) => !chiNhanh || x["Chi Nhánh"] === chiNhanh)
    .map((x) => {
      let noiDung: BaoCao21h | null = null
      try {
        noiDung = JSON.parse(x["Nội Dung"] || "null")
      } catch {}
      return { ngay: x["Ngày"], chiNhanh: x["Chi Nhánh"], taoLuc: x["Tạo Lúc"], daGui: x["Đã Gửi Telegram"], noiDung }
    })
    .reverse()
}

/* --------------------------------------------- Telegram riêng chủ shop */
function botToken() {
  return String(process.env.TELEGRAM_BOT_TOKEN || "").trim()
}

export async function guiTelegramChuShop(chatId: string, text: string): Promise<{ ok: boolean; error?: string }> {
  const token = botToken()
  if (!token) return { ok: false, error: "Thiếu TELEGRAM_BOT_TOKEN" }
  if (!chatId) return { ok: false, error: "Chưa kết nối Telegram chủ shop (Cài đặt tài chính)" }
  // Telegram giới hạn 4096 ký tự/tin -> cắt thành nhiều tin theo dòng
  const parts: string[] = []
  let cur = ""
  for (const line of text.split("\n")) {
    if ((cur + "\n" + line).length > 3900) {
      parts.push(cur)
      cur = line
    } else cur = cur ? `${cur}\n${line}` : line
  }
  if (cur) parts.push(cur)
  try {
    for (const p of parts) {
      const r = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ chat_id: chatId, text: p, parse_mode: "HTML", disable_web_page_preview: true }),
        signal: AbortSignal.timeout(10_000),
      })
      const j: any = await r.json().catch(() => ({}))
      if (!j?.ok) return { ok: false, error: j?.description || `HTTP ${r.status}` }
    }
    return { ok: true }
  } catch (e: any) {
    return { ok: false, error: e?.message || String(e) }
  }
}

export async function tenBot(): Promise<string> {
  const token = botToken()
  if (!token) return ""
  try {
    const r = await fetch(`https://api.telegram.org/bot${token}/getMe`, { signal: AbortSignal.timeout(8_000) })
    const j: any = await r.json()
    return j?.result?.username || ""
  } catch {
    return ""
  }
}
