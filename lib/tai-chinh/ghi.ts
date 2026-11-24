// lib/tai-chinh/ghi.ts
// Các thao tác GHI của phần Tài chính. Chỉ thêm dòng / sửa ô của bảng tài chính,
// và sửa cột "Giá Bán" của Kho_Hang khi chủ shop áp dụng giá đề xuất (có ghi Lich_Su_Gia).
import { DateTime } from "luxon"
import { readFromGoogleSheets, colIndex } from "@/lib/google-sheets"
import { recordSupplierPaymentCash } from "@/lib/cash-flow/sheets"
import { BANG, cotChu, damBaoBang, docBang, suaDong, themDong, so } from "./bang"
import { ZONE, docKho, homNayVN, ngayISO, ngayVN, taiDuLieu, type MayKho } from "./du-lieu"
import { khoanNoCuaDauHang } from "./bao-cao"
import { phanBoFIFO } from "./tinh-toan"
import { batchUpdateRangeValues } from "@/lib/google-sheets"

const bayGio = () => DateTime.now().setZone(ZONE).toFormat("HH:mm:ss d/M/yyyy")
const genId = (p: string) => `${p}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`

export class LoiNghiepVu extends Error {}

/* ---------------------------------------------------------------- mã lô */
/** LO-YYMMDD-xx, xx tăng dần theo các lô cùng ngày nhập. */
export function taoMaLo(ngayNhapISO: string, maDaCo: string[]): string {
  const goc = `LO-${ngayNhapISO.slice(2, 4)}${ngayNhapISO.slice(5, 7)}${ngayNhapISO.slice(8, 10)}-`
  let max = 0
  for (const m of maDaCo) {
    if (m.startsWith(goc)) max = Math.max(max, Number(m.slice(goc.length)) || 0)
  }
  return `${goc}${String(max + 1).padStart(2, "0")}`
}

/* -------------------------------------------------------------- đầu hàng */
export type NhapDauHang = { ten: string; sdt?: string; soNgayNo?: number; nganHang?: string; stk?: string; loaiHang?: string; ghiChu?: string; trangThai?: string }

export async function themDauHang(x: NhapDauHang) {
  if (!String(x.ten || "").trim()) throw new LoiNghiepVu("Nhập tên đầu hàng")
  const { dong } = await docBang(BANG.DAU_HANG)
  if (dong.some((d) => String(d["Tên"] || "").trim().toLowerCase() === x.ten.trim().toLowerCase())) throw new LoiNghiepVu("Đã có đầu hàng tên này")
  const id = `DH${String(dong.length + 1).padStart(3, "0")}`
  const idDung = dong.some((d) => d["ID"] === id) ? genId("DH") : id
  await themDong(BANG.DAU_HANG, [
    {
      ID: idDung,
      Tên: x.ten.trim(),
      SĐT: x.sdt || "",
      "Số Ngày Nợ": Math.max(0, Math.round(Number(x.soNgayNo) || 0)),
      "Ngân Hàng": x.nganHang || "",
      "Số Tài Khoản": x.stk || "",
      "Loại Hàng Hay Nhập": x.loaiHang || "",
      "Ghi Chú": x.ghiChu || "",
      "Trạng Thái": x.trangThai || "Đang giao dịch",
      "Ngày Tạo": bayGio(),
    },
  ])
  return idDung
}

export async function suaDauHang(id: string, x: NhapDauHang) {
  const { header, dong } = await docBang(BANG.DAU_HANG)
  const d = dong.find((r) => r["ID"] === id)
  if (!d) throw new LoiNghiepVu("Không tìm thấy đầu hàng")
  const g: Record<string, any> = {}
  if (x.ten !== undefined) g["Tên"] = x.ten.trim()
  if (x.sdt !== undefined) g["SĐT"] = x.sdt
  if (x.soNgayNo !== undefined) g["Số Ngày Nợ"] = Math.max(0, Math.round(Number(x.soNgayNo) || 0))
  if (x.nganHang !== undefined) g["Ngân Hàng"] = x.nganHang
  if (x.stk !== undefined) g["Số Tài Khoản"] = x.stk
  if (x.loaiHang !== undefined) g["Loại Hàng Hay Nhập"] = x.loaiHang
  if (x.ghiChu !== undefined) g["Ghi Chú"] = x.ghiChu
  if (x.trangThai !== undefined) g["Trạng Thái"] = x.trangThai
  await suaDong(BANG.DAU_HANG, header, [{ dong: d._dong, giaTri: g }])
}

