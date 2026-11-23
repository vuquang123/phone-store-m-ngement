// GET/POST /api/tai-chinh/lo-nhap — ô "Lô nhập" ở form nhập hàng (mọi người đăng nhập dùng được).
// Chỉ trả mã lô + tên đầu hàng + ngày nhập, không có tiền. Tạo nhanh lô: chỉ đầu hàng + ngày + ghi chú.
import { NextResponse, type NextRequest } from "next/server"
import { getServerUser } from "@/lib/auth"
import { isOwnerRole } from "@/lib/roles"
import { docBang, BANG } from "@/lib/tai-chinh/bang"
import { loChoNhapHang, taoLo } from "@/lib/tai-chinh/ghi"
import { loiApi, nguCanh } from "@/lib/tai-chinh/api"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(req: NextRequest) {
  const user = getServerUser(req)
  if (!user) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 })
  try {
    const c = nguCanh(req, user)
    const [lo, dh] = await Promise.all([loChoNhapHang(c.active === "all" ? null : c.chiNhanhGhi), docBang(BANG.DAU_HANG)])
    return NextResponse.json({
      lo,
      dauHang: dh.dong.filter((d) => d["ID"] && d["Trạng Thái"] !== "Ngừng").map((d) => ({ id: d["ID"], ten: d["Tên"] })),
      laChuShop: isOwnerRole(user.role),
    })
  } catch (e) {
    return loiApi(e)
  }
}

export async function POST(req: NextRequest) {
  const user = getServerUser(req)
  if (!user) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 })
  try {
    const c = nguCanh(req, user)
    if (c.active === "all") return NextResponse.json({ error: "Chọn chi nhánh trước khi tạo lô" }, { status: 400 })
    const b = await req.json()
    const ma = await taoLo({
      dauHangId: String(b.dauHangId || ""),
      ngayNhap: b.ngayNhap || undefined,
      ghiChu: String(b.ghiChu || ""),
      chiNhanh: c.chiNhanhGhi,
      nguoiTao: c.tenNguoi,
    })
    return NextResponse.json({ ok: true, ma })
  } catch (e) {
    return loiApi(e)
  }
}
