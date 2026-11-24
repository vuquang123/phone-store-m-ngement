// lib/tai-chinh/du-lieu.ts
// Nạp dữ liệu gốc (bảng tài chính + Kho_Hang + Ban_Hang) và gắn tình trạng hiện tại cho
// từng máy trong sổ lô. Mọi con số trên các trang Tài chính đều tính lại từ đây mỗi lần mở.
//
// Tình trạng một máy trong sổ lô (Chi_Tiet_Lo) được suy ra, không phụ thuộc luồng nào ghi:
//   - còn trong Kho_Hang (khớp IMEI/Serial)  -> theo cột Trạng Thái của kho (Tồn / Đang xử lý / ...)
//   - không còn trong kho, có đơn Ban_Hang sau ngày nhập -> Đã bán (mã đơn, ngày, giá, người bán)
//   - không thấy ở đâu -> "Không còn trong kho" (xoá tay, trả lại đầu hàng...)
// Kho_Hang vẫn xoá máy khi bán như cũ; sổ lô thì giữ nguyên dòng và chỉ đổi phần tình trạng.
import { DateTime } from "luxon"
import { readFromGoogleSheets, colIndex } from "@/lib/google-sheets"
import { BRANCHES, rowBranchId, branchName, type ActiveBranch } from "@/lib/branches"
import { BANG, docBang, suaDong, so, coKhong, type Dong } from "./bang"
import { docCaiDat, type CaiDatDayDu } from "./cai-dat"
import {
  chiaDoanhThu,
  tienChuaVe,
  laiMay,
  type DauHang,
  type Lo,
  type MayLo,
  type TraNo,
  type TrangThaiMay,
} from "./tinh-toan"

export const ZONE = "Asia/Ho_Chi_Minh"
export const homNayVN = () => DateTime.now().setZone(ZONE).toISODate()!

/** 8/10/2026, 08/10/2026, 2026-10-08, "16:45 22/11/2026" -> "2026-10-08" ("" nếu không đọc được). */
export function ngayISO(raw: unknown): string {
  const s = String(raw ?? "").trim()
  if (!s) return ""
  const m = s.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/)
  if (m) {
    const d = DateTime.fromObject({ day: +m[1], month: +m[2], year: +m[3] }, { zone: ZONE })
    return d.isValid ? d.toISODate()! : ""
  }
  const iso = DateTime.fromISO(s.slice(0, 10), { zone: ZONE })
  return iso.isValid ? iso.toISODate()! : ""
}
/** "2026-10-08" -> "8/10/2026" (kiểu ngày đang dùng trên Sheet). */
export const ngayVN = (iso: string) => (iso ? `${+iso.slice(8, 10)}/${+iso.slice(5, 7)}/${iso.slice(0, 4)}` : "")

const khoa = (s: unknown) => String(s ?? "").trim().toUpperCase()
const fold = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D").toLowerCase()

export function trangThaiTuKho(trangThai: string, dangXuLy: string): TrangThaiMay {
  const t = fold(trangThai || "")
  if (t.includes("da ban")) return "Đã bán"
  if (t.includes("bao hanh")) return "Bảo hành"
  if (t.includes("doi tac")) return "Gửi đối tác"
  if (t.includes("cnc") || t.includes("xu ly")) return "Đang xử lý"
  return "Tồn"
}

/* ----------------------------------------------------------- kiểu nạp */
export type MayKho = {
  dong: number
  idMay: string
  imei: string
  serial: string
  ten: string
  loaiMay: string
  dungLuong: string
  mau: string
  pin: string
  tinhTrang: string
  dangSim: string
  giaNhap: number
  giaBan: number
  ngayNhap: string
  trangThai: TrangThaiMay
  chiNhanh: string
}
export type DongBan = {
  maDon: string
  ngayBan: string
  imei: string
  serial: string
  ten: string
  loaiMay: string
  giaBan: number
  giaNhap: number
  doanhThu: number // phần tổng thu của máy (đã chia theo giá bán)
  chuaThu: number
  nguoiBan: string
  chiNhanh: string
  laMay: boolean
  tongThuDon: number
  dungLuong?: string
  mau?: string
  pin?: string
  tinhTrang?: string
}
export type MaySo = MayLo & { _dong: number; _goc: Dong; daThuDu: boolean; luuLai: Record<string, string> }

export type DuLieu = {
  homNay: string
  caiDat: CaiDatDayDu
  dauHang: DauHang[]
  lo: Lo[]
  loDong: Dong[]
  may: MaySo[]
  soHeader: string[]
  traNo: TraNo[]
  ctv: { id: string; ten: string; sdt: string; hoaHong: number; trangThai: string }[]
  kho: MayKho[]
  ban: DongBan[]
  chiPhi: ChiPhiNgoai[]
}

