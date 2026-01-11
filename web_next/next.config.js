/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Docker用のstandalone出力
  output: 'standalone',
  // API Route Handlerのタイムアウトを延長（150秒まで対応）
  experimental: {
    serverActions: {
      bodySizeLimit: '10mb',
    },
  },
}

module.exports = nextConfig
