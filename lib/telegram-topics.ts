// Topic Telegram dùng chung cho báo cáo ca.
// Check-in, báo cáo cuối ca và yêu cầu duyệt lệch ca đều gửi vào topic "Báo cáo tổng hợp"
// (trước đây check-in gửi vào "Lịch làm off").
//  - TELEGRAM_THREAD_BAO_CAO: id topic (mặc định = TELEGRAM_THREAD_CHECKOUT, rồi 4901)
//  - TELEGRAM_CHAT_CHECKOUT: id group nếu topic nằm ở group khác group "offline" mặc định

const THREAD =
  Number(process.env.TELEGRAM_THREAD_BAO_CAO) || Number(process.env.TELEGRAM_THREAD_CHECKOUT) || 4901
const CHAT = Number(process.env.TELEGRAM_CHAT_BAO_CAO) || Number(process.env.TELEGRAM_CHAT_CHECKOUT) || 0

export const BAO_CAO_TONG_HOP: { message_thread_id: number; chat_id?: number } = CHAT
  ? { message_thread_id: THREAD, chat_id: CHAT }
  : { message_thread_id: THREAD }
