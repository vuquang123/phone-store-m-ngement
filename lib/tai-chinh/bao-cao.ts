// lib/tai-chinh/bao-cao.ts
// Gom số liệu cho các trang Tài chính từ dữ liệu đã nạp (du-lieu.ts) + công thức (tinh-toan.ts).
import type { ActiveBranch } from "@/lib/branches"
import { theoChiNhanh, type DuLieu, type MayKho, type MaySo } from "./du-lieu"
import {
  daRaKhoi,
  daTraTheoLo,
  daThuMay,
  deXuatGia,
  diemUuTien,
  hanTraLo,
  laiMay,
  nhomMay,
  nhomTuoiTon,
  soNgay,
  congNgay,
  tinhChiSoLo,
  mauHan,
  type ChiSoLo,
  type DeXuatGia,
  type KhoanNo,
  type Lo,
  type MayLo,
  type NhomMay,
} from "./tinh-toan"

const khoa = (s: unknown) => String(s ?? "").trim().toUpperCase()

/* ------------------------------------------------------------- lô hàng */
export type DongLo = ChiSoLo & {
  lo: Lo
  tenDauHang: string
  nhom: Partial<Record<NhomMay, number>>
  chiPhiNgoai: number // chi phí ngoài gắn vào lô (đã trừ trong laiDaChot)
}

export function chiSoTatCaLo(d: DuLieu): Map<string, DongLo> {
  const daTra = daTraTheoLo(d.traNo)
  const out = new Map<string, DongLo>()
  const mayTheoLo = new Map<string, MaySo[]>()
  for (const m of d.may) {
    if (!mayTheoLo.has(m.maLo)) mayTheoLo.set(m.maLo, [])
    mayTheoLo.get(m.maLo)!.push(m)
  }
  for (const lo of d.lo) {
    const may = mayTheoLo.get(lo.ma) || []
    const dh = d.dauHang.find((x) => x.id === lo.dauHangId)
    const cs = tinhChiSoLo(lo, may, dh, daTra.get(lo.ma) || 0, d.homNay, (m) => (m as MaySo).daThuDu)
    const chiPhiNgoai = d.chiPhi.filter((c) => c.maLo === lo.ma).reduce((s, c) => s + c.soTien, 0)
    cs.laiDaChot -= chiPhiNgoai
    const nhom: DongLo["nhom"] = {}
    for (const m of may) {
      const n = nhomMay(m.ten, m.loaiMay)
      nhom[n] = (nhom[n] || 0) + 1
    }
    out.set(lo.ma, { ...cs, lo, tenDauHang: dh?.ten || "(không rõ)", nhom, chiPhiNgoai })
  }
  return out
}

export type LocLo = { dauHang?: string; tu?: string; den?: string; nhom?: string; q?: string }

export function danhSachLo(d: DuLieu, active: ActiveBranch, loc: LocLo = {}): DongLo[] {
  const tat = chiSoTatCaLo(d)
  const lo = theoChiNhanh(d.lo, active)
  return lo
    .map((l) => tat.get(l.ma)!)
    .filter((x) => {
      if (loc.dauHang && x.lo.dauHangId !== loc.dauHang) return false
      if (loc.tu && x.lo.ngayNhap < loc.tu) return false
      if (loc.den && x.lo.ngayNhap > loc.den) return false
      if (loc.nhom && !(x.nhom as any)[loc.nhom]) return false
      if (loc.q) {
        const q = loc.q.toLowerCase()
        if (!x.lo.ma.toLowerCase().includes(q) && !x.tenDauHang.toLowerCase().includes(q)) return false
      }
      return true
    })
    .sort((a, b) => b.lo.ngayNhap.localeCompare(a.lo.ngayNhap) || b.lo.ma.localeCompare(a.lo.ma))
}

