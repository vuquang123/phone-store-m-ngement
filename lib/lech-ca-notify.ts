// Tin Telegram (topic "Báo cáo tổng hợp") + thông báo trong app cho yêu cầu duyệt lệch ca.
import { sendTelegramMessage } from "@/lib/telegram"
import { addNotification } from "@/lib/notifications"
import { BAO_CAO_TONG_HOP } from "@/lib/telegram-topics"
import { formatDiffLine, type ShiftDiff, type YeuCauLechCa } from "@/lib/check-in-shared"

const esc = (s: any) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")

export async function notifyNewRequest(y: YeuCauLechCa, diffs: ShiftDiff[], chiNhanh: string, moc: { ca: string; thoi_gian: string; nhanVien: string }) {
  const text = [
    `⚠️ YÊU CẦU DUYỆT LỆCH KHO - CHECK-IN CA ${esc(y.ca)}${chiNhanh ? ` - ${esc(chiNhanh)}` : ""}`,
    `Nhân viên: ${esc(y.nhanVien)}`,
    `So với báo cáo cuối ca ${esc(moc.ca)} lúc ${esc(moc.thoi_gian)}${moc.nhanVien ? ` (${esc(moc.nhanVien)})` : ""}:`,
    ...diffs.map((d) => `- ${esc(formatDiffLine(d))}`),
    `Ghi chú: ${esc(y.ghiChu)}`,
    `👉 Chủ shop / quản lý duyệt tại web: Avatar → Check-in đầu ca`,
  ].join("\n")
  let telegram = false
  try {
    const r: any = await sendTelegramMessage(text, "offline", BAO_CAO_TONG_HOP)
    telegram = !!r?.success
  } catch {}
  try {
    await addNotification({
      tieu_de: `Yêu cầu duyệt lệch kho check-in ca ${y.ca}${chiNhanh ? ` - ${chiNhanh}` : ""}`,
      noi_dung: `${y.nhanVien}: ${diffs.map(formatDiffLine).join("; ")}. Ghi chú: ${y.ghiChu}`,
      loai: "canh_bao",
      nguoi_gui_id: y.email,
      nguoi_nhan_id: "quan_ly",
    })
  } catch {}
  return telegram
}

export async function notifyDecision(y: YeuCauLechCa, chiNhanh: string) {
  const ok = y.trangThai === "da_duyet"
  const text = [
    `${ok ? "✅ ĐÃ DUYỆT" : "❌ TỪ CHỐI"} LỆCH KHO - CHECK-IN CA ${esc(y.ca)}${chiNhanh ? ` - ${esc(chiNhanh)}` : ""}`,
    `Nhân viên: ${esc(y.nhanVien)}`,
    `Chi tiết: ${esc(y.chiTiet)}`,
    `Người ${ok ? "duyệt" : "từ chối"}: ${esc(y.nguoiDuyet)}`,
    ...(y.ghiChuDuyet ? [`Ghi chú: ${esc(y.ghiChuDuyet)}`] : []),
  ].join("\n")
  let telegram = false
  try {
    const r: any = await sendTelegramMessage(text, "offline", BAO_CAO_TONG_HOP)
    telegram = !!r?.success
  } catch {}
  try {
    await addNotification({
      tieu_de: `${ok ? "Đã duyệt" : "Từ chối"} yêu cầu lệch kho check-in ca ${y.ca}`,
      noi_dung: `${y.nguoiDuyet}${y.ghiChuDuyet ? `: ${y.ghiChuDuyet}` : ""}${ok ? ". Bạn có thể gửi check-in." : ". Vui lòng đếm lại hoặc gửi yêu cầu mới."}`,
      loai: ok ? "he_thong" : "canh_bao",
      nguoi_gui_id: y.nguoiDuyet,
      nguoi_nhan_id: y.email,
    })
  } catch {}
  return telegram
}
