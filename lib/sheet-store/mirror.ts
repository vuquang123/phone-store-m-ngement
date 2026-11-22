// lib/sheet-store/mirror.ts
// Supabase là dữ liệu chính; Google Sheet là bản sao để xem/báo cáo.
// Mỗi lần ghi Supabase, tab vừa đổi được chép đè sang Google Sheet ở chế độ nền
// (sau khi đã trả kết quả cho người dùng), nên thao tác trên web không chậm đi.
//
// - Gom nhiều lần ghi liên tiếp thành 1 lần chép (đợi 300ms).
// - Chép cả tab từ Supabase (không chép từng ô) => thứ tự ghi không quan trọng,
//   lần chép sau luôn mang dữ liệu mới nhất. Khoá advisory theo tab để 2 instance
//   không chép đè nhau bằng dữ liệu cũ.
// - Lỗi (vd quota Google) được ghi log và thử lại ở lần ghi kế tiếp; bản sao lưu
//   toàn bộ định kỳ (/api/cron/sao-luu-sheet) vẫn là lưới an toàn.
import { after } from "next/server"
import { exportPostgresToSheets } from "./export-to-sheets"
import { withAdvisoryLock } from "./pg"

const pending = new Set<string>()
let chain: Promise<void> = Promise.resolve()

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

async function flush() {
  if (!pending.size) return
  await sleep(300)
  const tabs = Array.from(pending)
  pending.clear()
  for (const tab of tabs) {
    try {
      await withAdvisoryLock(`mirror:${tab.toLowerCase()}`, () => exportPostgresToSheets([tab]))
    } catch (e: any) {
      console.error(`[mirror] chép tab ${tab} sang Google Sheet lỗi:`, e?.message || e)
      pending.add(tab)
    }
  }
}

export function scheduleMirror(sheets: string[]) {
  for (const s of sheets) if (s) pending.add(s)
  const p = (chain = chain.then(flush, flush))
  try {
    // Giữ function serverless sống tới khi chép xong (Next.js 15 `after`).
    after(() => p)
  } catch {
    /* ngoài request: cứ để promise tự chạy */
  }
  return p
}
