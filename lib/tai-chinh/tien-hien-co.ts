// lib/tai-chinh/tien-hien-co.ts
// "Tiền hiện có": chủ shop tự nhập số dư thật của từng nguồn tiền (tiền mặt, từng tài khoản ngân hàng, ví...).
// Dùng cho Tổng quan (tài sản ròng) và báo cáo 21h (áp lực tiền) thay cho số app tự tính.
// Bảng Tien_Hien_Co (mỗi nguồn 1 dòng) + Lich_Su_Tien_Hien_Co (mỗi lần đổi 1 dòng, không xoá).
import { DateTime } from "luxon"
import { BRANCHES, type ActiveBranch } from "@/lib/branches"
import { BANG, damBaoBang, docBang, suaDong, themDong, so } from "./bang"
import { ZONE } from "./du-lieu"
import { LoiNghiepVu as LoiTienHienCo } from "./ghi"

export const LOAI_NGUON = ["Tiền mặt", "Ngân hàng", "Ví điện tử", "Khác"] as const
const DINH_DANG = "HH:mm dd/MM/yyyy"

export type NguonTien = {
  id: string
  ten: string
  loai: string
  soDu: number
  chiNhanh: string // "" = chung
  thuTu: number
  an: boolean
  ghiChu: string
  capNhatLuc: string // "HH:mm dd/MM/yyyy"
  nguoiCapNhat: string
  _dong: number
}

export type LichSuTien = {
  thoiGian: string
  idNguon: string
  tenNguon: string
  soDuCu: number | null
  soDuMoi: number | null
  chenhLech: number
  nguoiGhi: string
  ghiChu: string
}


const bayGio = () => DateTime.now().setZone(ZONE)
export const docThoiGian = (s: string) => {
  const t = DateTime.fromFormat(String(s || "").trim(), DINH_DANG, { zone: ZONE })
  return t.isValid ? t : null
}

export async function docNguonTien(): Promise<NguonTien[]> {
  const { dong } = await docBang(BANG.TIEN_HIEN_CO)
  return dong
    .filter((d) => d["ID"])
    .map((d) => ({
      id: d["ID"],
      ten: d["Tên Nguồn"] || d["ID"],
      loai: d["Loại"] || "Khác",
      soDu: so(d["Số Dư"]),
      chiNhanh: d["Chi Nhánh"] || "",
      thuTu: Number(d["Thứ Tự"]) || 0,
      an: /^(ẩn|an|hidden)$/i.test((d["Trạng Thái"] || "").trim()),
      ghiChu: d["Ghi Chú"] || "",
      capNhatLuc: d["Cập Nhật Lúc"] || "",
      nguoiCapNhat: d["Người Cập Nhật"] || "",
      _dong: d._dong,
    }))
    .sort((a, b) => a.thuTu - b.thuTu || a._dong - b._dong)
}

export async function docLichSuTien(gioiHan = 100): Promise<LichSuTien[]> {
  const { dong } = await docBang(BANG.LS_TIEN_HIEN_CO)
  const soHoacNull = (v: string) => (String(v ?? "").trim() === "" ? null : so(v))
  return dong
    .map((d) => ({
      thoiGian: d["Thời Gian"],
      idNguon: d["ID Nguồn"],
      tenNguon: d["Tên Nguồn"],
      soDuCu: soHoacNull(d["Số Dư Cũ"]),
      soDuMoi: soHoacNull(d["Số Dư Mới"]),
      chenhLech: so(d["Chênh Lệch"]),
      nguoiGhi: d["Người Ghi"],
      ghiChu: d["Ghi Chú"],
      _dong: d._dong,
    }))
    .sort((a, b) => b._dong - a._dong)
    .slice(0, gioiHan)
    .map(({ _dong, ...r }) => r)
}

/** Nguồn tính cho chi nhánh đang xem: nguồn "chung" (trống) luôn tính; xem tất cả thì tính hết. */
export function nguonTheoChiNhanh(ds: NguonTien[], active: ActiveBranch) {
  const ten = active === "all" ? "" : BRANCHES.find((b) => b.id === active)?.name || ""
  return ds.filter((n) => !n.an && (!ten || !n.chiNhanh || n.chiNhanh === ten))
}

export type TomTatTien = {
  coDuLieu: boolean
  tong: number
  soNguon: number
  capNhatLuc: string // lần cập nhật gần nhất trong các nguồn đang tính
  capNhatCuNhat: string // nguồn lâu chưa cập nhật nhất
  soNgayCu: number | null // số ngày kể từ lần cập nhật CŨ NHẤT (độ "cũ" của tổng)
}