export type MayChiTiet = {
  dong: number
  maLo: string
  idMay: string
  imei: string
  serial: string
  ten: string
  nhom: NhomMay
  loaiMay: string
  dungLuong: string
  mau: string
  pin: string
  tinhTrang: string
  giaNhap: number
  giaBanMucTieu: number
  giaSan: number
  ngayNhap: string
  trangThai: string
  ctvGiu: string
  maDon: string
  ngayBan: string
  doanhThu: number
  daThu: number
  chuaThu: number
  daThuDu: boolean
  hoaHong: number
  phiTraGop: number
  phiKhac: number
  chiPhiPhuKien: number
  ctvBan: string
  nguoiBan: string
  lai: number | null // đã bán: lãi chốt; còn tồn: lãi dự kiến
  tuoi: number | null
  deXuat: DeXuatGia | null
  diem: number | null
  ghiChu: string
}

export function chiTietMay(d: DuLieu, m: MaySo, loNoDenHan7: boolean): MayChiTiet {
  const ban = m.trangThai === "Đã bán"
  const ton = !daRaKhoi(m.trangThai)
  return {
    dong: m._dong,
    maLo: m.maLo,
    idMay: m.idMay,
    imei: m.imei,
    serial: m.serial,
    ten: m.ten,
    nhom: nhomMay(m.ten, m.loaiMay),
    loaiMay: m.loaiMay,
    dungLuong: m.dungLuong,
    mau: m.mau,
    pin: m.pin,
    tinhTrang: m.tinhTrang,
    giaNhap: m.giaNhap,
    giaBanMucTieu: m.giaBanMucTieu,
    giaSan: m.giaSan,
    ngayNhap: m.ngayNhap,
    trangThai: m.trangThai,
    ctvGiu: m.ctvGiu,
    maDon: m.maDon,
    ngayBan: m.ngayBan,
    doanhThu: m.doanhThu,
    daThu: ban ? daThuMay(m, m.daThuDu) : 0,
    chuaThu: ban && !m.daThuDu ? m.chuaThu : 0,
    daThuDu: m.daThuDu,
    hoaHong: m.hoaHong,
    phiTraGop: m.phiTraGop,
    phiKhac: m.phiKhac,
    chiPhiPhuKien: m.chiPhiPhuKien,
    ctvBan: m.ctvBan,
    nguoiBan: m.nguoiBan,
    lai: ban ? laiMay(m) : ton ? m.giaBanMucTieu - m.giaNhap : null,
    tuoi: ton ? Math.max(0, soNgay(m.ngayNhap, d.homNay)) : null,
    deXuat: ton ? deXuatGia(m, d.homNay, d.caiDat.caiDat) : null,
    diem: ton ? diemUuTien(m, d.homNay, d.caiDat.caiDat, loNoDenHan7) : null,
    ghiChu: (m._goc && m._goc["Ghi Chú"]) || "",
  }
}

export function chiTietLo(d: DuLieu, ma: string) {
  const tat = chiSoTatCaLo(d)
  const dl = tat.get(ma)
  if (!dl) return null
  const noDenHan = dl.noConLai > 0 && dl.soNgayConLai <= 7
  const may = d.may
    .filter((m) => m.maLo === ma)
    .map((m) => chiTietMay(d, m, noDenHan))
    .sort((a, b) => (a.trangThai === "Đã bán" ? 1 : 0) - (b.trangThai === "Đã bán" ? 1 : 0) || a.dong - b.dong)
  const traNo = d.traNo
    .filter((t) => t.phanBo[ma])
    .map((t) => ({ id: t.id, ngay: t.ngay, soTien: t.phanBo[ma], tongLanTra: t.soTien, ghiChu: t.ghiChu, nguoiGhi: t.nguoiGhi }))
  return { ...dl, may, traNo }
}

/* -------------------------------------------------- công nợ đầu hàng */
export type KhoanNoHienThi = KhoanNo & {
  noGoc: number
  daTra: number
  soNgayConLai: number
  mau: ReturnType<typeof mauHan>
  vonTon: number
  canhBaoCheo: boolean
  chiNhanh: string
}

