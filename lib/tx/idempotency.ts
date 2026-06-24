// Idempotency lớp in-memory (nhanh) — chống double-submit/retry trong cửa sổ ngắn.
// Dùng globalThis (an toàn HMR dev) giống pattern cache trong lib/google-sheets.ts.
// LƯU Ý: không chia sẻ giữa nhiều instance serverless => chỉ là chốt nhanh.
// Nguồn chân lý thật sự vẫn là "natural key" trên sheet (máy đã bán / đơn đã hoàn trả).

type Status = "in_flight" | "done"
interface Entry {
  ts: number
  status: Status
  result?: any
}

const TTL_MS = 120_000 // 2 phút — đủ phủ double-click + retry mạng
const store: Map<string, Entry> =
  (globalThis as any).__TX_IDEMPOTENCY__ || ((globalThis as any).__TX_IDEMPOTENCY__ = new Map())

function sweep(now: number) {
  for (const [k, v] of store) {
    if (now - v.ts > TTL_MS) store.delete(k)
  }
}

export type BeginResult =
  | { state: "fresh" } // chưa từng thấy => được phép xử lý
  | { state: "in_flight" } // đang xử lý ở request khác => nên trả 409
  | { state: "done"; result: any } // đã xong => replay kết quả cũ

/**
 * Đánh dấu bắt đầu xử lý một key. Trả về trạng thái để caller quyết định:
 *  - fresh: tiếp tục (đã được khóa in_flight)
 *  - in_flight: có request trùng đang chạy
 *  - done: trả lại result cũ (idempotent replay)
 */
export function beginIdempotent(key: string, nowMs: number): BeginResult {
  if (!key) return { state: "fresh" } // không có key => bỏ qua lớp 1, dựa natural key
  sweep(nowMs)
  const existing = store.get(key)
  if (existing) {
    if (existing.status === "done") return { state: "done", result: existing.result }
    return { state: "in_flight" }
  }
  store.set(key, { ts: nowMs, status: "in_flight" })
  return { state: "fresh" }
}

/** Đánh dấu hoàn thành + lưu result để replay. */
export function completeIdempotent(key: string, result: any, nowMs: number) {
  if (!key) return
  store.set(key, { ts: nowMs, status: "done", result })
}

/** Xử lý thất bại => xóa khóa để cho phép thử lại. */
export function failIdempotent(key: string) {
  if (!key) return
  store.delete(key)
}
