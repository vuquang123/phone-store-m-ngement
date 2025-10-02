import { NextResponse } from "next/server";
import { readFromGoogleSheets, syncToGoogleSheets } from "@/lib/google-sheets";

export async function POST(req: Request) {
  try {
    const { productIds } = await req.json();
    if (!Array.isArray(productIds) || productIds.length === 0) {
      return NextResponse.json({ error: "Thiếu dữ liệu" }, { status: 400 });
    }
    // Đọc sheet Kho_Hang
    const { header, rows } = await readFromGoogleSheets("Kho_Hang");
    const idxIMEI = header.indexOf("IMEI");
    // Lọc các dòng không thuộc sản phẩm cần xóa
    const newRows = rows.filter(row => !productIds.includes(row[idxIMEI]));
    await syncToGoogleSheets("Kho_Hang", newRows);
    return NextResponse.json({ success: true, count: productIds.length });
  } catch (error) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