export type ChiPhiNgoai = {
  id: string
  ngay: string
  loai: string
  soTien: number
  maDon: string
  maLo: string
  nguonTien: string
  ghiChu: string
  nguoiGhi: string
  chiNhanh: string
  _dong: number
}
export const LOAI_CHI_PHI = ["Quảng cáo", "Phụ kiện lẻ", "Ship đơn ngoài", "Khác"] as const
export function docChiPhi(d: Dong): ChiPhiNgoai {
  return {
    id: d["ID"],
    ngay: ngayISO(d["Ngày"]),
    loai: d["Loại"] || "Khác",
    soTien: so(d["Số Tiền"]),
    maDon: d["Mã Đơn"] || "",
    maLo: d["Mã Lô"] || "",
    nguonTien: d["Nguồn Tiền"] || "",
    ghiChu: d["Ghi Chú"] || "",
    nguoiGhi: d["Người Ghi"] || "",
    chiNhanh: branchName(rowBranchId(d["Chi Nhánh"] || "")),
    _dong: d._dong,
  }
}

/* ------------------------------------------------------- nạp từng bảng */
export function docDauHang(d: Dong): DauHang {
  return {
    id: d["ID"],
    ten: d["Tên"],
    sdt: d["SĐT"],
    soNgayNo: so(d["Số Ngày Nợ"]),
    nganHang: d["Ngân Hàng"] || "",
    stk: d["Số Tài Khoản"] || "",
    loaiHang: d["Loại Hàng Hay Nhập"] || "",
    ghiChu: d["Ghi Chú"] || "",
    trangThai: d["Trạng Thái"] || "Đang giao dịch",
  }
}
export function docLo(d: Dong): Lo {
  return {
    ma: d["Mã Lô"],
    dauHangId: d["ID Đầu Hàng"],
    ngayNhap: ngayISO(d["Ngày Nhập"]),
    chiPhiLo: so(d["Chi Phí Lô"]),
    chiPhiTinhNo: coKhong(d["Chi Phí Trả Đầu Hàng"]),
    daTraLucNhap: so(d["Đã Trả Lúc Nhập"]),
    hanTra: ngayISO(d["Hạn Trả Nợ"]),
    tongHoaDon: so(d["Tổng Hoá Đơn"]),
    ghiChu: d["Ghi Chú"] || "",
    chiNhanh: branchName(rowBranchId(d["Chi Nhánh"])),
    trangThai: d["Trạng Thái"] || "Đang mở",
  }
}
function docTraNo(d: Dong): TraNo {
  let phanBo: Record<string, number> = {}
  try {
    const o = JSON.parse(d["Phân Bổ"] || "{}")
    for (const [k, v] of Object.entries(o)) phanBo[k] = Number(v) || 0
  } catch {
    phanBo = {}
  }
  return {
    id: d["ID"],
    dauHangId: d["ID Đầu Hàng"],
    ngay: ngayISO(d["Ngày Trả"]),
    soTien: so(d["Số Tiền"]),
    maLo: d["Mã Lô Chọn"] || "",
    phanBo,
    nguonTien: d["Nguồn Tiền"] || "",
    ghiChu: d["Ghi Chú"] || "",
    nguoiGhi: d["Người Ghi"] || "",
  }
}

export async function docKho(): Promise<MayKho[]> {
  let data
  try {
    data = await readFromGoogleSheets("Kho_Hang", undefined, { silent: true, force: true })
  } catch {
    return []
  }
  const H = (data.header || []).map((x: any) => String(x ?? "").trim())
  const i = {
    id: colIndex(H, "ID Máy"),
    ngay: colIndex(H, "Ngày Nhập"),
    ten: colIndex(H, "Tên Sản Phẩm"),
    loai: colIndex(H, "Loại Máy"),
    dl: colIndex(H, "Dung Lượng"),
    pin: colIndex(H, "Pin (%)"),
    mau: colIndex(H, "Màu Sắc"),
    imei: colIndex(H, "IMEI"),
    serial: colIndex(H, "Serial"),
    tt: colIndex(H, "Tình Trạng Máy"),
    sim: colIndex(H, "Dạng Sim", "Dạng sim"),
    gn: colIndex(H, "Giá nhập", "Giá Nhập"),
    gb: colIndex(H, "Giá Bán"),
    trangThai: colIndex(H, "Trạng Thái"),
    xuLy: colIndex(H, "Đang xử lý"),
    cn: colIndex(H, "Chi Nhánh"),
  }
  const c = (r: any[], j: number) => (j === -1 ? "" : String(r[j] ?? "").trim())
  const out: MayKho[] = []
  ;(data.rows || []).forEach((r: any[], k: number) => {
    const imei = c(r, i.imei)
    const serial = c(r, i.serial)
    const ten = c(r, i.ten)
    if (!imei && !serial && !ten) return
    out.push({
      dong: k + 2,
      idMay: c(r, i.id),
      imei,
      serial,
      ten,
      loaiMay: c(r, i.loai),
      dungLuong: c(r, i.dl),
      mau: c(r, i.mau),
      pin: c(r, i.pin),
      tinhTrang: c(r, i.tt),
      dangSim: c(r, i.sim),
      giaNhap: so(c(r, i.gn)),
      giaBan: so(c(r, i.gb)),
      ngayNhap: ngayISO(c(r, i.ngay)),
      trangThai: trangThaiTuKho(c(r, i.trangThai), c(r, i.xuLy)),
      chiNhanh: branchName(rowBranchId(c(r, i.cn))),
    })
  })
  return out
}

