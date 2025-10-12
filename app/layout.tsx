import type React from "react"
import type { Metadata, Viewport } from "next"
import { GeistSans } from "geist/font/sans"
import { GeistMono } from "geist/font/mono"
import { Analytics } from "@vercel/analytics/next"
import { Suspense } from "react"
import { Toaster } from "@/components/ui/toaster"
import "./globals.css"

export const metadata: Metadata = {
  title: "Quản lý Cửa hàng iPhone Lock",
  description: "Hệ thống quản lý cửa hàng điện thoại iPhone Lock",
  generator: "v0.app",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [
      { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
    shortcut: "/apple-touch-icon.png",
  },
  appleWebApp: {
    capable: true,
    title: "DEV PÔ",
    statusBarStyle: "black",
  },
}

// Bật viewport chuẩn cho mobile (đúng tỷ lệ và hỗ trợ safe-area trên iOS)
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  viewportFit: "cover",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="vi">
      <body className={`font-sans ${GeistSans.variable} ${GeistMono.variable}`}>
        <Suspense fallback={null}>{children}</Suspense>
        <Analytics />
        {/* Global toast notifications */}
        <Toaster />
      </body>
    </html>
  )
}
