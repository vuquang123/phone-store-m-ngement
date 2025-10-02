import { NextResponse } from "next/server"

export async function POST(request: Request) {
  // Xử lý upload logo: demo trả về thành công
  // Thực tế cần xử lý file upload (form-data), lưu file vào public/upload/logo hoặc cloud
  return NextResponse.json({ success: true, url: "/public/placeholder-logo.png" })
}
