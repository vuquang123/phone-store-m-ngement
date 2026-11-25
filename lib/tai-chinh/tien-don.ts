// lib/tai-chinh/tien-don.ts
// Tiền từ đơn bán tự cộng vào "Tiền hiện có" — TÍNH LÚC ĐỌC từ Ban_Hang, không ghi thêm gì khi xuất đơn:
//   - Tiền mặt     -> nguồn "Quỹ tiền mặt"      (có hiệu lực lúc xuất đơn)
//   - Chuyển khoản -> nguồn nhận chuyển khoản    (lúc xuất đơn)
//   - Thẻ (quẹt)   -> nguồn nhận tiền thẻ        (sau N ngày kể từ lúc xuất đơn, mặc định 2; trước đó là "Sắp về")
//   - "Trả lại khách - Tiền mặt/Chuyển khoản": trừ khỏi nguồn tương ứng.
//   - Thu máy, góp (iCloud/Mirae/HD/Thẻ tín dụng), COD, đặt cọc trước: không cộng.
//   - Đơn hoàn trả cả đơn: không cộng (coi như tiền vào rồi hoàn ra). Hoàn một phần: vẫn cộng, đánh dấu
//     "có hoàn trả" vì app chưa ghi tiền hoàn trả bằng hình thức nào.
// Số dư một nguồn = số chủ shop nhập gần nhất + các khoản có hiệu lực SAU lúc nhập đó.
// Vì tính từ Ban_Hang nên sửa / xoá đơn tự đúng theo; không có sổ phụ nào bị lệch.
import { DateTime } from "luxon"
import { docBang, so } from "./bang"
import { KHOA_PHU, docCaiDat } from "./cai-dat"
import { ZONE } from "./du-lieu"
import { docThoiGian, type NguonTien } from "./tien-hien-co"

export type HinhThuc = "Tiền mặt" | "Chuyển khoản" | "Thẻ"
export const HINH_THUC: HinhThuc[] = ["Tiền mặt", "Chuyển khoản", "Thẻ"]

export type CaiDatTienDon = {
  tienMat: string // ID nguồn
  chuyenKhoan: string
  the: string
  soNgayThe: number
}

export type KhoanTienDon = {
  maDon: string
  luc: string // "HH:mm dd/MM/yyyy" lúc xuất đơn
  hinhThuc: HinhThuc
  traLai: boolean // "Trả lại khách - ..." (trừ)
  soTien: number // âm khi trả lại khách
  hieuLuc: string // "HH:mm dd/MM/yyyy" lúc tiền vào nguồn
  nguonId: string // "" = chưa gán nguồn nhận
  chiNhanh: string
  trangThai: "Đã cộng" | "Sắp về" | "Trước lần nhập số dư" | "Chưa gán nguồn" | "Đơn đã hoàn trả"
  coHoanTra: boolean // đơn có máy hoàn trả: tiền hoàn chưa trừ (app chưa ghi hình thức hoàn)
}

const DD = "HH:mm dd/MM/yyyy"

/** Tách "Chuyển khoản: ₫1.000.000 | Thẻ: ₫9.820.000 | Trả lại khách - Tiền mặt: ₫500.000" thành các khoản tiền về nguồn. */
export function tachThanhToan(s: string): { hinhThuc: HinhThuc; traLai: boolean; soTien: number }[] {
  const out: { hinhThuc: HinhThuc; traLai: boolean; soTien: number }[] = []
  for (const phan of String(s || "").split("|")) {
    const m = phan.trim().match(/^(trả lại khách\s*-\s*)?(tiền mặt|chuyển khoản|thẻ)\s*:\s*₫?\s*([\d.,]+)\s*đ?\s*$/i)
    if (!m) continue // Thu máy, Góp..., Mira, HDSaison, Thẻ tín dụng, COD, Đặt cọc trước... không cộng
    const n = so(m[3])
    if (!n) continue
    const ten = m[2].toLowerCase()
    const hinhThuc: HinhThuc = ten === "tiền mặt" ? "Tiền mặt" : ten === "thẻ" ? "Thẻ" : "Chuyển khoản"
    out.push({ hinhThuc, traLai: !!m[1], soTien: m[1] ? -n : n })
  }
  return out
}

const boDau = (s: string) =>
  String(s || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/gi, "d")
    .toLowerCase()

/**
 * Cài đặt hiệu lực: khoá đã lưu nếu có (và nguồn còn dùng), không thì tự khớp theo tên:
 * tiền mặt = nguồn loại "Tiền mặt" hoặc tên có "tiền mặt"; chuyển khoản = tên có "Long"; thẻ = tên có "Dũng".
 */
