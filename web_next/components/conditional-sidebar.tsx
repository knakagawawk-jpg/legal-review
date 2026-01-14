"use client"

import { usePathname } from "next/navigation"
import { Sidebar } from "./sidebar"

export function ConditionalSidebar() {
  const pathname = usePathname()
  
  // トップページでもサイドバーを表示（開閉状態はSidebarProviderで管理）
  return <Sidebar />
}