export function tomTatTien(ds: NguonTien[], active: ActiveBranch): TomTatTien {
  const tinh = nguonTheoChiNhanh(ds, active)
  const tg = tinh.map((n) => docThoiGian(n.capNhatLuc)).filter((x): x is DateTime => !!x)
  const moi = tg.length ? DateTime.max(...tg) : null
  const cu = tg.length ? DateTime.min(...tg) : null
  // nguồn chưa từng cập nhật -> coi như cũ nhất
  const coNguonChuaNhap = tinh.some((n) => !docThoiGian(n.capNhatLuc))
  const soNgayCu = cu && !coNguonChuaNhap ? Math.floor(bayGio().startOf("day").diff(cu.startOf("day"), "days").days) : null
  return {
    coDuLieu: tinh.length > 0 && tg.length > 0,
    tong: tinh.reduce((s, n) => s + n.soDu, 0),
    soNguon: tinh.length,
    capNhatLuc: moi ? moi.toFormat(DINH_DANG) : "",
    capNhatCuNhat: cu ? cu.toFormat(DINH_DANG) : "",
    soNgayCu,
  }
}

export function moTaDoCu(soNgay: number | null): string {
  if (soNgay === null) return "có nguồn chưa nhập số dư"
  if (soNgay <= 0) return "cập nhật hôm nay"
  if (soNgay === 1) return "cập nhật hôm qua"
  return `cập nhật ${soNgay} ngày trước`
}

/* ------------------------------------------------------------------ ghi */

export async function themNguonTien(nguoi: string, v: { ten: string; loai?: string; chiNhanh?: string; soDu?: number | null; ghiChu?: string }) {
  const ten = String(v.ten || "").replace(/\s+/g, " ").trim()
  if (!ten) throw new LoiTienHienCo("Nhập tên nguồn tiền")
  await damBaoBang(BANG.TIEN_HIEN_CO)
  await damBaoBang(BANG.LS_TIEN_HIEN_CO)
  const ds = await docNguonTien()
  if (ds.some((n) => n.ten.toLowerCase() === ten.toLowerCase() && !n.an)) throw new LoiTienHienCo(`Đã có nguồn "${ten}"`)
  const t = bayGio().toFormat(DINH_DANG)
  const id = `TIEN-${Date.now().toString(36).toUpperCase()}`
  const coSoDu = v.soDu !== undefined && v.soDu !== null && String(v.soDu) !== ""
  const soDu = coSoDu ? Math.round(Number(v.soDu) || 0) : 0
  await themDong(BANG.TIEN_HIEN_CO, [
    {
      ID: id,
      "Tên Nguồn": ten,
      Loại: (LOAI_NGUON as readonly string[]).includes(String(v.loai)) ? v.loai : "Khác",
      "Số Dư": soDu,
      "Chi Nhánh": v.chiNhanh || "",
      "Thứ Tự": (ds.reduce((m, n) => Math.max(m, n.thuTu), 0) || ds.length) + 1,
      "Trạng Thái": "Đang dùng",
      "Ghi Chú": v.ghiChu || "",
      "Cập Nhật Lúc": coSoDu ? t : "",
      "Người Cập Nhật": coSoDu ? nguoi : "",
      "Ngày Tạo": t,
    },
  ])
  await themDong(BANG.LS_TIEN_HIEN_CO, [
    { "Thời Gian": t, "ID Nguồn": id, "Tên Nguồn": ten, "Số Dư Cũ": "", "Số Dư Mới": coSoDu ? soDu : "", "Chênh Lệch": coSoDu ? soDu : 0, "Người Ghi": nguoi, "Ghi Chú": "Thêm nguồn", "Chi Nhánh": v.chiNhanh || "" },
  ])
  return id
}

