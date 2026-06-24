// fetch có TIMEOUT + tự RETRY (khi treo/5xx/429) — trả về Response để dùng y như fetch thường.
// Lý do: fetch mặc định không timeout; nếu request treo thì await không bao giờ xong
// -> finally setLoading(false) không chạy -> UI loading xoay mãi (phải refresh tay).
export async function fetchWithTimeout(
  input: string,
  init: RequestInit = {},
  opts: { timeoutMs?: number; retries?: number } = {},
): Promise<Response> {
  const { timeoutMs = 12000, retries = 2 } = opts
  const delay = (ms: number) => new Promise((r) => setTimeout(r, ms))
  let lastErr: unknown

  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)
    try {
      const res = await fetch(input, { cache: "no-store", ...init, signal: controller.signal })
      clearTimeout(timer)
      // Retry với lỗi tạm (server/quota) nếu còn lượt
      if (!res.ok && (res.status >= 500 || res.status === 429) && attempt < retries) {
        await delay(Math.min(800 * 2 ** attempt, 4000))
        continue
      }
      return res
    } catch (e) {
      clearTimeout(timer)
      lastErr = e
      if (attempt >= retries) throw e
      await delay(Math.min(800 * 2 ** attempt, 4000))
    }
  }
  throw lastErr
}