/* ------------------------------------------------------------------- CTV */
export async function themCtv(x: { ten: string; sdt?: string; hoaHong?: number; ghiChu?: string }) {
  if (!String(x.ten || "").trim()) throw new LoiNghiepVu("Nhập tên CTV")
  const { dong } = await docBang(BANG.CTV)
  const id = `CTV${String(dong.length + 1).padStart(3, "0")}`
  await themDong(BANG.CTV, [
    {
      ID: dong.some((d) => d["ID"] === id) ? genId("CTV") : id,
      Tên: x.ten.trim(),
      SĐT: x.sdt || "",
      "Hoa Hồng Mặc Định": Math.max(0, Math.round(Number(x.hoaHong) || 0)),
      "Ghi Chú": x.ghiChu || "",
      "Trạng Thái": "Đang làm",
      "Ngày Tạo": bayGio(),
    },
  ])
}
export async function suaCtv(id: string, x: { ten?: string; sdt?: string; hoaHong?: number; ghiChu?: string; trangThai?: string }) {
  const { header, dong } = await docBang(BANG.CTV)
  const d = dong.find((r) => r["ID"] === id)
  if (!d) throw new LoiNghiepVu("Không tìm thấy CTV")
  const g: Record<string, any> = {}
  if (x.ten !== undefined) g["Tên"] = x.ten
  if (x.sdt !== undefined) g["SĐT"] = x.sdt
  if (x.hoaHong !== undefined) g["Hoa Hồng Mặc Định"] = Math.max(0, Math.round(Number(x.hoaHong) || 0))
  if (x.ghiChu !== undefined) g["Ghi Chú"] = x.ghiChu
  if (x.trangThai !== undefined) g["Trạng Thái"] = x.trangThai
  await suaDong(BANG.CTV, header, [{ dong: d._dong, giaTri: g }])
}

/* -------------------------------------------------------------------- lô */
export type NhapLo = {
  dauHangId: string
  ngayNhap?: string // yyyy-MM-dd
  chiPhiLo?: number
  chiPhiTraDauHang?: boolean
  daTraLucNhap?: number
  hanTra?: string // yyyy-MM-dd, trống = ngày nhập + số ngày nợ
  tongHoaDon?: number
  ghiChu?: string
  chiNhanh: string // tên chi nhánh
  nguoiTao: string
  ma?: string // chỉ dùng cho lô đặc biệt (LO-CU-KHONG-RO)
}

export async function taoLo(x: NhapLo): Promise<string> {
  const { dong: dh } = await docBang(BANG.DAU_HANG)
  const dauHang = dh.find((d) => d["ID"] === x.dauHangId)
  if (!dauHang) throw new LoiNghiepVu("Chọn đầu hàng")
  const ngay = x.ngayNhap || homNayVN()
  const { dong } = await docBang(BANG.LO_NHAP)
  const ma = x.ma || taoMaLo(ngay, dong.map((d) => d["Mã Lô"]))
  if (dong.some((d) => d["Mã Lô"] === ma)) throw new LoiNghiepVu(`Mã lô ${ma} đã có`)
  await themDong(BANG.LO_NHAP, [
    {
      "Mã Lô": ma,
      "ID Đầu Hàng": dauHang["ID"],
      "Tên Đầu Hàng": dauHang["Tên"],
      "Ngày Nhập": ngayVN(ngay),
      "Chi Phí Lô": Math.max(0, Math.round(Number(x.chiPhiLo) || 0)),
      "Chi Phí Trả Đầu Hàng": x.chiPhiTraDauHang ? "Có" : "Không",
      "Đã Trả Lúc Nhập": Math.max(0, Math.round(Number(x.daTraLucNhap) || 0)),
      "Hạn Trả Nợ": x.hanTra ? ngayVN(x.hanTra) : "",
      "Tổng Hoá Đơn": Math.max(0, Math.round(Number(x.tongHoaDon) || 0)) || "",
      "Ghi Chú": x.ghiChu || "",
      "Trạng Thái": "Đang mở",
      "Người Tạo": x.nguoiTao,
      "Ngày Tạo": bayGio(),
      "Chi Nhánh": x.chiNhanh,
    },
  ])
  return ma
}