export function congNo(d: DuLieu, active: ActiveBranch = "all") {
  const tat = chiSoTatCaLo(d)
  const lo = theoChiNhanh(d.lo, active)
  const khoan: KhoanNoHienThi[] = lo
    .map((l) => tat.get(l.ma)!)
    .filter((x) => x.noGoc > 0)
    .map((x) => ({
      maLo: x.ma,
      dauHangId: x.lo.dauHangId,
      ngayNhap: x.lo.ngayNhap,
      hanTra: x.hanTra,
      conLai: x.noConLai,
      noGoc: x.noGoc,
      daTra: x.daTra,
      soNgayConLai: x.soNgayConLai,
      mau: x.mau,
      vonTon: x.vonTon,
      canhBaoCheo: x.canhBaoCheo && x.noConLai > 0,
      chiNhanh: x.lo.chiNhanh,
    }))
  const theoDauHang = d.dauHang
    .map((dh) => {
      const ds = khoan.filter((k) => k.dauHangId === dh.id).sort((a, b) => a.hanTra.localeCompare(b.hanTra))
      return {
        dauHang: dh,
        tongNo: ds.reduce((s, k) => s + k.conLai, 0),
        quaHan: ds.filter((k) => k.conLai > 0 && k.soNgayConLai < 0).reduce((s, k) => s + k.conLai, 0),
        khoan: ds,
        lanTra: d.traNo.filter((t) => t.dauHangId === dh.id).sort((a, b) => b.ngay.localeCompare(a.ngay)).slice(0, 20),
      }
    })
    .filter((x) => x.khoan.length || x.lanTra.length)
    .sort((a, b) => b.tongNo - a.tongNo)
  const conNo = khoan.filter((k) => k.conLai > 0)
  const trong = (n: number) => conNo.filter((k) => k.soNgayConLai <= n).reduce((s, k) => s + k.conLai, 0)
  return {
    tongNo: conNo.reduce((s, k) => s + k.conLai, 0),
    quaHan: conNo.filter((k) => k.soNgayConLai < 0).reduce((s, k) => s + k.conLai, 0),
    lich: { d7: trong(7), d14: trong(14), d30: trong(30) },
    theoDauHang,
    canhBao: conNo.filter((k) => k.canhBaoCheo),
  }
}

/** Các khoản còn nợ của 1 đầu hàng, để phân bổ FIFO khi ghi nhận trả tiền. */
export function khoanNoCuaDauHang(d: DuLieu, dauHangId: string): KhoanNo[] {
  const tat = chiSoTatCaLo(d)
  return d.lo
    .filter((l) => l.dauHangId === dauHangId)
    .map((l) => tat.get(l.ma)!)
    .map((x) => ({ maLo: x.ma, dauHangId, ngayNhap: x.lo.ngayNhap, hanTra: x.hanTra, conLai: x.noConLai }))
}

/* ------------------------------------------------- máy tồn & ưu tiên */
export type MayTon = MayChiTiet & { coLo: boolean; dongKho: number; chiNhanh: string }

/**
 * Máy đang tồn = Kho_Hang (nguồn sự thật cho tồn kho), gắn thêm thông tin sổ lô nếu có
 * (giá sàn, CTV đang giữ, lô có nợ đến hạn). Máy chưa có lô vẫn được tính, đánh dấu coLo=false.
 */
