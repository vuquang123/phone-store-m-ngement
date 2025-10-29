import { NextResponse } from "next/server"
import { getBaoHanhProducts } from "@/lib/google-sheets"

export async function GET() {
  try {
    const productsRaw = await getBaoHanhProducts()
    // Map 'Màu Sắc' to 'mau_sac' for frontend consistency
    const products = productsRaw.map((p: any) => ({
      ...p,
      mau_sac: p["Màu Sắc"] || ""
    }))
    return NextResponse.json({ success: true, products })
  } catch (error) {
    return NextResponse.json({ success: false, error: typeof error === "object" && error !== null && "message" in error ? (error as any).message : String(error) || "Lỗi lấy danh sách sản phẩm bảo hành" })
  }
}