export async function suaLo(ma: string, x: Partial<Omit<NhapLo, "nguoiTao" | "ma">> & { trangThai?: string }) {
  const { header, dong } = await docBang(BANG.LO_NHAP)
  const d = dong.find((r) => r["Mã Lô"] === ma)
  if (!d) throw new LoiNghiepVu("Không tìm thấy lô")
  const g: Record<string, any> = {}
  if (x.dauHangId !== undefined) {
    const { dong: dh } = await docBang(BANG.DAU_HANG)
    const dauHang = dh.find((r) => r["ID"] === x.dauHangId)
    if (!dauHang) throw new LoiNghiepVu("Không tìm thấy đầu hàng")
    g["ID Đầu Hàng"] = dauHang["ID"]
    g["Tên Đầu Hàng"] = dauHang["Tên"]
  }
  if (x.ngayNhap !== undefined) g["Ngày Nhập"] = ngayVN(x.ngayNhap)
  if (x.chiPhiLo !== undefined) g["Chi Phí Lô"] = Math.max(0, Math.round(Number(x.chiPhiLo) || 0))
  if (x.chiPhiTraDauHang !== undefined) g["Chi Phí Trả Đầu Hàng"] = x.chiPhiTraDauHang ? "Có" : "Không"
  if (x.daTraLucNhap !== undefined) g["Đã Trả Lúc Nhập"] = Math.max(0, Math.round(Number(x.daTraLucNhap) || 0))
  if (x.hanTra !== undefined) g["Hạn Trả Nợ"] = x.hanTra ? ngayVN(x.hanTra) : ""
  if (x.tongHoaDon !== undefined) g["Tổng Hoá Đơn"] = Math.max(0, Math.round(Number(x.tongHoaDon) || 0)) || ""
  if (x.ghiChu !== undefined) g["Ghi Chú"] = x.ghiChu
  if (x.trangThai !== undefined) g["Trạng Thái"] = x.trangThai
  await suaDong(BANG.LO_NHAP, header, [{ dong: d._dong, giaTri: g }])
}

/** Danh sách lô gọn cho ô chọn lô ở form nhập hàng (nhân viên cũng xem được: không có tiền). */
export async function loChoNhapHang(chiNhanh: string | null) {
  const { dong } = await docBang(BANG.LO_NHAP)
  return dong
    .filter((d) => d["Mã Lô"] && (d["Trạng Thái"] || "Đang mở") !== "Đã chốt")
    .filter((d) => !chiNhanh || !d["Chi Nhánh"] || d["Chi Nhánh"] === chiNhanh)
    .map((d) => ({ ma: d["Mã Lô"], dauHang: d["Tên Đầu Hàng"], ngayNhap: ngayISO(d["Ngày Nhập"]) }))
    .sort((a, b) => b.ngayNhap.localeCompare(a.ngayNhap) || b.ma.localeCompare(a.ma))
}

/* ------------------------------------------------------------- sổ lô */
export type MayNhap = {
  idMay?: string
  imei?: string
  serial?: string
  ten?: string
  loaiMay?: string
  dungLuong?: string
  mau?: string
  pin?: string
  tinhTrang?: string
  dangSim?: string
  giaNhap?: number | string
  giaBan?: number | string
  ngayNhap?: string // yyyy-MM-dd
}