export function mayTon(d: DuLieu, active: ActiveBranch): MayTon[] {
  const tat = chiSoTatCaLo(d)
  const soTheoId = new Map<string, MaySo>()
  for (const m of d.may) {
    if (daRaKhoi(m.trangThai)) continue
    if (m.imei) soTheoId.set(khoa(m.imei), m)
    if (m.serial) soTheoId.set(khoa(m.serial), m)
  }
  const out: MayTon[] = []
  for (const k of theoChiNhanh(d.kho, active)) {
    if (k.trangThai === "Đã bán") continue
    const s = soTheoId.get(khoa(k.imei)) || soTheoId.get(khoa(k.serial))
    const base: MaySo =
      s ??
      ({
        _dong: 0,
        _goc: {} as any,
        luuLai: {},
        daThuDu: false,
        maLo: "",
        idMay: k.idMay,
        imei: k.imei,
        serial: k.serial,
        ten: k.ten,
        loaiMay: k.loaiMay,
        dungLuong: k.dungLuong,
        mau: k.mau,
        pin: k.pin,
        tinhTrang: k.tinhTrang,
        giaNhap: k.giaNhap,
        giaBanMucTieu: k.giaBan,
        giaSan: 0,
        ngayNhap: k.ngayNhap,
        chiNhanh: k.chiNhanh,
        trangThai: k.trangThai,
        ctvGiu: "",
        maDon: "",
        ngayBan: "",
        doanhThu: 0,
        chuaThu: 0,
        chiPhiPhuKien: 0,
        hoaHong: 0,
        phiTraGop: 0,
        phiKhac: 0,
        ctvBan: "",
        nguoiBan: "",
      } as MaySo)
    const lo = s ? tat.get(s.maLo) : undefined
    const noDenHan = !!lo && lo.noConLai > 0 && lo.soNgayConLai <= 7
    // tồn kho dùng giá nhập / giá bán hiện tại trên Kho_Hang
    const m: MaySo = { ...base, giaBanMucTieu: k.giaBan || base.giaBanMucTieu, giaNhap: base.giaNhap || k.giaNhap }
    out.push({ ...chiTietMay(d, m, noDenHan), coLo: !!s, dongKho: k.dong, chiNhanh: k.chiNhanh })
  }
  return out
}

export function danhSachUuTien(d: DuLieu, active: ActiveBranch, chiTon = true) {
  return mayTon(d, active)
    .filter((m) => !chiTon || m.trangThai === "Tồn" || m.trangThai === "CTV giữ")
    .sort((a, b) => (b.diem || 0) - (a.diem || 0))
}

/* ------------------------------------------------------- dashboard */
export function tongQuan(d: DuLieu, active: ActiveBranch) {
  const cd = d.caiDat.caiDat
  const ton = mayTon(d, active)
  const cn = congNo(d, active)
  const thang = d.homNay.slice(0, 7)
  const banThang = theoChiNhanh(d.ban, active).filter((b) => b.laMay && b.ngayBan.startsWith(thang))
  // lãi tháng: doanh thu − giá nhập (dòng Ban_Hang đã gồm phụ kiện) − hoa hồng/phí ghi ở sổ lô
  const soTheoDon = new Map<string, MaySo>()
  for (const m of d.may) if (m.maDon) soTheoDon.set(`${m.maDon}|${khoa(m.imei || m.serial)}`, m)
  let laiThang = 0
  let doanhThuThang = 0
  for (const b of banThang) {
    const s = soTheoDon.get(`${b.maDon}|${khoa(b.imei || b.serial)}`)
    doanhThuThang += b.doanhThu
    laiThang += b.doanhThu - b.giaNhap - (s ? s.hoaHong + s.phiTraGop + s.phiKhac : 0)
  }
  const chiPhiLoThang = theoChiNhanh(d.lo, active)
    .filter((l) => l.ngayNhap.startsWith(thang))
    .reduce((s, l) => s + l.chiPhiLo, 0)
  laiThang -= chiPhiLoThang
  const chiPhiNgoaiThang = theoChiNhanh(d.chiPhi, active)
    .filter((c) => c.ngay.startsWith(thang))
    .reduce((s, c) => s + c.soTien, 0)
  laiThang -= chiPhiNgoaiThang
  const tuoi = { "0-7": { n: 0, von: 0 }, "8-15": { n: 0, von: 0 }, "16-30": { n: 0, von: 0 }, ">30": { n: 0, von: 0 } }
  for (const m of ton) {
    const g = nhomTuoiTon(m.tuoi || 0, cd)
    tuoi[g].n++
    tuoi[g].von += m.giaNhap
  }
  // Khách còn nợ: máy đã bán trong sổ lô, phần trả góp / COD chưa về và chưa đánh dấu "Đã Thu Đủ"
  const khachConNo = theoChiNhanh(d.may, active)
    .filter((m) => m.trangThai === "Đã bán" && !m.daThuDu)
    .reduce((s, m) => s + (m.chuaThu || 0), 0)
  return {
    homNay: d.homNay,
    khachConNo,
    vonTon: ton.reduce((s, m) => s + m.giaNhap, 0),
    soMayTon: ton.length,
    mayChuaCoLo: ton.filter((m) => !m.coLo).length,
    mayThieuGiaNhap: ton.filter((m) => !m.giaNhap).length,
    tongNo: cn.tongNo,
    noDenHan7: cn.lich.d7,
    quaHan: cn.quaHan,
    laiThang,
    doanhThuThang,
    chiPhiLoThang,
    chiPhiNgoaiThang,
    soMayBanThang: banThang.length,
    ton15: ton.filter((m) => (m.tuoi || 0) > cd.tuoi2).length,
    ton30: ton.filter((m) => (m.tuoi || 0) > cd.tuoi3).length,
    tuoi,
  }
}

