// Bản sao lib/thu-may.ts của web devpo.vn (form /thu-may). Giữ 2 file giống nhau.
// Web devpo.vn chuyển form về đây vì bot Telegram DEV PỒ nằm ở app quản lý.


export const DUNG_LUONG = ["64GB", "128GB", "256GB", "512GB", "1TB", "2TB"] as const;

export const LOAI_MAY = [
  "Quốc tế",
  "Lock - SIM ghép",
  "Lock - EID 1 sim",
  "Lock - EID 2 sim",
  "Khác",
] as const;

export const HINH_THUC = ["98", "98.5", "99", "New"] as const;

export const KIEU_THU = ["Thu lên đời", "Thu thẳng"] as const;

export type ThuMayPayload = {
  tenMay: string;
  dungLuong: string;
  mau: string;
  pin: string;
  loaiMay: string;
  loaiMayKhac: string;
  hinhThuc: string;
  moTaLoi: string;
  suaChua: "" | "Có" | "Không";
  suaChuaChiTiet: string;
  kieuThu: string;
  daMuaTaiShop: "" | "Có" | "Không";
  giaMua: string;
  tinhTrangLucMua: string;
  sdt: string;
  /** Bẫy bot: ô ẩn, người thật không bao giờ điền. */
  website?: string;
};

export const EMPTY_THU_MAY: ThuMayPayload = {
  tenMay: "",
  dungLuong: "",
  mau: "",
  pin: "",
  loaiMay: "",
  loaiMayKhac: "",
  hinhThuc: "",
  moTaLoi: "",
  suaChua: "",
  suaChuaChiTiet: "",
  kieuThu: "",
  daMuaTaiShop: "",
  giaMua: "",
  tinhTrangLucMua: "",
  sdt: "",
  website: "",
};

const MAX_LEN = 500;

/** Cắt khoảng trắng + giới hạn độ dài từng ô để tin Telegram không phình. */
export function cleanPayload(raw: unknown): ThuMayPayload {
  const src = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const out = { ...EMPTY_THU_MAY };
  for (const key of Object.keys(EMPTY_THU_MAY) as (keyof ThuMayPayload)[]) {
    const v = src[key];
    (out as Record<string, string>)[key] =
      typeof v === "string" ? v.trim().slice(0, MAX_LEN) : "";
  }
  return out;
}

export function validatePayload(p: ThuMayPayload): string | null {
  if (!p.tenMay) return "Vui lòng nhập tên máy.";
  if (!p.dungLuong) return "Vui lòng chọn dung lượng.";
  if (p.sdt && !/^[0-9+ .-]{8,15}$/.test(p.sdt)) {
    return "Số điện thoại chưa đúng định dạng.";
  }
  return null;
}

function esc(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** Ghép tin nhắn HTML theo đúng mẫu "BÁO THU MÁY KHÁCH" của shop. */
export function buildTelegramMessage(p: ThuMayPayload, sentAt = new Date()) {
  const v = (s: string) => (s ? esc(s) : "—");

  const loaiMay =
    p.loaiMay === "Khác" ? `Khác${p.loaiMayKhac ? `: ${p.loaiMayKhac}` : ""}` : p.loaiMay;
  const hinhThuc = [p.hinhThuc, p.moTaLoi].filter(Boolean).join(" – ");
  const suaChua = [p.suaChua, p.suaChua === "Có" ? p.suaChuaChiTiet : ""]
    .filter(Boolean)
    .join(" – ");
  const pin = p.pin ? (/^\d+$/.test(p.pin) ? `${p.pin}%` : p.pin) : "";

  const lines = [
    "📋 <b>BÁO THU MÁY KHÁCH</b>",
    "",
    `• <b>Tên máy:</b> ${v(p.tenMay)}`,
    `• <b>Dung lượng:</b> ${v(p.dungLuong)}`,
    `• <b>Màu:</b> ${v(p.mau)}`,
    `• <b>Pin:</b> ${v(pin)}`,
    `• <b>QT / LOCK:</b> ${v(loaiMay)}`,
    `• <b>Hình thức:</b> ${v(hinhThuc)}`,
    `• <b>Sửa chữa/thay linh kiện:</b> ${v(suaChua)}`,
    `• <b>Thu lên đời / Thu thẳng:</b> ${v(p.kieuThu)}`,
    "",
    "<b>Lịch sử mua tại shop:</b>",
    `• ${v(p.daMuaTaiShop)}`,
  ];
  if (p.daMuaTaiShop === "Có") {
    lines.push(`• Giá mua: ${v(p.giaMua)} – Tình trạng lúc mua: ${v(p.tinhTrangLucMua)}`);
  }
  lines.push(
    "",
    `📞 <b>SĐT khách:</b> ${p.sdt ? `<code>${esc(p.sdt)}</code>` : "Không để lại"}`,
    `🕒 ${sentAt.toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" })}`,
  );
  return lines.join("\n");
}

/** Khoá trong bảng Cài đặt lưu topic "CHECK MÁY KHÁCH" (ghi khi gõ /checkmay trong topic). */
export const KHOA_CHECK_MAY = {
  chatId: "telegram_check_may_chat_id",
  threadId: "telegram_check_may_thread_id",
} as const
