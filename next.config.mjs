/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    // ESLint bật lại khi build: 0 error (2026-06). Còn 30 warning (exhaustive-deps, no-img-element)
    // không chặn build — xử lý dần, KHÔNG bật lại ignore toàn cục.
    ignoreDuringBuilds: false,
  },
  typescript: {
    // Type-check bật lại: `npx tsc --noEmit` sạch lỗi (2026-06). Không che giấu lỗi type nữa.
    ignoreBuildErrors: false,
  },
  images: {
    unoptimized: true,
  },
}

export default nextConfig
