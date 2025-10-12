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
    const idxSerial = header.indexOf("Serial");
    const idxId = header.indexOf("ID Máy");
    // Lọc các dòng không thuộc sản phẩm cần xóa (match theo IMEI, Serial hoặc ID Máy)
    const newRows = rows.filter(row => {
      const imei = idxIMEI !== -1 ? String(row[idxIMEI] || "") : "";
      const serial = idxSerial !== -1 ? String(row[idxSerial] || "") : "";
      const idMay = idxId !== -1 ? String(row[idxId] || "") : "";
      const imeiLast5 = imei ? imei.slice(-5) : "";
      const serialLast5 = serial ? serial.slice(-5) : "";
      const match = (v: string) => v && productIds.includes(v);
      const matched = match(imei) || match(serial) || match(idMay) || match(imeiLast5) || match(serialLast5);
      return !matched;
    });
    await syncToGoogleSheets("Kho_Hang", newRows);
    return NextResponse.json({ success: true, count: productIds.length });
  } catch (error) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