export { congNgay, hanTraLo }
export type { MayKho, MayLo }

/* ----------------------------------------------- máy đã bán, gắn bù vào lô */
export type MayDaBanChoGan = {
  khoa: string // `${maDon}|${IMEI/Serial}`
  maDon: string
  ngayBan: string
  id: string
  ten: string
  phu: string
  giaNhap: number
  doanhThu: number
  chiNhanh: string
  dongSoCu: number | null // đang nằm ở lô cũ (không tính nợ) -> chuyển dòng đó; null -> thêm dòng mới vào sổ lô
  loCu: string
}

/**
 * Máy đã bán (theo Ban_Hang) chưa thuộc lô thật nào: chưa có trong sổ lô, hoặc đang ở lô cũ "không tính nợ".
 * Bỏ qua máy đã quay lại kho (máy đó dùng "Thêm máy tồn"). Mới nhất trước.
 */
export function mayDaBanChoGan(d: DuLieu, active: ActiveBranch): MayDaBanChoGan[] {
  const loCu = new Set(d.lo.filter((l) => /không tính nợ/i.test(l.trangThai || "")).map((l) => l.ma))
  const trongKho = new Set<string>()
  for (const k of d.kho) {
    if (k.trangThai === "Đã bán") continue
    if (k.imei) trongKho.add(khoa(k.imei))
    if (k.serial) trongKho.add(khoa(k.serial))
  }
  const soTheoId = new Map<string, MaySo[]>()
  for (const m of d.may) {
    for (const id of [m.imei, m.serial]) {
      if (!id) continue
      const k = khoa(id)
      if (!soTheoId.has(k)) soTheoId.set(k, [])
      soTheoId.get(k)!.push(m)
    }
  }
  const daThay = new Set<string>()
  const out: MayDaBanChoGan[] = []
  const ban = theoChiNhanh(d.ban, active)
    .filter((b) => b.laMay)
    .sort((a, b) => b.ngayBan.localeCompare(a.ngayBan))
  for (const b of ban) {
    const id = b.imei || b.serial
    const k = khoa(id)
    if (!k || daThay.has(k)) continue // chỉ lần bán gần nhất của mỗi máy
    daThay.add(k)
    if (trongKho.has(k) || (b.serial && trongKho.has(khoa(b.serial)))) continue
    const so = soTheoId.get(k) || (b.serial ? soTheoId.get(khoa(b.serial)) : undefined) || []
    // dòng sổ lô ứng với đúng lần bán này (hoặc dòng cuối cùng nếu chưa khớp đơn nào)
    const khop = so.find((m) => m.maDon === b.maDon) || [...so].sort((a, c) => c.ngayNhap.localeCompare(a.ngayNhap))[0]
    if (khop && !loCu.has(khop.maLo)) continue // đã thuộc một lô thật
    out.push({
      khoa: `${b.maDon}|${id}`,
      maDon: b.maDon,
      ngayBan: b.ngayBan,
      id,
      ten: b.ten,
      phu: [b.dungLuong, b.mau, b.loaiMay].filter(Boolean).join(" · "),
      giaNhap: khop?.giaNhap || b.giaNhap,
      doanhThu: b.doanhThu,
      chiNhanh: b.chiNhanh,
      dongSoCu: khop ? khop._dong : null,
      loCu: khop ? khop.maLo : "",
    })
  }
  return out
}
