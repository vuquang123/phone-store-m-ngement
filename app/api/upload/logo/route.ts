import { NextResponse } from "next/server"
import { mkdir, writeFile } from "fs/promises"
import path from "path"

// Đảm bảo route chạy ở Node để dùng fs
export const runtime = "nodejs"

// Giới hạn dung lượng (5MB)
const MAX_SIZE = 5 * 1024 * 1024
const ALLOWED_TYPES = new Set(["image/png", "image/jpeg", "image/jpg", "image/webp", "image/svg+xml"])

function getExtFromMime(mime: string): string {
  switch (mime) {
    case "image/png":
      return ".png"
    case "image/jpeg":
    case "image/jpg":
      return ".jpg"
    case "image/webp":
      return ".webp"
    case "image/svg+xml":
      return ".svg"
    default:
      return ""
  }
}

export async function POST(request: Request) {
  try {
    const form = await request.formData()
    const file = (form.get("file") || form.get("logo")) as File | null

    if (!file || typeof file === "string") {
      return NextResponse.json({ success: false, error: "Thiếu file upload (field: file hoặc logo)." }, { status: 400 })
    }

    if (!ALLOWED_TYPES.has(file.type)) {
      return NextResponse.json({ success: false, error: `Định dạng không hỗ trợ: ${file.type}` }, { status: 400 })
    }

    if (file.size > MAX_SIZE) {
      return NextResponse.json({ success: false, error: `Kích thước vượt quá ${Math.round(MAX_SIZE / (1024 * 1024))}MB` }, { status: 400 })
    }

    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)

    // Xác định tên file và thư mục lưu
    const uploadDir = path.join(process.cwd(), "public", "upload", "logo")
    await mkdir(uploadDir, { recursive: true })

    const originalName = (file as any).name as string | undefined
    const extFromName = originalName ? path.extname(originalName) : ""
    const ext = extFromName || getExtFromMime(file.type) || ".png"
    const safeName = `logo_${Date.now()}_${Math.round(Math.random() * 1e6)}${ext}`
    const filePath = path.join(uploadDir, safeName)

    await writeFile(filePath, buffer)

    // File trong /public được serve ở root → KHÔNG dùng tiền tố /public
    const publicUrl = `/upload/logo/${safeName}`
    return NextResponse.json({ success: true, url: publicUrl })
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err?.message || "Upload thất bại" }, { status: 500 })
  }
}
