// Phiên OTP của module Dòng tiền, lưu ở localStorage phía client.
// Không chứa OTP đúng/sai — server là nơi duy nhất xác thực (so với DONGTIEN_OTP).
// Phiên tự hết hạn sau OTP_SESSION_TTL_MS; API trả 401 thì phải xóa phiên và nhập lại.

export const OTP_STORAGE_KEY = "dongtien_otp_verified_v1"

const OTP_SESSION_TTL_MS = 12 * 60 * 60 * 1000

type StoredOtpSession = {
  email: string
  otp: string
  verifiedAt: string
}

export function readOtpSession(email?: string): string | null {
  if (typeof window === "undefined" || !email) return null
  try {
    const raw = localStorage.getItem(OTP_STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as StoredOtpSession
    if (parsed.email !== email || !parsed.otp) return null
    const verifiedAt = new Date(parsed.verifiedAt || 0).getTime()
    if (!verifiedAt || Date.now() - verifiedAt > OTP_SESSION_TTL_MS) {
      localStorage.removeItem(OTP_STORAGE_KEY)
      return null
    }
    return parsed.otp
  } catch {
    return null
  }
}

export function saveOtpSession(email: string, otp: string) {
  if (typeof window === "undefined") return
  localStorage.setItem(
    OTP_STORAGE_KEY,
    JSON.stringify({ email, otp, verifiedAt: new Date().toISOString() } satisfies StoredOtpSession),
  )
}

export function clearOtpSession() {
  if (typeof window === "undefined") return
  localStorage.removeItem(OTP_STORAGE_KEY)
}
