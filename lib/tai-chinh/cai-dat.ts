// lib/tai-chinh/cai-dat.ts
// Bảng Cai_Dat_Tai_Chinh: mỗi dòng một khoá (Khoá | Giá Trị | Mô Tả), sửa ở trang Cài đặt tài chính
// hoặc trực tiếp trong Quản trị dữ liệu. Khoá thiếu -> dùng giá trị mặc định.
import { BANG, damBaoBang, docBang, suaDong, themDong } from "./bang"
import { CAI_DAT_MAC_DINH, type CaiDat } from "./tinh-toan"

export const MO_TA: Record<keyof CaiDat, string> = {
  tuoi1: "Ngưỡng tuổi tồn 1 (ngày)",
  tuoi2: "Ngưỡng tuổi tồn 2 (ngày)",
  tuoi3: "Ngưỡng tuổi tồn 3 (ngày)",
  laiCao: "Lãi dự kiến từ mức này trở lên là lãi cao (đ)",
  laiThap: "Lãi dự kiến dưới mức này là lãi thấp (đ)",
  laiToiThieu: "Lãi tối thiểu khi hạ giá máy lãi TB 16–30 ngày (đ)",
  laiGiuLaiCao16_30: "Máy lãi cao 16–30 ngày: hạ giá còn lãi khoảng (đ)",
  giamLaiCao8_15: "Máy lãi cao 8–15 ngày: giảm (đ)",
  loToiDaTren30: "Máy trên 30 ngày: có thể lỗ tối đa (đ, cần chủ shop duyệt)",
  heSoLock: "Hệ số rút ngắn tuổi tồn máy Lock (tuổi quy đổi = tuổi ÷ hệ số)",
  wTuoi: "Điểm ưu tiên mỗi ngày tuổi (tới ngưỡng 2)",
  wTuoiSau: "Điểm ưu tiên mỗi ngày tuổi sau ngưỡng 2",
  wNoDenHan: "Điểm cộng khi lô còn nợ đến hạn trong 7 ngày",
  wGiaVon: "Điểm cho mỗi 1.000.000 giá vốn",
  wLaiCao: "Điểm cộng khi lãi dự kiến là lãi cao",
  thuongCtv8_15: "Thưởng CTV máy 8–15 ngày lãi TB/thấp (đ)",
  thuongCtv16_30: "Thưởng CTV máy 16–30 ngày (đ)",
  thuongCtvTren30: "Thưởng CTV máy trên 30 ngày (đ)",
  gioBaoCao: "Giờ báo cáo hằng ngày (giờ VN). Lịch chạy cố định 21:00, đổi giờ cần deploy lại",
}

/** Khoá phụ (không phải con số công thức). */
export const KHOA_PHU = {
  telegramChatId: "telegram_chat_id_chu_shop",
  telegramMa: "telegram_ma_lien_ket",
  telegramMaHan: "telegram_ma_lien_ket_han",
  soDuTay: "so_du_nhap_tay",
  soDuTayNgay: "so_du_nhap_tay_ngay",
  chanBaiDang: "chan_bai_dang",
  // Topic "CHECK MÁY KHÁCH" cho form Báo thu máy khách (ghi khi gõ /checkmay trong topic)
  checkMayChatId: "telegram_check_may_chat_id",
  checkMayThreadId: "telegram_check_may_thread_id",
  // Tiền đơn tự cộng vào Tiền hiện có: ID nguồn nhận từng hình thức + số ngày tiền quẹt thẻ về
  tienDonTienMat: "tien_don_nguon_tien_mat",
  tienDonChuyenKhoan: "tien_don_nguon_chuyen_khoan",
  tienDonThe: "tien_don_nguon_the",
  tienDonSoNgayThe: "tien_don_so_ngay_the_ve",
} as const

export const CHAN_BAI_DANG_MAC_DINH =
  "LH 0399 208 037 - 090909 7177 | 3/39A Bình Giã, P. Tân Bình, TP.HCM | Ship COD toàn quốc – Trả góp – Hỗ trợ trọn đời"

export type CaiDatDayDu = { caiDat: CaiDat; phu: Record<string, string> }

export async function docCaiDat(): Promise<CaiDatDayDu> {
  const { dong } = await docBang(BANG.CAI_DAT)
  const map = new Map(dong.map((d) => [d["Khoá"], d["Giá Trị"]]))
  const caiDat: any = { ...CAI_DAT_MAC_DINH }
  for (const k of Object.keys(CAI_DAT_MAC_DINH) as (keyof CaiDat)[]) {
    const v = map.get(k)
    if (v === undefined || v === "") continue
    if (typeof CAI_DAT_MAC_DINH[k] === "number") {
      const n = Number(String(v).replace(/\./g, "").replace(",", "."))
      // hệ số Lock dạng 0,7 / 0.7
      const n2 = k === "heSoLock" ? Number(String(v).replace(",", ".")) : n
      if (Number.isFinite(n2)) caiDat[k] = n2
    } else caiDat[k] = v
  }
  const phu: Record<string, string> = {}
  for (const v of Object.values(KHOA_PHU)) phu[v] = map.get(v) || ""
  if (!phu[KHOA_PHU.chanBaiDang]) phu[KHOA_PHU.chanBaiDang] = CHAN_BAI_DANG_MAC_DINH
  return { caiDat, phu }
}

/** Ghi một số khoá (thêm dòng nếu chưa có). */
export async function ghiCaiDat(giaTri: Record<string, string | number>) {
  await damBaoBang(BANG.CAI_DAT)
  const { header, dong } = await docBang(BANG.CAI_DAT)
  const sua: { dong: number; giaTri: Record<string, any> }[] = []
  const them: Record<string, any>[] = []
  for (const [k, v] of Object.entries(giaTri)) {
    const d = dong.find((x) => x["Khoá"] === k)
    if (d) sua.push({ dong: d._dong, giaTri: { "Giá Trị": String(v) } })
    else them.push({ Khoá: k, "Giá Trị": String(v), "Mô Tả": (MO_TA as any)[k] || "" })
  }
  if (sua.length) await suaDong(BANG.CAI_DAT, header, sua)
  if (them.length) await themDong(BANG.CAI_DAT, them)
}

/** Ghi đủ các khoá mặc định còn thiếu (lúc tạo bảng) để chủ shop thấy và sửa được. */
export async function ghiCaiDatMacDinh() {
  await damBaoBang(BANG.CAI_DAT)
  const { dong } = await docBang(BANG.CAI_DAT)
  const co = new Set(dong.map((d) => d["Khoá"]))
  const them: { Khoá: string; "Giá Trị": string; "Mô Tả": string }[] = (Object.keys(CAI_DAT_MAC_DINH) as (keyof CaiDat)[])
    .filter((k) => !co.has(k))
    .map((k) => ({ Khoá: k as string, "Giá Trị": String(CAI_DAT_MAC_DINH[k]), "Mô Tả": MO_TA[k] }))
  if (!co.has(KHOA_PHU.chanBaiDang)) them.push({ Khoá: KHOA_PHU.chanBaiDang, "Giá Trị": CHAN_BAI_DANG_MAC_DINH, "Mô Tả": "Chân bài đăng báo giá" })
  if (them.length) await themDong(BANG.CAI_DAT, them)
  return them.length
}
