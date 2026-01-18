import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "./globals.css"
import { SidebarProvider } from "@/components/sidebar"
import { AuthProvider } from "@/contexts/auth-context"
import { ConditionalSidebar } from "@/components/conditional-sidebar"

const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "Juristutor-AI",
  description: "答案のAI講評、勉強管理含めた次世代の勉強用プラットフォーム",
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
        <AuthProvider>
          <SidebarProvider>
            <ConditionalSidebar />
            <main className="h-screen">{children}</main>
          </SidebarProvider>
        </AuthProvider>
      </body>
    </html>
  )
}
