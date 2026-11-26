// lib/client/phien-het-han.ts
// Phiên đăng nhập hết hạn (4 giờ) trong lúc trang vẫn mở — hay gặp trên điện thoại khi để app chạy nền rồi mở lại.
// Trước đây API trả 401, trang nuốt lỗi và hiện danh sách trống. Giờ: chuyển thẳng về trang đăng nhập
// (kèm ?next= để đăng nhập xong quay lại đúng trang). Chỉ chuyển một lần dù nhiều request cùng 401.

export class PhienHetHan extends Error {
  constructor() {
    super("Phiên đăng nhập đã hết hạn")
    this.name = "PhienHetHan"
  }
}

let daChuyen = false

export function veTrangDangNhap() {
  if (typeof window === "undefined" || daChuyen) return
  if (window.location.pathname.startsWith("/auth")) return
  daChuyen = true
  const next = window.location.pathname + window.location.search
  window.location.replace(`/auth/login?next=${encodeURIComponent(next)}&expired=1`)
}

/** Gọi khi một request nhận 401: chuyển về đăng nhập rồi ném lỗi để React Query không retry. */
export function xuLy401(): never {
  veTrangDangNhap()
  throw new PhienHetHan()
}

export const laPhienHetHan = (e: unknown) => e instanceof PhienHetHan || (e as any)?.name === "PhienHetHan"