/** Ghi các máy vừa nhập vào sổ lô (không bao giờ xoá). Bỏ qua máy đã có trong đúng lô này. */
export async function themMayVaoLo(maLo: string, ds: MayNhap[], chiNhanh: string) {
  if (!maLo || !ds.length) return 0
  await damBaoBang(BANG.CHI_TIET_LO)
  const { dong: lo } = await docBang(BANG.LO_NHAP)
  const l = lo.find((x) => x["Mã Lô"] === maLo)
  if (!l) throw new LoiNghiepVu(`Không tìm thấy lô ${maLo}`)
  const { dong } = await docBang(BANG.CHI_TIET_LO)
  const daCo = new Set(
    dong.filter((d) => d["Mã Lô"] === maLo).flatMap((d) => [d["IMEI"], d["Serial"]].filter(Boolean).map((s) => s.toUpperCase())),
  )
  const ngayLo = ngayISO(l["Ngày Nhập"]) || homNayVN()
  const rows = ds
    .filter((m) => {
      const ids = [m.imei, m.serial].filter(Boolean).map((s) => String(s).trim().toUpperCase())
      return !ids.some((id) => daCo.has(id))
    })
    .map((m) => ({
      "Mã Lô": maLo,
      "ID Máy": m.idMay || "",
      IMEI: String(m.imei || "").trim(),
      Serial: String(m.serial || "").trim().toUpperCase(),
      "Tên Sản Phẩm": m.ten || "",
      "Loại Máy": m.loaiMay || "",
      "Dung Lượng": m.dungLuong || "",
      "Màu Sắc": m.mau || "",
      "Pin (%)": m.pin || "",
      "Tình Trạng Máy": m.tinhTrang || "",
      "Dạng Sim": m.dangSim || "",
      "Giá Nhập": so(m.giaNhap) || "",
      "Giá Bán Lúc Nhập": so(m.giaBan) || "",
      "Ngày Nhập": ngayVN(m.ngayNhap || ngayLo),
      "Trạng Thái": "Tồn",
      "Cập Nhật Lúc": bayGio(),
      "Chi Nhánh": chiNhanh,
    }))
  await themDong(BANG.CHI_TIET_LO, rows)
  return rows.length
}

/** Gán các máy đang có trong Kho_Hang (chưa thuộc lô nào) vào một lô. */
export async function ganMayKhoVaoLo(maLo: string, dongKho: number[] | "tat-ca-chua-co-lo", chiNhanh?: string) {
  const kho = await docKho()
  const { dong } = await docBang(BANG.CHI_TIET_LO)
  const coLo = new Set(dong.flatMap((d) => [d["IMEI"], d["Serial"]].filter(Boolean).map((s) => s.toUpperCase())))
  const chon = kho.filter(
    (k) =>
      k.trangThai !== "Đã bán" &&
      (dongKho === "tat-ca-chua-co-lo" ? true : dongKho.includes(k.dong)) &&
      (!chiNhanh || k.chiNhanh === chiNhanh) &&
      ![k.imei, k.serial].filter(Boolean).some((id) => coLo.has(id.toUpperCase())),
  )
  // mỗi chi nhánh ghi đúng chi nhánh của máy
  const theoCN = new Map<string, MayKho[]>()
  for (const k of chon) {
    if (!theoCN.has(k.chiNhanh)) theoCN.set(k.chiNhanh, [])
    theoCN.get(k.chiNhanh)!.push(k)
  }
  let n = 0
  for (const [cn, ds] of theoCN) {
    n += await themMayVaoLo(
      maLo,
      ds.map((k) => ({
        idMay: k.idMay,
        imei: k.imei,
        serial: k.serial,
        ten: k.ten,
        loaiMay: k.loaiMay,
        dungLuong: k.dungLuong,
        mau: k.mau,
        pin: k.pin,
        tinhTrang: k.tinhTrang,
        dangSim: k.dangSim,
        giaNhap: k.giaNhap,
        giaBan: k.giaBan,
        ngayNhap: k.ngayNhap,
      })),
      cn,
    )
  }
  return n
}

