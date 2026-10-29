// Định dạng tin "Báo cáo tổng hợp" gửi Telegram lúc 22h.
// Tách khỏi route để test được mà không cần gọi Google Sheets.

import type { Summary } from "./tong-ket"

const money = (n: number) => `₫${Number(n || 0).toLocaleString("vi-VN")}`

function esc(s: any) {
  return String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
}

const CA_LABEL: Record<string, string> = {
  ca1: "Ca 1 (9h–13h)",
  ca2: "Ca 2 (13h–17h)",
  ca3: "Ca 3 (17h–21h)",
  ngoai_ca: "Ngoài giờ",
  unknown: "Chưa rõ giờ",
}

export function formatBaoCaoNgay(s: Summary): string {
  const b = s.ban_hang
  const blocks: string[] = []

  const ngayVN = String(s.ngay || "").split("-").reverse().join("/")
  blocks.push(`📊 <b>BÁO CÁO TỔNG HỢP NGÀY ${ngayVN}</b>`)

  // --- Bán hàng ---
  const donOff = b.don_hang.filter((o: any) => /off/i.test(o.loai_don)).length
  const donOnl = b.don_hang.filter((o: any) => /onl/i.test(o.loai_don)).length
  blocks.push(
    [
      `🛒 <b>Bán hàng</b>`,
      `• Số đơn: <b>${b.so_don}</b> (${donOff} off · ${donOnl} online)`,
      `• Số máy/món: ${b.so_may}`,
      `• Doanh thu: <b>${money(b.doanh_thu)}</b>`,
      `• Lãi: <b>${money(b.lai)}</b>`,
    ].join("\n"),
  )

  // --- Theo ca ---
  const caLines = Object.entries(s.theo_ca || {})
    .filter(([k]) => k !== "all")
    .sort(([a], [z]) => (CA_LABEL[a] || a).localeCompare(CA_LABEL[z] || z))
    .map(([k, v]: any) => `• ${CA_LABEL[k] || k}: ${v.soDon} đơn · ${money(v.doanhThu)}`)
  if (caLines.length) blocks.push([`🕐 <b>Theo ca</b>`, ...caLines].join("\n"))

  // --- Tiền ---
  const ptLines = Object.entries(b.theo_phuong_thuc || {})
    .sort((x: any, z: any) => z[1] - x[1])
    .map(([k, v]) => `• ${esc(k)}: <b>${money(v as number)}</b>`)
  const q = s.quy_tien_mat
  const tienLines = [
    `💰 <b>Tiền thu theo phương thức</b>`,
    ...(ptLines.length ? ptLines : ["• (không có giao dịch)"]),
    ``,
    `👛 <b>Quỹ tiền mặt</b>`,
    `• Thu: ${money(q.thu)} · Chi: ${money(q.chi)}`,
    q.so_du_cuoi === null ? `• Số dư: (không có biến động hôm nay)` : `• Số dư cuối: <b>${money(q.so_du_cuoi)}</b>`,
  ]
  blocks.push(tienLines.join("\n"))

  // --- Tồn kho ---
  const t = s.ton_kho
  const khoLines = Object.entries(t.theo_kho || {}).map(([k, v]) => `• ${esc(k)}: ${v} máy`)
  const ttLines = Object.entries(t.theo_trang_thai || {})
    .filter(([k]) => !/^đã bán$/i.test(k.trim()))
    .sort((x: any, z: any) => z[1] - x[1])
    .map(([k, v]) => `• ${esc(k)}: ${v}`)
  blocks.push(
    [
      `📦 <b>Tồn kho</b> (tại thời điểm gửi)`,
      `• Máy còn trong kho: <b>${t.so_may}</b>`,
      `• Vốn tồn: <b>${money(t.von)}</b> · giá bán niêm yết: ${money(t.gia_ban)}`,
      ...khoLines,
      ...(ttLines.length ? [``, `Theo trạng thái:`, ...ttLines] : []),
      // Máy có thật nhưng chưa điền Trạng Thái -> không nằm trong con số tồn
      // ở trên. Phải nói ra, nếu không người đọc tưởng kho chỉ có từng đó máy.
      ...(t.chua_ro_trang_thai
        ? [``, `⚠️ ${t.chua_ro_trang_thai} máy chưa điền Trạng Thái (chưa tính vào tồn ở trên)`]
        : []),
    ].join("\n"),
  )

  // --- Việc còn tồn ---
  const c = s.can_xu_ly
  const quaHan = c.coc_chua_tat_toan.filter((x: any) => x.qua_han).length
  const tonLines = [
    `⏳ <b>Còn phải xử lý</b>`,
    `• Đơn online chưa gửi: <b>${c.don_online_chua_gui.length}</b>`,
    `• Đơn cọc chưa tất toán: <b>${c.coc_chua_tat_toan.length}</b>${quaHan ? ` (⚠️ ${quaHan} quá hạn)` : ""}`,
    `• Hoàn trả chờ xử lý: <b>${c.hoan_tra_cho_xu_ly.length}</b>`,
    `• Ghi chú chưa xong: <b>${c.ghi_chu_chua_xong.length}</b>`,
  ]
  // Liệt kê cụ thể đơn online chưa gửi — đây là việc dễ quên nhất qua đêm.
  for (const o of c.don_online_chua_gui.slice(0, 5)) {
    tonLines.push(`   ↳ ${esc(o.ma)} · ${esc(o.khach)} · ${esc(o.van_chuyen)}`)
  }
  if (c.don_online_chua_gui.length > 5) {
    tonLines.push(`   ↳ …và ${c.don_online_chua_gui.length - 5} đơn nữa`)
  }
  blocks.push(tonLines.join("\n"))

  // Đơn chưa xếp được ca -> nói rõ, đừng để người đọc tự thắc mắc vì sao
  // tổng theo ca không bằng tổng ngày.
  if (s.canh_bao?.don_chua_ghi_gio) {
    blocks.push(`ℹ️ ${s.canh_bao.don_chua_ghi_gio} đơn chưa lưu giờ nên không xếp được vào ca (vẫn tính vào tổng ngày).`)
  }

  return blocks.join("\n\n")
}
