"use client"

import { SidebarProvider } from "@/components/sidebar"
import { AuthProvider } from "@/contexts/auth-context"
import { ConditionalSidebar } from "@/components/conditional-sidebar"

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <SidebarProvider>
        <ConditionalSidebar />
        <main className="h-screen">{children}</main>
      </SidebarProvider>
    </AuthProvider>
  )
}