export async function docBanHang(): Promise<DongBan[]> {
  let data
  try {
    data = await readFromGoogleSheets("Ban_Hang", undefined, { silent: true, force: true })
  } catch {
    return []
  }
  const H = (data.header || []).map((x: any) => String(x ?? "").trim())
  const i = {
    ma: colIndex(H, "Mã đơn hàng", "Mã Đơn Hàng", "ID Đơn Hàng"),
    ngay: colIndex(H, "Ngày bán", "Ngày Bán", "Ngày Xuất"),
    ten: colIndex(H, "Tên Sản Phẩm"),
    loai: colIndex(H, "Loại Máy"),
    imei: colIndex(H, "IMEI"),
    serial: colIndex(H, "Serial"),
    gb: colIndex(H, "Giá Bán"),
    tong: colIndex(H, "Tổng Thu"),
    ht: colIndex(H, "Hình Thức Thanh Toán"),
    gn: colIndex(H, "Giá Nhập", "Giá nhập"),
    nb: colIndex(H, "Người Bán"),
    vc: colIndex(H, "Hình Thức Vận Chuyển"),
    cn: colIndex(H, "Chi Nhánh"),
    dl: colIndex(H, "Dung Lượng"),
    mau: colIndex(H, "Màu Sắc"),
    pin: colIndex(H, "Pin (%)"),
    tt: colIndex(H, "Tình Trạng Máy"),
    trang: colIndex(H, "Trạng Thái"),
    loaiDon: colIndex(H, "Loại Đơn"),
  }
  const c = (r: any[], j: number) => (j === -1 ? "" : String(r[j] ?? "").trim())
  type Tam = Omit<DongBan, "doanhThu" | "chuaThu" | "tongThuDon"> & { tongThu: number; ht: string; vc: string; k: number }
  const theoDon = new Map<string, Tam[]>()
  const tatCa: Tam[] = []
  ;(data.rows || []).forEach((r: any[], k: number) => {
    const ma = c(r, i.ma)
    if (!ma) return
    // Máy đã hoàn trả: không tính là đã bán (máy quay lại kho, tiền đã hoàn cho khách)
    if (c(r, i.trang) === "Hoàn trả" || c(r, i.loaiDon) === "Hoàn trả") return
    const imei = c(r, i.imei)
    const serial = c(r, i.serial)
    const t: Tam = {
      k,
      maDon: ma,
      ngayBan: ngayISO(c(r, i.ngay)),
      imei,
      serial,
      ten: c(r, i.ten),
      loaiMay: c(r, i.loai),
      giaBan: so(c(r, i.gb)),
      giaNhap: so(c(r, i.gn)),
      nguoiBan: c(r, i.nb),
      chiNhanh: branchName(rowBranchId(c(r, i.cn))),
      laMay: !!(imei || serial),
      tongThu: so(c(r, i.tong)),
      ht: c(r, i.ht),
      vc: c(r, i.vc),
      dungLuong: c(r, i.dl),
      mau: c(r, i.mau),
      pin: c(r, i.pin),
      tinhTrang: c(r, i.tt),
    }
    tatCa.push(t)
    const key = `${ma}|${t.ngayBan}`
    if (!theoDon.has(key)) theoDon.set(key, [])
    theoDon.get(key)!.push(t)
  })
  const out: DongBan[] = []
  for (const ds of theoDon.values()) {
    // Tổng Thu thường chỉ ở dòng đầu; nếu mọi dòng lặp lại cùng một số thì đó là tổng của cả đơn (không cộng dồn)
    const coTong = ds.filter((x) => x.tongThu > 0)
    const lapLai = coTong.length > 1 && coTong.every((x) => x.tongThu === coTong[0].tongThu)
    const tongThu = lapLai ? coTong[0].tongThu : ds.reduce((s, x) => s + x.tongThu, 0)
    // Cột Hình Thức Thanh Toán lặp lại ở mọi dòng của đơn -> chỉ đọc ở dòng mang Tổng Thu (dòng đầu)
    const dau = ds.reduce((a, x) => (x.tongThu > a.tongThu ? x : a), ds[0])
    const chuaVe = Math.min(tongThu, tienChuaVe(dau.ht, dau.vc || ds.map((x) => x.vc).join(" ")))
    const may = ds.filter((x) => x.laMay)
    const phan = chiaDoanhThu(tongThu, (may.length ? may : ds).map((x) => x.giaBan))
    const chua = chiaDoanhThu(Math.round(chuaVe), (may.length ? may : ds).map((x) => x.giaBan))
    const nhom = may.length ? may : ds
    nhom.forEach((x, j) => {
      const { tongThu: _t, ht: _h, vc: _v, k: _k, ...rest } = x
      out.push({ ...rest, doanhThu: phan[j], chuaThu: chua[j], tongThuDon: tongThu })
    })
  }
  return out
}