export type SuaMayLo = {
  giaSan?: number
  ctvGiu?: string
  ctvBan?: string
  hoaHong?: number
  phiTraGop?: number
  phiKhac?: number
  daThuDu?: boolean
  ghiChu?: string
  giaNhap?: number
}

export async function suaMayLo(dong: number, x: SuaMayLo) {
  const { header, dong: ds } = await docBang(BANG.CHI_TIET_LO)
  const d = ds.find((r) => r._dong === dong)
  if (!d) throw new LoiNghiepVu("Không tìm thấy máy trong sổ lô")
  const g: Record<string, any> = {}
  const tien = (v: any) => Math.max(0, Math.round(Number(v) || 0))
  if (x.giaSan !== undefined) g["Giá Sàn"] = tien(x.giaSan) || ""
  if (x.giaNhap !== undefined) g["Giá Nhập"] = tien(x.giaNhap) || ""
  if (x.ctvGiu !== undefined) {
    g["CTV Đang Giữ"] = x.ctvGiu
    g["Ngày Giao CTV"] = x.ctvGiu ? ngayVN(homNayVN()) : ""
  }
  if (x.ctvBan !== undefined) g["CTV Bán"] = x.ctvBan
  if (x.hoaHong !== undefined) g["Hoa Hồng CTV"] = tien(x.hoaHong) || ""
  if (x.phiTraGop !== undefined) g["Phí Trả Góp"] = tien(x.phiTraGop) || ""
  if (x.phiKhac !== undefined) g["Phí Khác"] = tien(x.phiKhac) || ""
  if (x.daThuDu !== undefined) g["Đã Thu Đủ"] = x.daThuDu ? "Có" : ""
  if (x.ghiChu !== undefined) g["Ghi Chú"] = x.ghiChu
  g["Cập Nhật Lúc"] = bayGio()
  await suaDong(BANG.CHI_TIET_LO, header, [{ dong, giaTri: g }])
}

/* ------------------------------------------------------- trả nợ đầu hàng */
export async function ghiTraNo(x: {
  dauHangId: string
  soTien: number
  ngay?: string
  maLo?: string
  nguonTienId?: string
  ghiChu?: string
  nguoiGhi: string
}) {
  const soTien = Math.round(Number(x.soTien) || 0)
  if (soTien <= 0) throw new LoiNghiepVu("Số tiền phải lớn hơn 0")
  const d = await taiDuLieu()
  const dh = d.dauHang.find((y) => y.id === x.dauHangId)
  if (!dh) throw new LoiNghiepVu("Chọn đầu hàng")
  const khoan = khoanNoCuaDauHang(d, dh.id)
  const tong = khoan.reduce((s, k) => s + k.conLai, 0)
  if (x.maLo && !khoan.some((k) => k.maLo === x.maLo)) throw new LoiNghiepVu("Lô này không thuộc đầu hàng đã chọn")
  const { phanBo, du } = phanBoFIFO(soTien, khoan, x.maLo || "")
  if (du > 0) throw new LoiNghiepVu(`Số tiền vượt tổng nợ của ${dh.ten} (${tong.toLocaleString("vi-VN")} đ)`)
  const id = genId("TN")
  let nguon = ""
  if (x.nguonTienId) {
    const r = await recordSupplierPaymentCash({
      amount: soTien,
      accountId: x.nguonTienId,
      refId: id,
      counterparty: dh.ten,
      note: `Trả đầu hàng ${dh.ten}${x.ghiChu ? ` · ${x.ghiChu}` : ""} · ${Object.keys(phanBo).join(", ")}`,
      actor: x.nguoiGhi,
      occurredAt: x.ngay,
    })
    nguon = r.accountName
  }
  await themDong(BANG.TRA_NO, [
    {
      ID: id,
      "ID Đầu Hàng": dh.id,
      "Tên Đầu Hàng": dh.ten,
      "Ngày Trả": ngayVN(x.ngay || homNayVN()),
      "Số Tiền": soTien,
      "Mã Lô Chọn": x.maLo || "",
      "Phân Bổ": JSON.stringify(phanBo),
      "Nguồn Tiền": nguon || "Ngoài app",
      "Ghi Chú": x.ghiChu || "",
      "Người Ghi": x.nguoiGhi,
      "Ngày Tạo": bayGio(),
    },
  ])
  return { id, phanBo }
}

