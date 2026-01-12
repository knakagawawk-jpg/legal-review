/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Docker用のstandalone出力
  output: 'standalone',
  // API Route Handlerのタイムアウト設定
  // 注意: standaloneモードでは、デフォルトでタイムアウト制限はありません
  // 講評生成は長時間かかる処理のため、クライアント側（AbortSignal）でタイムアウトを制御します
  experimental: {
    serverActions: {
      bodySizeLimit: '10mb',
    },
  },
}

module.exports = nextConfig
