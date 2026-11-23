// lib/tai-chinh/tinh-toan.ts
// Mọi công thức của phần Tài chính (lô hàng, công nợ đầu hàng, điểm ưu tiên, giá đề xuất).
// Hàm thuần: không đọc DB, không đọc giờ hệ thống (ngày "hôm nay" truyền vào), nên test tay được.
//
// Quy ước (Dun chốt 23/11/2026):
//  - Giá vốn từng máy = GIÁ NHẬP. Chi phí lô (ship, test, sửa…) là MỘT con số tổng nhập tay
//    cho cả lô, chỉ trừ ở cấp lô, không chia cho từng máy.
//  - Báo cáo lô tính từ lúc bắt đầu dùng: đơn bán cũ không gán vào lô.

/* ------------------------------------------------------------------ kiểu */
export type NhomMay = "Lock" | "Quốc tế" | "iPad" | "Khác"

export type TrangThaiMay =
  | "Tồn"
  | "CTV giữ"
  | "Đang xử lý"
  | "Bảo hành"
  | "Gửi đối tác"
  | "Đã bán"
  | "Không còn trong kho"

export type CaiDat = {
  tuoi1: number // 7
  tuoi2: number // 15
  tuoi3: number // 30
  laiCao: number // lãi dự kiến >= mức này là "lãi cao"
  laiThap: number // lãi dự kiến < mức này là "lãi thấp"
  laiToiThieu: number // lãi tối thiểu khi hạ giá máy lãi TB nhóm 16–30 ngày
  laiGiuLaiCao16_30: number // máy lãi cao nhóm 16–30 ngày: hạ còn lãi khoảng này
  giamLaiCao8_15: number // máy lãi cao nhóm 8–15 ngày: giảm bấy nhiêu
  loToiDaTren30: number // máy > 30 ngày: có thể lỗ tối đa (cần chủ shop duyệt)
  heSoLock: number // 0.7: máy Lock "già" nhanh hơn -> tuổi quy đổi = tuổi / 0.7
  wTuoi: number // điểm mỗi ngày tuổi (tới ngày tuoi2)
  wTuoiSau: number // điểm mỗi ngày tuổi sau ngày tuoi2
  wNoDenHan: number // cộng điểm nếu lô còn nợ đến hạn <= 7 ngày
  wGiaVon: number // điểm cho mỗi 1.000.000 giá vốn
  wLaiCao: number // cộng điểm nếu lãi dự kiến >= laiCao
  thuongCtv8_15: number
  thuongCtv16_30: number
  thuongCtvTren30: number
  gioBaoCao: string // "21:00"
}

export const CAI_DAT_MAC_DINH: CaiDat = {
  tuoi1: 7,
  tuoi2: 15,
  tuoi3: 30,
  laiCao: 1_500_000,
  laiThap: 500_000,
  laiToiThieu: 200_000,
  laiGiuLaiCao16_30: 500_000,
  giamLaiCao8_15: 250_000,
  loToiDaTren30: 300_000,
  heSoLock: 0.7,
  wTuoi: 1,
  wTuoiSau: 2,
  wNoDenHan: 30,
  wGiaVon: 1,
  wLaiCao: 10,
  thuongCtv8_15: 100_000,
  thuongCtv16_30: 200_000,
  thuongCtvTren30: 300_000,
  gioBaoCao: "21:00",
}

export type DauHang = {
  id: string
  ten: string
  sdt: string
  soNgayNo: number
  nganHang: string
  stk: string
  loaiHang: string
  ghiChu: string
  trangThai: string
}

export type Lo = {
  ma: string
  dauHangId: string
  ngayNhap: string // yyyy-MM-dd
  chiPhiLo: number // tổng chi phí nhập tay
  chiPhiTinhNo: boolean // chi phí lô có phải trả cho đầu hàng không (cộng vào nợ)
  daTraLucNhap: number
  hanTra: string // yyyy-MM-dd, trống = ngày nhập + số ngày nợ của đầu hàng
  tongHoaDon: number // số trên hoá đơn đầu hàng, chỉ để đối chiếu
  ghiChu: string
  chiNhanh: string
  trangThai: string
}

