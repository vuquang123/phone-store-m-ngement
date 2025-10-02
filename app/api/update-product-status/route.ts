import { NextResponse } from "next/server";
import { updateProductsStatus } from "@/lib/google-sheets";

export async function POST(req: Request) {
  try {
    const { productIds, newStatus } = await req.json();
    if (!Array.isArray(productIds) || !newStatus) {
      return NextResponse.json({ error: "Thiếu dữ liệu" }, { status: 400 });
    }
    const result = await updateProductsStatus(productIds, newStatus);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
