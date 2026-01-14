import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "./globals.css"
import { Sidebar, SidebarProvider, SidebarToggle } from "@/components/sidebar"
import { AuthProvider } from "@/contexts/auth-context"

const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "答案講評生成システム",
  description: "法律試験の答案をAIで講評します",
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
            <Sidebar />
            <main className="h-screen">{children}</main>
          </SidebarProvider>
        </AuthProvider>
      </body>
    </html>
  )
}
