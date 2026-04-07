import { type NextRequest, NextResponse } from "next/server"

import { readFromGoogleSheets } from "@/lib/google-sheets"
import { withCors, isValidApiKey, resolveAllowedOrigin } from "@/lib/public-api"
import { buildPublicAccessories, buildPublicProducts, filterPublicSearch } from "@/lib/public-catalog"

export const dynamic = "force-dynamic"

const SHEET_PRODUCTS = "Kho_Hang"
const SHEET_ACCESSORIES = "Phu_Kien"

export async function OPTIONS(request: NextRequest) {
  const origin = request.headers.get("origin")
  return withCors(new NextResponse(null, { status: 204 }), origin)
}

export async function GET(request: NextRequest) {
  const origin = request.headers.get("origin")
  const allowedOrigin = resolveAllowedOrigin(origin)

  if (origin && !allowedOrigin) {
    return withCors(NextResponse.json({ error: "Origin is not allowed" }, { status: 403 }), origin)
  }

  const apiKey = request.headers.get("x-api-key")
  if (!isValidApiKey(apiKey)) {
    return withCors(NextResponse.json({ error: "Invalid API key" }, { status: 401 }), origin)
  }

  const { searchParams } = new URL(request.url)
  const search = (searchParams.get("search") || searchParams.get("q") || "").trim()
  const limit = Math.max(1, Math.min(100, Number.parseInt(searchParams.get("limit") || "20", 10) || 20))

  try {
    const [productsSheet, accessoriesSheet] = await Promise.all([
      readFromGoogleSheets(SHEET_PRODUCTS),
      readFromGoogleSheets(SHEET_ACCESSORIES),
    ])

    const products = buildPublicProducts(productsSheet.header, productsSheet.rows)
    const accessories = buildPublicAccessories(accessoriesSheet.header, accessoriesSheet.rows)
    const data = filterPublicSearch(products, accessories, search, limit)

    return withCors(
      NextResponse.json(
        {
          data,
          total: data.length,
          search,
          limit,
        },
        { status: 200 },
      ),
      origin,
    )
  } catch (error) {
    console.error("[public/search] GET error:", error)
    return withCors(NextResponse.json({ error: "Internal server error" }, { status: 500 }), origin)
  }
}
