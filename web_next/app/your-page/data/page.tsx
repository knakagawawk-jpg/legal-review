"use client"

import { History } from "lucide-react"
import { useSidebar, SidebarToggle } from "@/components/sidebar"
import { withAuth } from "@/components/auth/with-auth"
import { StudyManagementPage } from "./study-management-page"

/**
 * Your Data ページ（フル版）
 * MEMO / Topics / Target / 目標達成カード / 講評履歴を表示
 */
function DataPage() {
  const { mainContentStyle } = useSidebar()

  return (
    <div
      className="min-h-screen bg-gradient-to-b from-amber-50/80 to-orange-50/30 transition-all duration-300"
      style={mainContentStyle}
    >
      <header className="sticky top-0 z-10 bg-white/95 backdrop-blur-sm border-b border-amber-200/60 shadow-sm">
        <div className="container mx-auto px-4 sm:px-8 lg:px-12 py-3 max-w-7xl">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <SidebarToggle />
              <History className="h-4 w-4 text-amber-600" />
              <h1 className="text-base font-semibold text-amber-900">Your Data</h1>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 sm:px-8 lg:px-12 py-4 max-w-7xl">
        <StudyManagementPage variant="full" />
      </main>
    </div>
  )
}

export default withAuth(DataPage, { requireAuth: true })
