// lib/ghtk.ts
// Server helper gọi API tra cứu trạng thái đơn GHTK. CHỈ chạy phía server (đọc token từ env).
// TUYỆT ĐỐI không import file này vào client component.

const BASE = process.env.GHTK_API_BASE || "https://services.giaohangtietkiem.vn"

export type GhtkOrder = {
  label_id?: string
  partner_id?: string
  status?: number | string
  status_text?: string
  created?: string
  modified?: string
  message?: string
  pick_date?: string
  deliver_date?: string
  customer_fullname?: string
  customer_tel?: string
  address?: string
  ship_money?: number | string
  pick_money?: number | string // = tiền COD
  weight?: number | string
  [key: string]: any
}

export type GhtkTrackingResult =
  | { success: true; order: GhtkOrder; message?: string }
  | { success: false; message: string; error_code?: string | number; log_id?: string; http_status: number }

export async function getGhtkTracking(trackingOrder: string): Promise<GhtkTrackingResult> {
  const token = process.env.GHTK_API_TOKEN
  if (!token) {
    return {
      success: false,
      http_status: 500,
      message: "Thiếu cấu hình GHTK_API_TOKEN trên server. Hãy thêm vào .env.local rồi khởi động lại.",
    }
  }

  const url = `${BASE}/services/shipment/v2/${encodeURIComponent(trackingOrder)}`
  const headers: Record<string, string> = { Token: token }
  const partnerCode = process.env.GHTK_PARTNER_CODE
  if (partnerCode) headers["X-Client-Source"] = partnerCode

  let res: Response
  try {
    res = await fetch(url, { method: "GET", headers, cache: "no-store" })
  } catch (e: any) {
    return {
      success: false,
      http_status: 502,
      message: "Không kết nối được tới GHTK: " + (e?.message || "network error"),
    }
  }

  // Parse JSON an toàn — 403 có thể trả body rỗng.
  let data: any = null
  try {
    const text = await res.text()
    data = text ? JSON.parse(text) : null
  } catch {
    data = null
  }

  if (!res.ok || !data || data.success === false) {
    const isAuth = res.status === 401 || res.status === 403 || data?.error_code === 20101
    const message =
      data?.message ||
      (isAuth ? "Token GHTK không hợp lệ hoặc không đủ quyền tra cứu" : `Tra cứu GHTK thất bại (HTTP ${res.status})`)
    return {
      success: false,
      http_status: res.status >= 400 ? res.status : 502,
      message,
      error_code: data?.error_code,
      log_id: data?.log_id,
    }
  }

  return { success: true, order: data.order as GhtkOrder, message: data.message }
}