/* ------------------------------------------------------------ nạp tất cả */
export async function taiDuLieu(homNay = homNayVN()): Promise<DuLieu> {
  const [caiDat, dh, lo, so_, tn, ctv, kho, ban, cp] = await Promise.all([
    docCaiDat(),
    docBang(BANG.DAU_HANG),
    docBang(BANG.LO_NHAP),
    docBang(BANG.CHI_TIET_LO),
    docBang(BANG.TRA_NO),
    docBang(BANG.CTV),
    docKho(),
    docBanHang(),
    docBang(BANG.CHI_PHI),
  ])
  const may = ganTinhTrang(so_.dong, kho, ban)
  return {
    homNay,
    caiDat,
    dauHang: dh.dong.filter((d) => d["ID"]).map(docDauHang),
    lo: lo.dong.filter((d) => d["Mã Lô"]).map(docLo),
    loDong: lo.dong,
    may,
    soHeader: so_.header,
    traNo: tn.dong.filter((d) => d["ID"]).map(docTraNo),
    ctv: ctv.dong
      .filter((d) => d["ID"])
      .map((d) => ({ id: d["ID"], ten: d["Tên"], sdt: d["SĐT"], hoaHong: so(d["Hoa Hồng Mặc Định"]), trangThai: d["Trạng Thái"] || "Đang làm" })),
    kho,
    ban,
    chiPhi: cp.dong.filter((d) => d["ID"] && !/huỷ|hủy/i.test(d["Trạng Thái"] || "")).map(docChiPhi),
  }
}

/**
 * Gắn tình trạng hiện tại cho từng dòng sổ lô từ Kho_Hang và Ban_Hang.
 * Một IMEI có thể được nhập nhiều lần (mua lại máy đã bán): đơn bán thuộc về lần nhập
 * gần nhất trước ngày bán; máy đang trong kho thuộc về lần nhập cuối cùng.
 */