/** Lưu số dư mới cho nhiều nguồn một lần. Nguồn không đổi số vẫn được đóng dấu "đã kiểm lúc" nếu xacNhanTatCa. */
export async function luuSoDu(nguoi: string, soDu: Record<string, number>, ghiChu = "", xacNhanTatCa = true) {
  await damBaoBang(BANG.TIEN_HIEN_CO)
  await damBaoBang(BANG.LS_TIEN_HIEN_CO)
  const { header } = await docBang(BANG.TIEN_HIEN_CO)
  const ds = await docNguonTien()
  const t = bayGio().toFormat(DINH_DANG)
  const sua: { dong: number; giaTri: Record<string, any> }[] = []
  const ls: Record<string, any>[] = []
  for (const n of ds) {
    if (n.an) continue
    const coGui = Object.prototype.hasOwnProperty.call(soDu, n.id)
    if (!coGui && !xacNhanTatCa) continue
    const moi = coGui ? Math.round(Number(soDu[n.id]) || 0) : n.soDu
    if (!Number.isFinite(moi)) throw new LoiTienHienCo(`Số dư "${n.ten}" không hợp lệ`)
    sua.push({ dong: n._dong, giaTri: { "Số Dư": moi, "Cập Nhật Lúc": t, "Người Cập Nhật": nguoi } })
    ls.push({
      "Thời Gian": t,
      "ID Nguồn": n.id,
      "Tên Nguồn": n.ten,
      "Số Dư Cũ": n.capNhatLuc ? n.soDu : "",
      "Số Dư Mới": moi,
      "Chênh Lệch": moi - (n.capNhatLuc ? n.soDu : 0),
      "Người Ghi": nguoi,
      "Ghi Chú": ghiChu || (moi === n.soDu ? "Kiểm lại, không đổi" : "Cập nhật số dư"),
      "Chi Nhánh": n.chiNhanh,
    })
  }
  if (!sua.length) throw new LoiTienHienCo("Chưa có nguồn tiền nào để lưu")
  await suaDong(BANG.TIEN_HIEN_CO, header, sua)
  await themDong(BANG.LS_TIEN_HIEN_CO, ls)
  return sua.length
}

/** Đổi tên / loại / chi nhánh / ẩn-hiện / thứ tự một nguồn. Mọi thay đổi ghi vào lịch sử. */
export async function suaNguonTien(nguoi: string, id: string, v: { ten?: string; loai?: string; chiNhanh?: string; an?: boolean; thuTu?: number; ghiChu?: string }) {
  await damBaoBang(BANG.TIEN_HIEN_CO)
  await damBaoBang(BANG.LS_TIEN_HIEN_CO)
  const { header } = await docBang(BANG.TIEN_HIEN_CO)
  const ds = await docNguonTien()
  const n = ds.find((x) => x.id === id)
  if (!n) throw new LoiTienHienCo("Không tìm thấy nguồn tiền")
  const giaTri: Record<string, any> = {}
  const doi: string[] = []
  if (v.ten !== undefined) {
    const ten = String(v.ten).replace(/\s+/g, " ").trim()
    if (!ten) throw new LoiTienHienCo("Tên nguồn không được trống")
    if (ten !== n.ten) {
      giaTri["Tên Nguồn"] = ten
      doi.push(`Đổi tên "${n.ten}" → "${ten}"`)
    }
  }
  if (v.loai !== undefined && v.loai !== n.loai) {
    giaTri["Loại"] = v.loai
    doi.push(`Loại: ${v.loai}`)
  }
  if (v.chiNhanh !== undefined && v.chiNhanh !== n.chiNhanh) {
    giaTri["Chi Nhánh"] = v.chiNhanh
    doi.push(`Chi nhánh: ${v.chiNhanh || "Chung"}`)
  }
  if (v.an !== undefined && v.an !== n.an) {
    giaTri["Trạng Thái"] = v.an ? "Ẩn" : "Đang dùng"
    doi.push(v.an ? "Ẩn nguồn (không tính vào tổng)" : "Hiện lại nguồn")
  }
  if (v.thuTu !== undefined && v.thuTu !== n.thuTu) giaTri["Thứ Tự"] = v.thuTu
  if (v.ghiChu !== undefined && v.ghiChu !== n.ghiChu) giaTri["Ghi Chú"] = v.ghiChu
  if (!Object.keys(giaTri).length) return
  await suaDong(BANG.TIEN_HIEN_CO, header, [{ dong: n._dong, giaTri }])
  if (doi.length) {
    const t = bayGio().toFormat(DINH_DANG)
    await themDong(BANG.LS_TIEN_HIEN_CO, [
      { "Thời Gian": t, "ID Nguồn": n.id, "Tên Nguồn": giaTri["Tên Nguồn"] || n.ten, "Số Dư Cũ": "", "Số Dư Mới": "", "Chênh Lệch": 0, "Người Ghi": nguoi, "Ghi Chú": doi.join("; "), "Chi Nhánh": giaTri["Chi Nhánh"] ?? n.chiNhanh },
    ])
  }
}