export function caiDatHieuLuc(phu: Record<string, string>, ds: NguonTien[]): CaiDatTienDon & { tuKhop: Record<keyof Omit<CaiDatTienDon, "soNgayThe">, boolean> } {
  const dung = ds.filter((n) => !n.an)
  const co = (id: string) => (id && dung.some((n) => n.id === id) ? id : "")
  const tim = (f: (n: NguonTien) => boolean) => dung.find(f)?.id || ""
  const daLuu = {
    tienMat: co(phu[KHOA_PHU.tienDonTienMat] || ""),
    chuyenKhoan: co(phu[KHOA_PHU.tienDonChuyenKhoan] || ""),
    the: co(phu[KHOA_PHU.tienDonThe] || ""),
  }
  const goiY = {
    tienMat: tim((n) => n.loai === "Tiền mặt" || boDau(n.ten).includes("tien mat")),
    chuyenKhoan: tim((n) => /\blong\b/.test(boDau(n.ten))),
    the: tim((n) => /\bdung\b/.test(boDau(n.ten))),
  }
  // Ô đã lưu là "-" = cố ý không gán
  const chon = (k: keyof typeof daLuu, khoa: string) => (phu[khoa] === "-" ? "" : daLuu[k] || goiY[k])
  const soNgay = Number(phu[KHOA_PHU.tienDonSoNgayThe])
  return {
    tienMat: chon("tienMat", KHOA_PHU.tienDonTienMat),
    chuyenKhoan: chon("chuyenKhoan", KHOA_PHU.tienDonChuyenKhoan),
    the: chon("the", KHOA_PHU.tienDonThe),
    soNgayThe: Number.isFinite(soNgay) && phu[KHOA_PHU.tienDonSoNgayThe] !== "" && soNgay >= 0 ? soNgay : 2,
    tuKhop: {
      tienMat: !daLuu.tienMat && phu[KHOA_PHU.tienDonTienMat] !== "-" && !!goiY.tienMat,
      chuyenKhoan: !daLuu.chuyenKhoan && phu[KHOA_PHU.tienDonChuyenKhoan] !== "-" && !!goiY.chuyenKhoan,
      the: !daLuu.the && phu[KHOA_PHU.tienDonThe] !== "-" && !!goiY.the,
    },
  }
}

/** Mốc tính của một nguồn: lần nhập số dư gần nhất, chưa nhập thì lúc tạo nguồn. */
export function mocNguon(n: NguonTien & { ngayTao?: string }): DateTime | null {
  return docThoiGian(n.capNhatLuc) || docThoiGian(n.ngayTao || "")
}

function lucDon(ngay: string, gio: string): DateTime | null {
  const d = String(ngay || "").trim()
  if (!d) return null
  const g = String(gio || "").trim() || "00:00:00"
  for (const f of ["d/M/yyyy H:mm:ss", "d/M/yyyy H:mm"]) {
    const t = DateTime.fromFormat(`${d} ${g}`, f, { zone: ZONE })
    if (t.isValid) return t
  }
  const t = DateTime.fromISO(d, { zone: ZONE })
  return t.isValid ? t : null
}

/**
 * Các khoản tiền đơn có thể ảnh hưởng tới số dư (từ mốc cũ nhất của các nguồn − số ngày thẻ về).
 * Đơn nhiều máy lặp lại chuỗi thanh toán ở mọi dòng -> chỉ lấy 1 lần mỗi đơn.
 */
