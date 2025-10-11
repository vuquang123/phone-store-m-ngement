import { readFromGoogleSheets, appendToGoogleSheets, syncToGoogleSheets, updateRangeValues } from "./google-sheets"

export type NotificationType = "ban_hang" | "kho_hang" | "he_thong" | "canh_bao" | "hoan_tra"
export type NotificationStatus = "chua_doc" | "da_doc"

export interface NotificationItem {
  id: string
  tieu_de: string
  noi_dung: string
  loai: NotificationType
  trang_thai: NotificationStatus
  nguoi_gui_id: string
  nguoi_nhan_id: string
  created_at: string
  updated_at: string
}

const SHEET_NAME = "Thong_Bao"
const HEADER = [
  "ID",
  "Tiêu Đề",
  "Nội Dung",
  "Loại",
  "Trạng Thái",
  "Người Gửi ID",
  "Người Nhận ID",
  "Created At",
  "Updated At",
]

async function ensureHeader() {
  try {
    const { header } = await readFromGoogleSheets(SHEET_NAME)
    if (!header || header.length === 0) {
      await updateRangeValues(`'${SHEET_NAME}'!A1:I1`, [HEADER])
    } else {
      // If some headers missing, we still rewrite header row to be safe
      const lower = header.map((h) => (h || "").trim().toLowerCase())
      const needed = HEADER.some((h) => !lower.includes(h.trim().toLowerCase()))
      if (needed) {
        await updateRangeValues(`'${SHEET_NAME}'!A1:I1`, [HEADER])
      }
    }
  } catch (e) {
    // Try to write header anyway
    try { await updateRangeValues(`'${SHEET_NAME}'!A1:I1`, [HEADER]) } catch {}
  }
}

export async function getNotifications(): Promise<NotificationItem[]> {
  await ensureHeader()
  const { header, rows } = await readFromGoogleSheets(SHEET_NAME)
  const idx = (name: string) => header.findIndex((h) => (h || "").trim().toLowerCase() === name.trim().toLowerCase())
  const iID = idx("id")
  const iTieuDe = idx("tiêu đề")
  const iNoiDung = idx("nội dung")
  const iLoai = idx("loại")
  const iTrangThai = idx("trạng thái")
  const iGui = idx("người gửi id")
  const iNhan = idx("người nhận id")
  const iCreated = idx("created at")
  const iUpdated = idx("updated at")
  const items: NotificationItem[] = rows.map((r) => ({
    id: r[iID] || crypto.randomUUID?.() || String(Date.now()),
    tieu_de: r[iTieuDe] || "",
    noi_dung: r[iNoiDung] || "",
    loai: (r[iLoai] as NotificationType) || "he_thong",
    trang_thai: (r[iTrangThai] as NotificationStatus) || "chua_doc",
    nguoi_gui_id: r[iGui] || "system",
    nguoi_nhan_id: r[iNhan] || "all",
    created_at: r[iCreated] || new Date().toISOString(),
    updated_at: r[iUpdated] || r[iCreated] || new Date().toISOString(),
  }))
  // sort by created_at desc
  items.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
  return items
}

export async function addNotification(data: Partial<NotificationItem>) {
  await ensureHeader()
  const id = data.id || crypto.randomUUID?.() || `${Date.now()}-${Math.floor(Math.random()*1000)}`
  const nowIso = new Date().toISOString()
  const row = [
    id,
    data.tieu_de || "",
    data.noi_dung || "",
    data.loai || "he_thong",
    data.trang_thai || "chua_doc",
    data.nguoi_gui_id || "system",
    data.nguoi_nhan_id || "all",
    data.created_at || nowIso,
    data.updated_at || nowIso,
  ]
  await appendToGoogleSheets(SHEET_NAME, row)
  return { success: true, id }
}

export async function markNotificationAsRead(id: string) {
  await ensureHeader()
  const { header, rows } = await readFromGoogleSheets(SHEET_NAME)
  const idxId = header.findIndex((h) => (h || "").trim().toLowerCase() === "id")
  const idxTrangThai = header.findIndex((h) => (h || "").trim().toLowerCase() === "trạng thái")
  const idxUpdated = header.findIndex((h) => (h || "").trim().toLowerCase() === "updated at")
  if (idxId === -1 || idxTrangThai === -1) return { success: false, error: "Thiếu cột ID/Trạng Thái" }
  const nowIso = new Date().toISOString()
  const newRows = rows.map((r) => {
    if ((r[idxId] || "") === id) {
      r[idxTrangThai] = "da_doc"
      if (idxUpdated !== -1) r[idxUpdated] = nowIso
    }
    return r
  })
  await syncToGoogleSheets(SHEET_NAME, newRows)
  return { success: true }
}
