import { type NextRequest, NextResponse } from "next/server"
import { readFromGoogleSheets, updateRangeValues } from "@/lib/google-sheets"

export const dynamic = "force-dynamic"

const SHEET = "USERS"

const norm = (s: string) =>
  String(s || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    // @ts-ignore
    .replace(/\p{Diacritic}/gu, "")

function colIndex(header: string[], ...names: string[]) {
  // khớp chính xác
  for (const n of names) {
    const i = header.indexOf(n)
    if (i !== -1) return i
  }
  // khớp theo normalize
  const hh = header.map((h) => norm(h))
  for (const n of names) {
    const i = hh.indexOf(norm(n))
    if (i !== -1) return i
  }
  return -1
}

function toColumnLetter(n: number) {
  let s = ""
  while (n > 0) {
    const m = (n - 1) % 26
    s = String.fromCharCode(65 + m) + s
    n = Math.floor((n - m) / 26)
  }
  return s
}

function getCols(header: string[]) {
  return {
    id: header.indexOf("ID Nhân Viên"),
    email: header.indexOf("Email"),
    name: header.indexOf("Tên"),
    role: header.indexOf("Vai Trò"),
    status: header.indexOf("Trạng Thái"),
    lastLogin: header.indexOf("Lần Đăng Nhập Cuối"),
    password: header.indexOf("Mật Khẩu"),
    // tùy sheet có hay không:
    phone: colIndex(header, "Số Điện Thoại", "So Dien Thoai", "Phone"),
    updatedAt: colIndex(header, "Ngày Cập Nhật", "Ngay Cap Nhat", "Updated At", "Updated_At"),
  }
}

/* =================== PUT: cập nhật thông tin nhân viên =================== */
export async function PUT(request: NextRequest, ctx: { params: { id: string } } | { params: Promise<{ id: string }> }) {
  try {
  // Hỗ trợ cả kiểu params đồng bộ và Promise<{id:string}> (Next.js validator)
    const params = 'params' in ctx && typeof (ctx as any).params?.then === 'function'
      ? await (ctx as any).params
      : (ctx as any).params
    const body = await request.json()
    console.log("Nhan vien PUT payload:", body)
    const ho_ten: string | undefined = body?.ho_ten
    const so_dien_thoai: string | undefined = body?.so_dien_thoai
    const anh_dai_dien: string | undefined = body?.anh_dai_dien
    let status: string | undefined = body?.status
    // Chuẩn hóa giá trị status về đúng format sheet
    if (typeof status === "string") {
      const s = norm(status)
      if (s === "hoatdong" || s === "hoat_dong" || s === "hoạtđộng" || s === "hoạt động") status = "hoat_dong"
      else if (s === "ngunghoatdong" || s === "ngung_hoat_dong" || s === "ngưnghoạtđộng" || s === "ngưng hoạt động") status = "ngung_hoat_dong"
    }

  const { header, rows } = await readFromGoogleSheets(SHEET)
    const C = getCols(header)

    if (C.id === -1 || C.name === -1) {
      return NextResponse.json({ error: "USERS thiếu các cột bắt buộc" }, { status: 500 })
    }

  const { id } = params;
    const targetIdx = rows.findIndex((r) => String(r[C.id]) === String(id))
    if (targetIdx === -1) {
      return NextResponse.json({ error: "Không tìm thấy nhân viên" }, { status: 404 })
    }

    // Cập nhật từng ô có gửi
    const rowNumber = targetIdx + 2
    const updates: Array<{ range: string; values: any[][] }> = []

    if (typeof ho_ten !== "undefined") {
      const col = toColumnLetter(C.name + 1)
      updates.push({ range: `${SHEET}!${col}${rowNumber}`, values: [[ho_ten]] })
    }
    if (typeof so_dien_thoai !== "undefined" && C.phone !== -1) {
      const col = toColumnLetter(C.phone + 1)
      updates.push({ range: `${SHEET}!${col}${rowNumber}`, values: [[so_dien_thoai]] })
    }
    if (typeof anh_dai_dien !== "undefined") {
      const avatarCol = colIndex(header, "Ảnh Đại Diện", "Anh Dai Dien", "Avatar", "avatar")
      if (avatarCol !== -1) {
        const col = toColumnLetter(avatarCol + 1)
        updates.push({ range: `${SHEET}!${col}${rowNumber}`, values: [[anh_dai_dien]] })
      }
    }
    if (typeof status !== "undefined" && C.status !== -1) {
      const col = toColumnLetter(C.status + 1)
      updates.push({ range: `${SHEET}!${col}${rowNumber}`, values: [[status]] })
    }
    if (C.updatedAt !== -1) {
      const nowVN = new Date().toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" })
      const col = toColumnLetter(C.updatedAt + 1)
      updates.push({ range: `${SHEET}!${col}${rowNumber}`, values: [[nowVN]] })
    }

    for (const u of updates) {
      console.log("Update sheet:", u)
      await updateRangeValues(u.range, u.values)
    }

    const orig = rows[targetIdx]
    const resp = {
      id: orig[C.id],
      ho_ten: typeof ho_ten !== "undefined" ? ho_ten : orig[C.name],
      so_dien_thoai:
        C.phone !== -1
          ? (typeof so_dien_thoai !== "undefined" ? so_dien_thoai : orig[C.phone])
          : undefined,
      anh_dai_dien: typeof anh_dai_dien !== "undefined"
        ? anh_dai_dien
        : (colIndex(header, "Ảnh Đại Diện", "Anh Dai Dien", "Avatar", "avatar") !== -1
            ? orig[colIndex(header, "Ảnh Đại Diện", "Anh Dai Dien", "Avatar", "avatar")]
            : undefined),
    }

    return NextResponse.json(resp)
  } catch (err) {
    console.error("Nhan vien PUT error:", err)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}

/* =================== DELETE: vô hiệu hóa theo chủ trương =================== */
export async function DELETE(_request: NextRequest, _ctx: { params: { id: string } } | { params: Promise<{ id: string }> }) {
  // Theo chủ trương: quản lý tạo/xóa trực tiếp trong Google Sheets; API xóa bị vô hiệu hóa.
  return NextResponse.json(
    { error: "Xóa tài khoản được thực hiện trực tiếp trên Google Sheets. API này đã bị vô hiệu hóa." },
    { status: 405 },
  )
}
