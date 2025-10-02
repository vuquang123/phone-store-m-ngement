import { NextResponse } from "next/server"
import { getBaoHanhProducts } from "@/lib/google-sheets"

export async function GET() {
  try {
    const data = await getBaoHanhProducts()
    return NextResponse.json({ success: true, data })
  } catch (error) {
    return NextResponse.json({ success: false, error: typeof error === "object" && error !== null && "message" in error ? (error as any).message : String(error) || "Lỗi lấy danh sách sản phẩm bảo hành" })
  }
}