export async function docKhoanTienDon(ds: NguonTien[], cd: CaiDatTienDon): Promise<KhoanTienDon[]> {
  const moc = ds
    .filter((n) => !n.an)
    .map((n) => mocNguon(n))
    .filter((x): x is DateTime => !!x)
  if (!moc.length) return []
  const tu = DateTime.min(...moc)!.minus({ days: cd.soNgayThe + 1 })
  const { dong } = await docBang("Ban_Hang")
  const laHoan = (r: Record<string, string>) => r["Trạng Thái"] === "Hoàn trả" || r["Loại Đơn"] === "Hoàn trả"
  // Đếm số dòng / số dòng hoàn của từng đơn: hoàn cả đơn -> không cộng; hoàn một phần -> cộng + cảnh báo
  const demDon = new Map<string, { n: number; hoan: number }>()
  for (const r of dong) {
    const ma = r["Mã đơn hàng"] || r["Mã Đơn Hàng"] || r["Mã đơn"] || ""
    if (!ma) continue
    const k = `${ma}|${r["Ngày bán"] || r["Ngày Bán"]}`
    const c = demDon.get(k) || { n: 0, hoan: 0 }
    c.n++
    if (laHoan(r)) c.hoan++
    demDon.set(k, c)
  }
  const daLay = new Set<string>()
  const nguonCua: Record<HinhThuc, string> = { "Tiền mặt": cd.tienMat, "Chuyển khoản": cd.chuyenKhoan, Thẻ: cd.the }
  const mocCua = new Map(ds.map((n) => [n.id, mocNguon(n)]))
  const bayGio = DateTime.now().setZone(ZONE)
  const out: KhoanTienDon[] = []
  for (const r of dong) {
    const ma = r["Mã đơn hàng"] || r["Mã Đơn Hàng"] || r["Mã đơn"] || ""
    const tt = r["Hình Thức Thanh Toán"] || ""
    if (!ma || !tt) continue
    const luc = lucDon(r["Ngày bán"] || r["Ngày Bán"], r["Giờ bán"] || r["Giờ Bán"])
    if (!luc || luc < tu) continue
    const khoa = `${ma}|${r["Ngày bán"] || r["Ngày Bán"]}`
    if (daLay.has(khoa)) continue
    daLay.add(khoa)
    const dem = demDon.get(khoa) || { n: 1, hoan: 0 }
    const hoanCa = dem.hoan > 0 && dem.hoan >= dem.n
    for (const k of tachThanhToan(tt)) {
      const hieuLuc = k.hinhThuc === "Thẻ" && !k.traLai ? luc.plus({ days: cd.soNgayThe }) : luc
      const nguonId = nguonCua[k.hinhThuc]
      const m = nguonId ? mocCua.get(nguonId) : null
      let trangThai: KhoanTienDon["trangThai"]
      if (hoanCa) trangThai = "Đơn đã hoàn trả"
      else if (!nguonId) trangThai = "Chưa gán nguồn"
      // Cùng phút với lúc nhập số dư -> coi như đã nằm trong số đã nhập
      else if (!m || hieuLuc < m.startOf("minute").plus({ minutes: 1 })) trangThai = "Trước lần nhập số dư"
      else if (hieuLuc > bayGio) trangThai = "Sắp về"
      else trangThai = "Đã cộng"
      out.push({
        maDon: ma,
        luc: luc.toFormat(DD),
        hinhThuc: k.hinhThuc,
        traLai: k.traLai,
        soTien: k.soTien,
        hieuLuc: hieuLuc.toFormat(DD),
        nguonId,
        chiNhanh: r["Chi Nhánh"] || "",
        trangThai,
        coHoanTra: dem.hoan > 0 && !hoanCa,
      })
    }
  }
  return out.sort((a, b) => (docThoiGian(b.hieuLuc)?.toMillis() || 0) - (docThoiGian(a.hieuLuc)?.toMillis() || 0))
}

export async function docCaiDatTienDon(ds: NguonTien[]) {
  const { phu } = await docCaiDat()
  return caiDatHieuLuc(phu, ds)
}

/** Số dư từng nguồn đã cộng tiền đơn: soDuTinh = số đã nhập + khoản "Đã cộng"; sapVe = khoản "Sắp về". */
export function soDuTheoNguon(ds: NguonTien[], khoan: KhoanTienDon[]) {
  return ds.map((n) => {
    const cua = khoan.filter((k) => k.nguonId === n.id)
    const cong = cua.filter((k) => k.trangThai === "Đã cộng").reduce((s, k) => s + k.soTien, 0)
    const sapVe = cua.filter((k) => k.trangThai === "Sắp về").reduce((s, k) => s + k.soTien, 0)
    return { ...n, tienDon: cong, soDuTinh: n.soDu + cong, sapVe }
  })
}

/** Gom một lần cho trang Tiền hiện có, Tổng quan và báo cáo 21h. */
export async function taiTienHienCo(active: import("@/lib/branches").ActiveBranch) {
  const { docNguonTien, tomTatTien } = await import("./tien-hien-co")
  const nguon = await docNguonTien()
  const caiDat = await docCaiDatTienDon(nguon)
  const khoan = await docKhoanTienDon(nguon, caiDat).catch((e) => {
    console.error("[Tiền hiện có] đọc tiền đơn lỗi:", e?.message || e)
    return [] as KhoanTienDon[]
  })
  return {
    nguon,
    caiDat,
    khoan,
    soDu: soDuTheoNguon(nguon, khoan),
    tomTat: tomTatTien(nguon, active, khoan),
  }
}
