// ---------------------------------------------------------------------------
// Hash & so khớp mật khẩu bằng bcrypt. CHỈ dùng ở route chạy Node runtime
// (vd app/api/login/route.ts có `export const runtime = "nodejs"`).
// KHÔNG import file này vào middleware (Edge runtime).
//
// LAZY MIGRATION: tài khoản cũ trong sheet USERS đang lưu mật khẩu dạng
// plaintext vẫn đăng nhập được; verifyPassword() trả về needsUpgrade=true để
// route login tự hash lại ô mật khẩu đó ngay lần đăng nhập thành công đầu tiên.
// ---------------------------------------------------------------------------

import bcrypt from "bcryptjs"

/** Chuỗi đã ở dạng bcrypt hash? (bắt đầu bằng $2a$ / $2b$ / $2y$) */
export function looksHashed(stored: string): boolean {
  return /^\$2[aby]\$\d{2}\$/.test(stored || "")
}

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 10)
}

/**
 * So khớp mật khẩu người dùng nhập với giá trị lưu trong sheet.
 *  - ok: đúng/sai
 *  - needsUpgrade: true nếu giá trị lưu đang là plaintext (cần hash lại)
 */
export async function verifyPassword(
  plain: string,
  stored: string,
): Promise<{ ok: boolean; needsUpgrade: boolean }> {
  if (!stored) return { ok: false, needsUpgrade: false }

  if (looksHashed(stored)) {
    const ok = await bcrypt.compare(plain, stored)
    return { ok, needsUpgrade: false }
  }

  // Tài khoản cũ: so sánh plaintext để giữ tương thích, đánh dấu cần nâng cấp.
  const ok = stored === plain
  return { ok, needsUpgrade: ok }
}