export function ganTinhTrang(soLo: Dong[], kho: MayKho[], ban: DongBan[]): MaySo[] {
  const khoTheoId = new Map<string, MayKho>()
  for (const k of kho) {
    if (k.imei) khoTheoId.set(khoa(k.imei), k)
    if (k.serial) khoTheoId.set(khoa(k.serial), k)
  }
  const banTheoId = new Map<string, DongBan[]>()
  for (const b of ban) {
    if (!b.laMay) continue
    for (const id of [b.imei, b.serial]) {
      if (!id) continue
      const k = khoa(id)
      if (!banTheoId.has(k)) banTheoId.set(k, [])
      banTheoId.get(k)!.push(b)
    }
  }
  for (const ds of banTheoId.values()) ds.sort((a, b) => a.ngayBan.localeCompare(b.ngayBan))

  const dsMay: MaySo[] = soLo
    .filter((d) => d["Mã Lô"] && (d["IMEI"] || d["Serial"] || d["Tên Sản Phẩm"]))
    .map((d) => ({
      _dong: d._dong,
      _goc: d,
      luuLai: {},
      daThuDu: coKhong(d["Đã Thu Đủ"]),
      maLo: d["Mã Lô"],
      idMay: d["ID Máy"],
      imei: d["IMEI"],
      serial: d["Serial"],
      ten: d["Tên Sản Phẩm"],
      loaiMay: d["Loại Máy"],
      dungLuong: d["Dung Lượng"],
      mau: d["Màu Sắc"],
      pin: d["Pin (%)"],
      tinhTrang: d["Tình Trạng Máy"],
      giaNhap: so(d["Giá Nhập"]),
      giaBanMucTieu: so(d["Giá Bán Lúc Nhập"]),
      giaSan: so(d["Giá Sàn"]),
      ngayNhap: ngayISO(d["Ngày Nhập"]),
      chiNhanh: branchName(rowBranchId(d["Chi Nhánh"])),
      trangThai: "Không còn trong kho" as TrangThaiMay,
      ctvGiu: d["CTV Đang Giữ"] || "",
      maDon: "",
      ngayBan: "",
      doanhThu: 0,
      chuaThu: 0,
      chiPhiPhuKien: 0,
      hoaHong: so(d["Hoa Hồng CTV"]),
      phiTraGop: so(d["Phí Trả Góp"]),
      phiKhac: so(d["Phí Khác"]),
      ctvBan: d["CTV Bán"] || "",
      nguoiBan: "",
    }))

  // nhóm các lần nhập theo định danh
  const theoId = new Map<string, MaySo[]>()
  for (const m of dsMay) {
    const id = khoa(m.imei || m.serial)
    if (!id) continue
    if (!theoId.has(id)) theoId.set(id, [])
    theoId.get(id)!.push(m)
  }
  for (const [id, ds] of theoId) {
    ds.sort((a, b) => a.ngayNhap.localeCompare(b.ngayNhap) || a._dong - b._dong)
    const trongKho = khoTheoId.get(id) || khoTheoId.get(khoa(ds[0].serial)) || khoTheoId.get(khoa(ds[0].imei))
    const dsBan = banTheoId.get(id) || (ds[0].serial ? banTheoId.get(khoa(ds[0].serial)) : undefined) || []
    ds.forEach((m, j) => {
      const tiep = ds[j + 1]
      const laCuoi = !tiep
      if (laCuoi && trongKho) {
        m.trangThai = trongKho.trangThai === "Đã bán" ? "Đã bán" : trongKho.trangThai
        if (m.trangThai === "Tồn" && m.ctvGiu) m.trangThai = "CTV giữ"
        if (trongKho.giaBan > 0) m.giaBanMucTieu = trongKho.giaBan
        return
      }
      const b = dsBan.find((x) => x.ngayBan >= m.ngayNhap && (!tiep || x.ngayBan <= tiep.ngayNhap))
      if (b) {
        m.trangThai = "Đã bán"
        m.maDon = b.maDon
        m.ngayBan = b.ngayBan
        m.doanhThu = b.doanhThu
        m.chuaThu = b.chuaThu
        m.chiPhiPhuKien = Math.max(0, b.giaNhap - m.giaNhap)
        m.nguoiBan = b.nguoiBan
      }
    })
  }

  // phần tình trạng ghi ngược vào sổ lô (để xem trên Sheet)
  for (const m of dsMay) {
    m.luuLai = {
      "Trạng Thái": m.trangThai,
      "Mã Đơn": m.maDon,
      "Ngày Bán": m.ngayBan ? ngayVN(m.ngayBan) : "",
      "Giá Bán Thực": m.trangThai === "Đã bán" ? String(m.doanhThu) : "",
      "Người Bán": m.nguoiBan,
      "Lãi Máy": m.trangThai === "Đã bán" ? String(laiMay(m)) : "",
    }
  }
  return dsMay
}

/** Ghi phần tình trạng đã suy ra vào Chi_Tiet_Lo cho các dòng bị lệch. Trả số dòng đã sửa. */
export async function luuTinhTrangSoLo(d: DuLieu): Promise<number> {
  if (!d.soHeader.length) return 0
  const now = DateTime.now().setZone(ZONE).toFormat("HH:mm d/M/yyyy")
  const sua = d.may
    .filter((m) => Object.entries(m.luuLai).some(([k, v]) => (m._goc[k] || "") !== v))
    .map((m) => ({ dong: m._dong, giaTri: { ...m.luuLai, "Cập Nhật Lúc": now } }))
  if (!sua.length) return 0
  await suaDong(BANG.CHI_TIET_LO, d.soHeader, sua)
  return sua.length
}

/** Lọc theo chi nhánh đang xem ("all" = tất cả). */
export function theoChiNhanh<T extends { chiNhanh: string }>(ds: T[], active: ActiveBranch): T[] {
  if (active === "all") return ds
  const ten = BRANCHES.find((b) => b.id === active)?.name
  return ds.filter((x) => x.chiNhanh === ten)
}