/** Một dòng của sổ lô (Chi_Tiet_Lo) đã gắn tình trạng hiện tại. */
export type MayLo = {
  maLo: string
  idMay: string
  imei: string
  serial: string
  ten: string
  loaiMay: string
  dungLuong: string
  mau: string
  pin: string
  tinhTrang: string
  giaNhap: number
  giaBanMucTieu: number // giá bán hiện tại trên Kho_Hang (máy còn tồn) hoặc lúc nhập
  giaSan: number // 0 = chưa đặt -> sàn = giá vốn
  ngayNhap: string
  chiNhanh: string
  trangThai: TrangThaiMay
  ctvGiu: string
  // khi đã bán
  maDon: string
  ngayBan: string
  doanhThu: number // phần doanh thu của máy trong đơn
  chuaThu: number // phần chưa về (trả góp, COD chưa đối soát)
  chiPhiPhuKien: number // giá nhập phụ kiện tặng kèm (Ban_Hang.Giá Nhập − giá nhập máy)
  hoaHong: number
  phiTraGop: number
  phiKhac: number
  ctvBan: string
  nguoiBan: string
}

export type TraNo = {
  id: string
  dauHangId: string
  ngay: string
  soTien: number
  maLo: string
  phanBo: Record<string, number>
  nguonTien: string
  ghiChu: string
  nguoiGhi: string
}

/* ------------------------------------------------------------- tiện ích */
const DAY = 86_400_000
export function soNgay(tu: string, den: string): number {
  if (!tu || !den) return 0
  const a = Date.UTC(+tu.slice(0, 4), +tu.slice(5, 7) - 1, +tu.slice(8, 10))
  const b = Date.UTC(+den.slice(0, 4), +den.slice(5, 7) - 1, +den.slice(8, 10))
  return Math.round((b - a) / DAY)
}
export function congNgay(ngay: string, n: number): string {
  const d = new Date(Date.UTC(+ngay.slice(0, 4), +ngay.slice(5, 7) - 1, +ngay.slice(8, 10)) + n * DAY)
  return d.toISOString().slice(0, 10)
}

