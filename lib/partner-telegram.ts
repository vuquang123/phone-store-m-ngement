// Tin Telegram cho luồng "Máy gửi đối tác":
//  - Hoàn kho  -> báo topic Kho "Hoàn đơn gửi đối tác" + trả lời tin gốc ở topic Gửi đối tác: "Đã hoàn"
//  - Xuất bán  -> đơn online/offline như thường (do API bán hàng gửi) + trả lời tin gốc: "Đã xuất bán"
// Tin gốc = tin "🤝 Gửi máy cho đối tác"; mã tin lưu trong ghi chú máy ("… | tg 12345]").
import { sendTelegramMessage } from "@/lib/telegram"
import { parsePartnerInfo } from "@/lib/utils/inventory-helpers"

const esc = (s: any) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")

export type PartnerDevice = { name?: string; imei?: string; serial?: string; note?: string }

const deviceLine = (d: PartnerDevice, i: number) => {
  const id = d.imei ? `IMEI: ${d.imei}` : d.serial ? `Serial: ${d.serial}` : ""
  return `${i + 1}. ${esc(d.name || "Máy")}${id ? ` • ${esc(id)}` : ""}`
}

/** Gom máy theo tin gốc (mã tin Telegram) để mỗi tin gốc chỉ nhận 1 câu trả lời. */
function groupByOrigin(devices: PartnerDevice[]) {
  const map = new Map<number, PartnerDevice[]>()
  for (const d of devices) {
    const id = parsePartnerInfo(d.note)?.tgMessageId
    if (!id) continue
    map.set(id, [...(map.get(id) || []), d])
  }
  return map
}

async function replyOrigins(devices: PartnerDevice[], title: string, extra: string[] = []) {
  for (const [messageId, list] of groupByOrigin(devices)) {
    const text = [title, ...list.map(deviceLine), ...extra].join("\n")
    await sendTelegramMessage(text, "offline", { topic: "guiDoiTac", reply_to_message_id: messageId }).catch(() => null)
  }
}

export async function notifyPartnerReturn(devices: PartnerDevice[], employee: string) {
  if (!devices.length) return
  const info = parsePartnerInfo(devices[0].note)
  const partners = new Set(devices.map((d) => {
    const i = parsePartnerInfo(d.note)
    return i ? `${i.name}${i.phone ? ` - ${i.phone}` : ""}` : "Chưa rõ"
  }))
  const text = [
    "↩️ <b>Hoàn đơn gửi đối tác</b>",
    `Đối tác: ${esc([...partners].join(", "))}`,
    ...(info?.date ? [`Ngày gửi: ${esc(info.date)}`] : []),
    `Nhân viên: ${esc(employee || "")}`,
    `Số lượng: ${devices.length} máy về lại kho (Còn hàng)`,
    "Danh sách:",
    ...devices.map(deviceLine),
  ].join("\n")
  await sendTelegramMessage(text, "offline", { topic: "kho" }).catch(() => null)
  await replyOrigins(devices, `✅ <b>Đã hoàn</b> kho ${devices.length > 1 ? `${devices.length} máy` : ""}`.trim(), [
    `Người hoàn: ${esc(employee || "")}`,
  ])
}

export async function notifyPartnerSold(devices: PartnerDevice[], orderCode: string, employee: string) {
  if (!devices.length) return
  await replyOrigins(devices, `🛒 <b>Đã xuất bán</b>${orderCode ? ` - đơn ${esc(orderCode)}` : ""}`, [
    `Người bán: ${esc(employee || "")}`,
  ])
}
