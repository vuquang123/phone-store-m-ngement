import { NextResponse, type NextRequest } from "next/server"
import { google } from "googleapis"

export const dynamic = "force-dynamic"

function driveClient() {
  const auth = new google.auth.JWT({
    email: process.env.GOOGLE_CLIENT_EMAIL,
    key: (process.env.GOOGLE_PRIVATE_KEY || "").replace(/\\n/g, "\n"),
    scopes: ["https://www.googleapis.com/auth/drive"],
  })
  return google.drive({ version: "v3", auth })
}

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData()
    const file = form.get("file") as File | null
    const prefix = (form.get("prefix") as string) || "logo"
    if (!file) return NextResponse.json({ error: "No file" }, { status: 400 })

    // read file buffer
    const arrayBuf = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuf)

    const drive = driveClient()
    const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID // thư mục chứa logo
    const fileName = `${prefix}-${Date.now()}-${file.name}`

    // upload
    const createRes = await drive.files.create({
      requestBody: {
        name: fileName,
        parents: folderId ? [folderId] : undefined,
        mimeType: file.type || "application/octet-stream",
      },
      media: {
        mimeType: file.type || "application/octet-stream",
        body: Buffer.from(buffer),
      },
      fields: "id",
    })

    const fileId = createRes.data.id!
    // public read
    await drive.permissions.create({
      fileId,
      requestBody: { role: "reader", type: "anyone" },
    })

    // direct link
    const url = `https://drive.google.com/uc?id=${fileId}`

    return NextResponse.json({ url })
  } catch (err) {
    console.error("Upload logo error:", err)
    return NextResponse.json({ error: "Upload failed" }, { status: 500 })
  }
}
