// ---------------------------------------------------------------------------
// Chi nhánh cửa hàng. Dùng được cả ở Edge (middleware) lẫn trình duyệt: không
// import thư viện Node nào.
//
// - USERS."Chi nhánh": '1' = DEV PỒ, '2' = T1s (để trống = DEV PỒ).
// - Các bảng dữ liệu (Kho_Hang, Ban_Hang, Khach_Hang, ...) có cột "Chi Nhánh"
//   ghi TÊN chi nhánh cho dễ đọc trên Sheet; ô trống được coi là DEV PỒ (dữ liệu
//   cũ trước khi mở chi nhánh 2).
// - Nhân viên chỉ thấy chi nhánh của mình. Chủ shop và quản lý chuyển được giữa
//   các chi nhánh, hoặc chọn "Tất cả" để xem tổng.
// ---------------------------------------------------------------------------
import { isManagerRole } from "./roles"

export type BranchId = "1" | "2"
export type ActiveBranch = BranchId | "all"

export const BRANCHES: { id: BranchId; name: string }[] = [
  { id: "1", name: "DEV PỒ" },
  { id: "2", name: "T1s" },
]
export const DEFAULT_BRANCH: BranchId = "1"

/** Cookie lưu chi nhánh đang xem (chỉ có tác dụng với chủ shop/quản lý). */
export const BRANCH_COOKIE = "ps_branch"
/** Header do middleware tiêm: chi nhánh gốc của tài khoản và chi nhánh đang xem. */
export const HDR_BRANCH = "x-user-branch"
export const HDR_ACTIVE_BRANCH = "x-active-branch"

/** Tên cột chi nhánh trong các bảng dữ liệu. */
export const BRANCH_COLUMN = "Chi Nhánh"

/** Các tab có cột "Chi Nhánh" (dữ liệu được chia theo chi nhánh). */
export const BRANCH_TABS = [
  "Kho_Hang",
  "Ban_Hang",
  "Khach_Hang",
  "Dat_Coc",
  "Hoan_Tra",
  "Tien_mat",
  "Phu_Kien",
  "DongTien_PhaiTra",
  "DongTien_CongNoThu",
  "DongTien_GiaoDich",
  "DongTien_NguonTien",
  "Check_in",
  "Check_out",
  "Yeu_Cau_Lech_Ca",
  "Ghi_chu",
] as const

const fold = (s: unknown) =>
  String(s ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .replace(/\s+/g, "")
    .toLowerCase()

export function isBranchTab(sheet: string) {
  const s = String(sheet || "").trim().toLowerCase()
  return BRANCH_TABS.some((t) => t.toLowerCase() === s)
}

export function isBranchColumn(header: unknown) {
  return fold(header) === "chinhanh"
}

/** '1' | '2' | 'DEV PỒ' | 't1s' | 'Chi nhánh 2' ... -> '1' | '2'; không nhận ra -> "". */
export function normalizeBranch(v: unknown): BranchId | "" {
  const f = fold(v)
  if (!f) return ""
  if (f === "1" || f === "cn1" || f === "chinhanh1" || f === "devpo") return "1"
  if (f === "2" || f === "cn2" || f === "chinhanh2" || f === "t1s") return "2"
  return ""
}

export function branchName(id: unknown): string {
  const b = normalizeBranch(id)
  return BRANCHES.find((x) => x.id === b)?.name ?? ""
}

/** Chi nhánh của một dòng dữ liệu: ô trống/không rõ -> DEV PỒ. */
export function rowBranchId(value: unknown): BranchId {
  return normalizeBranch(value) || DEFAULT_BRANCH
}

/**
 * Chi nhánh đang xem: nhân viên luôn bị khoá vào chi nhánh của mình; chủ shop và
 * quản lý dùng lựa chọn trong cookie (mặc định là chi nhánh gốc).
 */
export function resolveActiveBranch(role: unknown, home: unknown, requested: unknown): ActiveBranch {
  const homeId = normalizeBranch(home) || DEFAULT_BRANCH
  if (!isManagerRole(role)) return homeId
  const r = String(requested ?? "").trim().toLowerCase()
  if (r === "all") return "all"
  return normalizeBranch(r) || homeId
}

export function canSwitchBranch(role: unknown) {
  return isManagerRole(role)
}

/** Dòng có thuộc chi nhánh đang xem không ("all" = mọi dòng). */
export function branchMatches(value: unknown, active: ActiveBranch) {
  return active === "all" || rowBranchId(value) === active
}

export function activeBranchLabel(active: ActiveBranch) {
  return active === "all" ? "Tất cả chi nhánh" : branchName(active)
}

// ---------------------------------------------------------------------------
// Chủ shop / quản lý đang xem "Tất cả chi nhánh" chỉ được XEM. Mọi thao tác ghi ở các
// mục nghiệp vụ dưới đây (xuất đơn, đặt cọc, hoàn trả, nhập hàng, CNC, bảo hành, đối tác,
// phụ kiện, khách hàng, quỹ tiền mặt, ghi chú, check-in/out, gửi Telegram...) phải chọn
// 1 chi nhánh trước, để dữ liệu và tin Telegram vào đúng chi nhánh. Nhân viên không bị
// ảnh hưởng vì luôn bị khoá vào chi nhánh của mình. Middleware áp quy tắc này.
// (Quản trị dữ liệu và Dòng tiền không nằm trong danh sách: sửa trực tiếp từng dòng.)
// ---------------------------------------------------------------------------
export const CHOOSE_BRANCH_MESSAGE =
  "Đang xem tất cả chi nhánh. Chọn DEV PỒ hoặc T1s ở góc trên trước khi thao tác."

const BRANCH_WRITE_API_PREFIXES = [
  "/api/ban-hang",
  "/api/dat-coc",
  "/api/hoan-tra",
  "/api/kho-hang",
  "/api/delete-product-from-kho",
  "/api/update-product-status",
  "/api/phu-kien",
  "/api/khach-hang",
  "/api/tien-mat",
  "/api/ghi-chu",
  "/api/check-in",
  "/api/check-out",
  "/api/hang-doi-tac",
  "/api/doi-tac",
  "/api/telegram",
  "/api/lich-su-trang-thai-may",
]
/** Ngoại lệ: duyệt / từ chối yêu cầu lệch ca được làm cả khi đang xem "Tất cả". */
const BRANCH_WRITE_EXCEPTIONS = [/^\/api\/check-in\/yeu-cau\/[^/]+$/]

/** Request ghi này có cần đang chọn 1 chi nhánh cụ thể không. */
export function writeNeedsSingleBranch(method: string, pathname: string) {
  const m = method.toUpperCase()
  if (m === "GET" || m === "HEAD" || m === "OPTIONS") return false
  if (BRANCH_WRITE_EXCEPTIONS.some((re) => re.test(pathname))) return false
  return BRANCH_WRITE_API_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + "/"))
}