/* ---------------------------------------------------- áp dụng giá đề xuất */
export async function apDungGia(
  ds: { dongKho: number; idMay: string; imei: string; giaMoi: number; lyDo: string }[],
  nguoiDuyet: string,
) {
  if (!ds.length) return 0
  const { header, rows } = await readFromGoogleSheets("Kho_Hang", undefined, { force: true })
  const H = (header || []).map((x: any) => String(x ?? "").trim())
  const iGia = colIndex(H, "Giá Bán")
  const iId = colIndex(H, "ID Máy")
  const iImei = colIndex(H, "IMEI")
  const iSerial = colIndex(H, "Serial")
  const iTen = colIndex(H, "Tên Sản Phẩm")
  const iCn = colIndex(H, "Chi Nhánh")
  if (iGia === -1) throw new Error("Kho_Hang thiếu cột Giá Bán")
  const updates: { range: string; values: any[][] }[] = []
  const log: Record<string, any>[] = []
  for (const x of ds) {
    const r = rows[x.dongKho - 2]
    // kiểm tra đúng máy (kho có thể vừa đổi thứ tự dòng do bán/xoá)
    const khop =
      r &&
      ((x.imei && [String(r[iImei] ?? "").trim(), String(r[iSerial] ?? "").trim()].includes(x.imei)) ||
        (!x.imei && String(r[iId] ?? "").trim() === x.idMay))
    if (!khop) throw new LoiNghiepVu(`Máy ${x.imei || x.idMay} đã đổi vị trí trong kho, tải lại trang rồi thử lại`)
    const giaMoi = Math.round(Number(x.giaMoi) || 0)
    if (giaMoi <= 0) throw new LoiNghiepVu("Giá mới không hợp lệ")
    updates.push({ range: `'Kho_Hang'!${cotChu(iGia + 1)}${x.dongKho}`, values: [[giaMoi]] })
    log.push({
      "Thời Gian": bayGio(),
      "ID Máy": String(r[iId] ?? ""),
      "IMEI/Serial": x.imei,
      "Tên Sản Phẩm": String(r[iTen] ?? ""),
      "Giá Cũ": so(r[iGia]),
      "Giá Mới": giaMoi,
      "Lý Do": x.lyDo,
      "Người Duyệt": nguoiDuyet,
      "Chi Nhánh": iCn === -1 ? "" : String(r[iCn] ?? ""),
    })
  }
  await batchUpdateRangeValues(updates)
  await themDong(BANG.LICH_SU_GIA, log)
  return updates.length
}

/* ------------------------------------------------------- chi phí ngoài */
export async function themChiPhi(x: {
  ngay?: string
  loai: string
  soTien: number
  maDon?: string
  maLo?: string
  nguonTienId?: string
  ghiChu?: string
  nguoiGhi: string
  chiNhanh: string
}) {
  const soTien = Math.round(Number(x.soTien) || 0)
  if (soTien <= 0) throw new LoiNghiepVu("Số tiền phải lớn hơn 0")
  await damBaoBang(BANG.CHI_PHI)
  if (x.maLo) {
    const { dong } = await docBang(BANG.LO_NHAP)
    if (!dong.some((d) => d["Mã Lô"] === x.maLo)) throw new LoiNghiepVu(`Không có lô ${x.maLo}`)
  }
  const id = genId("CP")
  let nguon = ""
  if (x.nguonTienId) {
    try {
      const r = await recordSupplierPaymentCash({
        kind: "expense",
        amount: soTien,
        accountId: x.nguonTienId,
        refId: id,
        counterparty: x.loai,
        note: `Chi phí ${x.loai}${x.ghiChu ? ` · ${x.ghiChu}` : ""}${x.maDon ? ` · đơn ${x.maDon}` : ""}`,
        actor: x.nguoiGhi,
        occurredAt: x.ngay,
      })
      nguon = r.accountName
    } catch (e: any) {
      throw new LoiNghiepVu(e?.message || "Không trừ được nguồn tiền")
    }
  }
  await themDong(BANG.CHI_PHI, [
    {
      ID: id,
      Ngày: ngayVN(x.ngay || homNayVN()),
      Loại: x.loai || "Khác",
      "Số Tiền": soTien,
      "Mã Đơn": x.maDon || "",
      "Mã Lô": x.maLo || "",
      "Nguồn Tiền": nguon || "Ngoài app",
      "ID Nguồn Tiền": x.nguonTienId || "",
      "Ghi Chú": x.ghiChu || "",
      "Trạng Thái": "",
      "Người Ghi": x.nguoiGhi,
      "Ngày Tạo": bayGio(),
      "Chi Nhánh": x.chiNhanh,
    },
  ])
  return id
}