const fold = (s: string) =>
  String(s ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()

/** Lock / Quốc tế / iPad từ tên + cột Loại Máy (iPad đang ghi Wifi/Cellular ở cột Loại Máy). */
export function nhomMay(ten: string, loaiMay: string): NhomMay {
  if (/ipad/i.test(ten)) return "iPad"
  const l = fold(loaiMay)
  if (l.includes("lock")) return "Lock"
  if (l.includes("quoc te") || l.includes("qte") || l === "qt") return "Quốc tế"
  return "Khác"
}

/** Máy đã bán / không còn: không tính vào tồn. */
export const daRaKhoi = (t: TrangThaiMay) => t === "Đã bán" || t === "Không còn trong kho"

/* ------------------------------------------------- thanh toán của đơn bán */
const tien = (s: string) => Number(String(s).replace(/[^\d]/g, "")) || 0

/**
 * Phần tiền của đơn CHƯA về tay, đọc từ cột "Hình Thức Thanh Toán":
 *  - trả góp qua công ty tài chính: "HDSaison: Trả trước ₫4.000.000 + Góp ₫10.000.000" -> 10.000.000
 *  - COD: "COD (GHTK): ₫2.700.000" -> chưa về khi vận chuyển chưa "Đã đối soát"
 */
export function tienChuaVe(hinhThuc: string, vanChuyen: string): number {
  const s = String(hinhThuc || "")
  let out = 0
  for (const m of s.matchAll(/Góp\s*₫?\s*([\d.,]+)/gi)) out += tien(m[1])
  if (!/đã đối soát/i.test(vanChuyen || "")) {
    for (const m of s.matchAll(/COD[^:|]*:\s*₫?\s*([\d.,]+)/gi)) out += tien(m[1])
  }
  return out
}

/**
 * Chia tổng thu của một đơn nhiều máy theo tỷ lệ giá bán từng máy.
 * (Ban_Hang ghi cả Tổng Thu vào dòng đầu, các dòng sau = 0, nên cột "Lãi" từng dòng bị lệch.)
 */
export function chiaDoanhThu(tongThu: number, giaBanTungMay: number[]): number[] {
  const n = giaBanTungMay.length
  if (!n) return []
  const tong = giaBanTungMay.reduce((s, x) => s + Math.max(0, x), 0)
  const out = giaBanTungMay.map((g) => (tong > 0 ? Math.round((tongThu * Math.max(0, g)) / tong) : Math.round(tongThu / n)))
  const lech = tongThu - out.reduce((s, x) => s + x, 0)
  out[out.length - 1] += lech // dồn phần lẻ làm tròn vào máy cuối
  return out
}

/* ---------------------------------------------------------------- máy */
export function laiMay(m: MayLo): number {
  return m.doanhThu - m.giaNhap - m.chiPhiPhuKien - m.hoaHong - m.phiTraGop - m.phiKhac
}
export function daThuMay(m: MayLo, daThuDu: boolean): number {
  return daThuDu ? m.doanhThu : Math.max(0, m.doanhThu - m.chuaThu)
}

/* ------------------------------------------------------------- công nợ */
export function hanTraLo(lo: Lo, dh: DauHang | undefined): string {
  if (lo.hanTra) return lo.hanTra
  return congNgay(lo.ngayNhap, Math.max(0, dh?.soNgayNo || 0))
}

/** Lô cũ gom máy tồn trước khi dùng phần mềm (LO-CU-KHONG-RO): không phát sinh nợ đầu hàng. */
export const khongTinhNo = (lo: Pick<Lo, "trangThai">) => /không tính nợ/i.test(lo.trangThai || "")

/** Nợ gốc của lô với đầu hàng = Σ giá nhập máy + chi phí lô (nếu trả cho đầu hàng) − đã trả lúc nhập. */
export function noGocLo(lo: Lo, may: MayLo[]): number {
  if (khongTinhNo(lo)) return 0
  const tienHang = may.reduce((s, m) => s + m.giaNhap, 0)
  return Math.max(0, tienHang + (lo.chiPhiTinhNo ? lo.chiPhiLo : 0) - lo.daTraLucNhap)
}

export function daTraTheoLo(traNo: TraNo[]): Map<string, number> {
  const out = new Map<string, number>()
  for (const t of traNo) for (const [ma, v] of Object.entries(t.phanBo || {})) out.set(ma, (out.get(ma) || 0) + v)
  return out
}

export type KhoanNo = { maLo: string; dauHangId: string; ngayNhap: string; hanTra: string; conLai: number }

/**
 * Phân bổ một lần trả tiền cho đầu hàng.
 *  - Có chọn lô: trả lô đó trước, dư thì chuyển sang FIFO.
 *  - FIFO: khoản có hạn trả sớm nhất trước, cùng hạn thì lô nhập trước.
 * Trả về phần phân bổ và số tiền thừa (vượt tổng nợ).
 */
export function phanBoFIFO(soTien: number, khoan: KhoanNo[], maLoChon = ""): { phanBo: Record<string, number>; du: number } {
  let con = Math.max(0, Math.round(soTien))
  const phanBo: Record<string, number> = {}
  const ds = khoan
    .filter((k) => k.conLai > 0)
    .sort((a, b) => (a.hanTra === b.hanTra ? a.ngayNhap.localeCompare(b.ngayNhap) || a.maLo.localeCompare(b.maLo) : a.hanTra.localeCompare(b.hanTra)))
  const chon = ds.find((k) => k.maLo === maLoChon)
  const thuTu = chon ? [chon, ...ds.filter((k) => k !== chon)] : ds
  for (const k of thuTu) {
    if (con <= 0) break
    const tra = Math.min(con, k.conLai)
    phanBo[k.maLo] = (phanBo[k.maLo] || 0) + tra
    con -= tra
  }
  return { phanBo, du: con }
}

export type MauHan = "xanh" | "vang" | "do" | "het"
export function mauHan(soNgayConLai: number, conLai: number): MauHan {
  if (conLai <= 0) return "het"
  if (soNgayConLai < 0) return "do"
  if (soNgayConLai <= 7) return "vang"
  return "xanh"
}

/* ------------------------------------------------------------ chỉ số lô */
export type ChiSoLo = {
  ma: string
  slNhap: number
  slBan: number
  slTon: number
  phanTramBan: number
  doanhThu: number
  laiDaChot: number // Σ lãi máy đã bán − chi phí lô
  vonTon: number // Σ giá nhập máy còn tồn
  laiDuKienTon: number // Σ (giá bán mục tiêu − giá nhập) máy tồn
  daThu: number
  tongVon: number // Σ giá nhập + chi phí lô
  phanTramThuHoi: number
  tuoiLo: number
  noGoc: number
  daTra: number
  noConLai: number
  hanTra: string
  soNgayConLai: number
  mau: MauHan
  huyHieu: ("Đã hoàn vốn" | "Chậm" | "Nguy hiểm")[]
  canhBaoCheo: boolean // nợ còn lại > vốn còn nằm trong tồn
}

export function tinhChiSoLo(
  lo: Lo,
  may: MayLo[],
  dh: DauHang | undefined,
  daTra: number,
  homNay: string,
  daThuDu: (m: MayLo) => boolean = () => false,
): ChiSoLo {
  const ban = may.filter((m) => m.trangThai === "Đã bán")
  const ton = may.filter((m) => !daRaKhoi(m.trangThai))
  const slNhap = may.length
  const doanhThu = ban.reduce((s, m) => s + m.doanhThu, 0)
  const laiDaChot = ban.reduce((s, m) => s + laiMay(m), 0) - lo.chiPhiLo
  const vonTon = ton.reduce((s, m) => s + m.giaNhap, 0)
  const laiDuKienTon = ton.reduce((s, m) => s + (m.giaBanMucTieu - m.giaNhap), 0)
  const daThu = ban.reduce((s, m) => s + daThuMay(m, daThuDu(m)), 0)
  const tongVon = may.reduce((s, m) => s + m.giaNhap, 0) + lo.chiPhiLo
  const phanTramThuHoi = tongVon > 0 ? (daThu / tongVon) * 100 : 0
  const tuoiLo = Math.max(0, soNgay(lo.ngayNhap, homNay))
  const noGoc = noGocLo(lo, may)
  const noConLai = Math.max(0, noGoc - daTra)
  const hanTra = hanTraLo(lo, dh)
  const soNgayConLai = soNgay(homNay, hanTra)
  const huyHieu: ChiSoLo["huyHieu"] = []
  if (tongVon > 0 && phanTramThuHoi >= 100) huyHieu.push("Đã hoàn vốn")
  if (tuoiLo > 15 && phanTramThuHoi < 50) huyHieu.push("Chậm")
  if (tuoiLo > 30 && ton.length > 0) huyHieu.push("Nguy hiểm")
  return {
    ma: lo.ma,
    slNhap,
    slBan: ban.length,
    slTon: ton.length,
    phanTramBan: slNhap ? (ban.length / slNhap) * 100 : 0,
    doanhThu,
    laiDaChot,
    vonTon,
    laiDuKienTon,
    daThu,
    tongVon,
    phanTramThuHoi,
    tuoiLo,
    noGoc,
    daTra,
    noConLai,
    hanTra,
    soNgayConLai,
    mau: mauHan(soNgayConLai, noConLai),
    huyHieu,
    canhBaoCheo: noConLai > vonTon,
  }
}

/* ------------------------------------------- điểm ưu tiên & giá đề xuất */
export type MucLai = "cao" | "TB" | "thấp"
export const mucLai = (lai: number, cd: CaiDat): MucLai => (lai >= cd.laiCao ? "cao" : lai < cd.laiThap ? "thấp" : "TB")

export function tuoiTon(m: Pick<MayLo, "ngayNhap">, homNay: string) {
  return Math.max(0, soNgay(m.ngayNhap, homNay))
}
export function tuoiQuyDoi(m: Pick<MayLo, "ngayNhap" | "ten" | "loaiMay">, homNay: string, cd: CaiDat) {
  const t = tuoiTon(m, homNay)
  return nhomMay(m.ten, m.loaiMay) === "Lock" && cd.heSoLock > 0 ? t / cd.heSoLock : t
}

/**
 * Điểm ưu tiên bán (càng cao càng cần đẩy):
 *   tuổi quy đổi × wTuoi (tới ngày tuoi2) + phần sau ngày tuoi2 × wTuoiSau
 * + wNoDenHan nếu lô còn nợ đến hạn ≤ 7 ngày
 * + giá vốn ÷ 1.000.000 × wGiaVon
 * + wLaiCao nếu lãi dự kiến ≥ ngưỡng lãi cao
 */
export function diemUuTien(m: MayLo, homNay: string, cd: CaiDat, loCoNoDenHan7: boolean) {
  const a = tuoiQuyDoi(m, homNay, cd)
  const diemTuoi = Math.min(a, cd.tuoi2) * cd.wTuoi + Math.max(0, a - cd.tuoi2) * cd.wTuoiSau
  const lai = m.giaBanMucTieu - m.giaNhap
  const diem = diemTuoi + (loCoNoDenHan7 ? cd.wNoDenHan : 0) + (m.giaNhap / 1_000_000) * cd.wGiaVon + (lai >= cd.laiCao ? cd.wLaiCao : 0)
  return Math.round(diem * 10) / 10
}

export type DeXuatGia = {
  tuoi: number
  tuoiQuyDoi: number
  nhomTuoi: "0-7" | "8-15" | "16-30" | ">30"
  laiDuKien: number
  mucLai: MucLai
  giaHienTai: number
  giaDeXuat: number
  giaSan: number
  canDuyet: boolean
  thuongCtv: number
  lyDo: string
}

const lamTron = (n: number) => Math.round(n / 10_000) * 10_000

/** Ma trận giá đề xuất. Không bao giờ dưới giá sàn, trừ máy > 30 ngày (đánh dấu cần duyệt). */
export function deXuatGia(m: MayLo, homNay: string, cd: CaiDat): DeXuatGia {
  const tuoi = tuoiTon(m, homNay)
  const tqd = tuoiQuyDoi(m, homNay, cd)
  const gia = m.giaBanMucTieu
  const von = m.giaNhap
  const lai = gia - von
  const ml = mucLai(lai, cd)
  const san = m.giaSan > 0 ? m.giaSan : von
  const nhomTuoi = tqd <= cd.tuoi1 ? "0-7" : tqd <= cd.tuoi2 ? "8-15" : tqd <= cd.tuoi3 ? "16-30" : ">30"
  let de = gia
  let canDuyet = false
  let thuong = 0
  let lyDo = ""
  const lock = nhomMay(m.ten, m.loaiMay) === "Lock" ? " (Lock, tuổi quy đổi)" : ""
  if (nhomTuoi === "0-7") {
    lyDo = ml === "thấp" ? "Máy mới, lãi thấp: giữ giá, gợi ý bán kèm phụ kiện" : "Máy mới: giữ giá"
  } else if (nhomTuoi === "8-15") {
    if (ml === "cao") {
      de = gia - cd.giamLaiCao8_15
      lyDo = `${Math.round(tqd)} ngày${lock}, lãi cao: giảm ${cd.giamLaiCao8_15.toLocaleString("vi-VN")}`
    } else {
      thuong = cd.thuongCtv8_15
      lyDo = `${Math.round(tqd)} ngày${lock}, lãi ${ml}: giữ giá, tặng quà, thưởng CTV ${thuong.toLocaleString("vi-VN")}`
    }
  } else if (nhomTuoi === "16-30") {
    thuong = cd.thuongCtv16_30
    if (ml === "cao") {
      de = von + cd.laiGiuLaiCao16_30
      lyDo = `${Math.round(tqd)} ngày${lock}, lãi cao: hạ còn lãi ~${cd.laiGiuLaiCao16_30.toLocaleString("vi-VN")}`
    } else if (ml === "TB") {
      de = von + cd.laiToiThieu
      lyDo = `${Math.round(tqd)} ngày${lock}, lãi TB: về lãi tối thiểu`
    } else {
      de = von
      lyDo = `${Math.round(tqd)} ngày${lock}, lãi thấp: về hoà vốn`
    }
  } else {
    thuong = cd.thuongCtvTren30
    de = von
    canDuyet = true
    lyDo = `${Math.round(tqd)} ngày${lock}: cắt lỗ (hoà vốn, có thể lỗ tối đa ${cd.loToiDaTren30.toLocaleString("vi-VN")} hoặc bán sỉ), cần chủ shop duyệt`
  }
  de = lamTron(de)
  if (de > gia) de = gia // chỉ đề xuất hạ giá
  if (de < san) {
    if (nhomTuoi === ">30") canDuyet = true
    else de = Math.min(gia, san)
  }
  return {
    tuoi,
    tuoiQuyDoi: Math.round(tqd * 10) / 10,
    nhomTuoi,
    laiDuKien: lai,
    mucLai: ml,
    giaHienTai: gia,
    giaDeXuat: de,
    giaSan: san,
    canDuyet,
    thuongCtv: thuong,
    lyDo,
  }
}

/* -------------------------------------------------------- tuổi tồn kho */
export function nhomTuoiTon(tuoi: number, cd: CaiDat): "0-7" | "8-15" | "16-30" | ">30" {
  return tuoi <= cd.tuoi1 ? "0-7" : tuoi <= cd.tuoi2 ? "8-15" : tuoi <= cd.tuoi3 ? "16-30" : ">30"
}

/* ------------------------------------------------------ định dạng tiền */
export const vnd = (n: number) => Math.round(n || 0).toLocaleString("vi-VN")
