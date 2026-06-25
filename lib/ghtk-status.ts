// lib/ghtk-status.ts
// Map mã trạng thái đơn GHTK -> nhãn tiếng Việt + nhóm màu badge. Dùng được cả server lẫn client.

export type GhtkStatusGroup =
  | "pending"
  | "picking"
  | "in_transit"
  | "delivered"
  | "reconciled"
  | "returning"
  | "returned"
  | "failed"
  | "canceled"
  | "other"

interface StatusInfo {
  label: string
  group: GhtkStatusGroup
}

// Bảng mã chính thức (mã shipper 123/127/128/45/49/410 chỉ là thông báo -> không map).
export const STATUS: Record<string, StatusInfo> = {
  "-1": { label: "Hủy đơn", group: "canceled" },
  "1": { label: "Chưa tiếp nhận", group: "pending" },
  "2": { label: "Đã tiếp nhận", group: "picking" },
  "3": { label: "Đã lấy hàng/nhập kho", group: "in_transit" },
  "4": { label: "Đang giao hàng", group: "in_transit" },
  "5": { label: "Đã giao (chưa đối soát)", group: "delivered" },
  "6": { label: "Đã đối soát", group: "reconciled" },
  "7": { label: "Không lấy được hàng", group: "failed" },
  "8": { label: "Hoãn lấy hàng", group: "failed" },
  "9": { label: "Không giao được hàng", group: "failed" },
  "10": { label: "Delay giao hàng", group: "in_transit" },
  "11": { label: "Đã đối soát công nợ trả hàng", group: "returned" },
  "12": { label: "Đang lấy hàng", group: "picking" },
  "13": { label: "Đơn bồi hoàn", group: "other" },
  "20": { label: "Đang trả hàng", group: "returning" },
  "21": { label: "Đã trả hàng", group: "returned" },
}

export function mapGhtkStatus(code: string | number): { code: string; label: string; group: GhtkStatusGroup } {
  const c = String(code ?? "").trim()
  const info = STATUS[c]
  if (info) return { code: c, label: info.label, group: info.group }
  return { code: c, label: "Không xác định", group: "other" }
}

// Class Tailwind cho badge theo nhóm (kèm biến thể dark mode).
export const STATUS_GROUP_COLOR: Record<GhtkStatusGroup, string> = {
  pending: "bg-gray-100 text-gray-700 dark:bg-gray-500/15 dark:text-gray-300",
  picking: "bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-400",
  in_transit: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400",
  delivered: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400",
  reconciled: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400",
  returning: "bg-orange-100 text-orange-700 dark:bg-orange-500/15 dark:text-orange-400",
  returned: "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-400",
  failed: "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-400",
  canceled: "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-400",
  other: "bg-gray-100 text-gray-700 dark:bg-gray-500/15 dark:text-gray-300",
}
