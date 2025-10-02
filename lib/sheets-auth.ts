import { readFromGoogleSheets } from "@/lib/google-sheets"
import { NextRequest } from "next/server"

export async function getUserFromRequest(req: NextRequest) {
  try {
    // Lấy email từ Header (hoặc Authorization Bearer token)
    const authHeader = req.headers.get("x-user-email")
    console.log("Header nhận được:", authHeader)
    if (!authHeader) {
      return { email: null, role: "guest", status: "unauthorized" }
    }

    // Ví dụ: "Bearer user@example.com"
    const email = authHeader.replace("Bearer ", "").trim()
    console.log("Email sau xử lý:", email)

    // Đọc sheet USERS
    const { header, rows } = await readFromGoogleSheets("USERS")
    console.log("Header sheet:", header)

    const idxEmail = header.indexOf("Email")
    const idxRole = header.indexOf("Vai Trò")
    const idxStatus = header.indexOf("Trạng Thái")
    const idxName = header.indexOf("Tên")

    if (idxEmail === -1) {
      throw new Error("Sheet USERS không có cột Email")
    }

    const userRow = rows.find((row) => row[idxEmail]?.toLowerCase() === email.toLowerCase())
    console.log("User row tìm được:", userRow)

    if (!userRow) {
      return { email, role: "guest", status: "not_found" }
    }

    return {
      email,
      name: userRow[idxName] || "",
      role: userRow[idxRole] || "nhan_vien",
      status: userRow[idxStatus] || "active",
    }
  } catch (err) {
    console.error("Auth error:", err)
    return { email: null, role: "guest", status: "error" }
  }
}