/** Huỷ khoản chi (giữ dòng, ghi "Đã huỷ"); nếu đã trừ nguồn tiền thì cộng lại. */
export async function huyChiPhi(id: string, nguoiGhi: string) {
  const { header, dong } = await docBang(BANG.CHI_PHI)
  const d = dong.find((r) => r["ID"] === id)
  if (!d) throw new LoiNghiepVu("Không tìm thấy khoản chi")
  if (/huỷ|hủy/i.test(d["Trạng Thái"] || "")) return
  if (d["ID Nguồn Tiền"]) {
    await recordSupplierPaymentCash({
      kind: "expense_reversal",
      amount: so(d["Số Tiền"]),
      accountId: d["ID Nguồn Tiền"],
      refId: id,
      counterparty: d["Loại"],
      note: `Huỷ chi phí ${d["Loại"]} ${d["Ngày"]}`,
      actor: nguoiGhi,
    })
  }
  await suaDong(BANG.CHI_PHI, header, [{ dong: d._dong, giaTri: { "Trạng Thái": `Đã huỷ (${nguoiGhi} ${bayGio()})` } }])
}

/**
 * Chuyển máy CÒN TỒN đang nằm ở lô cũ (lô "không tính nợ", vd LO-CU-KHONG-RO) sang một lô thật.
 * Dùng khi chia lại hàng tồn cũ theo từng đầu hàng. Chỉ đổi Mã Lô của dòng sổ lô (không tạo dòng mới).
 */
export async function chuyenMayTuLoCu(maLoDich: string, dongSo: number[]) {
  const { header, dong } = await docBang(BANG.CHI_TIET_LO)
  const { dong: loDong } = await docBang(BANG.LO_NHAP)
  const dich = loDong.find((l) => l["Mã Lô"] === maLoDich)
  if (!dich) throw new LoiNghiepVu(`Không tìm thấy lô ${maLoDich}`)
  if (/không tính nợ/i.test(dich["Trạng Thái"] || "")) throw new LoiNghiepVu("Không chuyển vào lô cũ được, hãy chọn lô của đầu hàng")
  const loCu = new Set(loDong.filter((l) => /không tính nợ/i.test(l["Trạng Thái"] || "")).map((l) => l["Mã Lô"]))
  const chon = new Set(dongSo)
  const sua = dong
    .filter((d) => chon.has(d._dong) && loCu.has(d["Mã Lô"]) && !/đã bán|không còn/i.test(d["Trạng Thái"] || ""))
    .map((d) => ({
      dong: d._dong,
      giaTri: {
        "Mã Lô": maLoDich,
        "Ghi Chú": [d["Ghi Chú"], `Chuyển từ ${d["Mã Lô"]}`].filter(Boolean).join(" · "),
        "Cập Nhật Lúc": bayGio(),
      },
    }))
  if (!sua.length) throw new LoiNghiepVu("Không có máy nào hợp lệ để chuyển (máy phải còn tồn và đang ở lô cũ)")
  await suaDong(BANG.CHI_TIET_LO, header, sua)
  return sua.length
}

