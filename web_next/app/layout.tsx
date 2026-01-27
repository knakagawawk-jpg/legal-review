import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "./globals.css"
import { Providers } from "@/components/providers"

const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "Juristutor-AI",
  description: "答案のAI講評、勉強管理含めた次世代の勉強用プラットフォーム",
  icons: {
    icon: "/icon.png",
  },
  openGraph: {
    title: "Juristutor-AI",
    description: "答案のAI講評、勉強管理含めた次世代の勉強用プラットフォーム",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Juristutor-AI",
    description: "答案のAI講評、勉強管理含めた次世代の勉強用プラットフォーム",
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ja">
      <body className={inter.className}>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