/**
 * Gắn bù máy ĐÃ BÁN vào một lô (vd lô A 10 máy, đã bán 2 trước khi tạo lô).
 * - Máy đang ở lô cũ "không tính nợ" -> đổi Mã Lô của dòng đó.
 * - Máy chưa có trong sổ lô -> thêm 1 dòng mới chụp từ đơn bán (giá nhập lấy từ đơn bán).
 * Ngày nhập của dòng mới = ngày nhập của lô, hoặc ngày bán nếu lô nhập sau ngày bán (để khớp đúng đơn).
 */
export async function ganMayDaBanVaoLo(maLoDich: string, khoaChon: string[]) {
  const { mayDaBanChoGan } = await import("./bao-cao")
  const d = await taiDuLieu()
  const dich = d.lo.find((l) => l.ma === maLoDich)
  if (!dich) throw new LoiNghiepVu(`Không tìm thấy lô ${maLoDich}`)
  if (/không tính nợ/i.test(dich.trangThai || "")) throw new LoiNghiepVu("Không gắn vào lô cũ được, hãy chọn lô của đầu hàng")
  const chon = new Set(khoaChon)
  const ds = mayDaBanChoGan(d, "all").filter((m) => chon.has(m.khoa))
  if (!ds.length) throw new LoiNghiepVu("Không có máy nào hợp lệ (máy phải đã bán và chưa thuộc lô của đầu hàng nào)")
  const banTheoKhoa = new Map(d.ban.filter((b) => b.laMay).map((b) => [`${b.maDon}|${b.imei || b.serial}`, b]))
  const now = bayGio()

  const sua = ds
    .filter((m) => m.dongSoCu)
    .map((m) => {
      const goc = d.may.find((x) => x._dong === m.dongSoCu)
      return {
        dong: m.dongSoCu as number,
        giaTri: {
          "Mã Lô": maLoDich,
          "Ghi Chú": [goc?._goc["Ghi Chú"], `Chuyển từ ${m.loCu} (đã bán)`].filter(Boolean).join(" · "),
          "Cập Nhật Lúc": now,
        },
      }
    })
  if (sua.length) {
    const { header } = await docBang(BANG.CHI_TIET_LO)
    await suaDong(BANG.CHI_TIET_LO, header, sua)
  }

  const moi = ds
    .filter((m) => !m.dongSoCu)
    .map((m) => {
      const b = banTheoKhoa.get(m.khoa)
      const ngayNhap = dich.ngayNhap && b?.ngayBan && dich.ngayNhap > b.ngayBan ? b.ngayBan : dich.ngayNhap || b?.ngayBan || homNayVN()
      const imei = String(b?.imei || "").trim()
      return {
        "Mã Lô": maLoDich,
        "ID Máy": (imei || String(b?.serial || "")).slice(-5),
        IMEI: imei,
        Serial: String(b?.serial || "").trim().toUpperCase(),
        "Tên Sản Phẩm": b?.ten || m.ten,
        "Loại Máy": b?.loaiMay || "",
        "Dung Lượng": b?.dungLuong || "",
        "Màu Sắc": b?.mau || "",
        "Pin (%)": b?.pin || "",
        "Tình Trạng Máy": b?.tinhTrang || "",
        "Giá Nhập": m.giaNhap || "",
        "Ngày Nhập": ngayVN(ngayNhap),
        "Trạng Thái": "Đã bán",
        "Ghi Chú": `Thêm vào lô sau khi đã bán (đơn ${m.maDon})`,
        "Cập Nhật Lúc": now,
        "Chi Nhánh": m.chiNhanh || dich.chiNhanh,
      }
    })
  if (moi.length) {
    await damBaoBang(BANG.CHI_TIET_LO)
    await themDong(BANG.CHI_TIET_LO, moi)
  }
  // ghi lại tình trạng (mã đơn, ngày bán, lãi) cho các dòng vừa đổi/thêm
  try {
    const { luuTinhTrangSoLo } = await import("./du-lieu")
    await luuTinhTrangSoLo(await taiDuLieu())
  } catch {}
  return sua.length + moi.length
}
