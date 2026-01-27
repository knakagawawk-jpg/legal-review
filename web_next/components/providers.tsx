"use client"

import { SidebarProvider } from "@/components/sidebar"
import { AuthProvider } from "@/contexts/auth-context"
import { ConditionalSidebar } from "@/components/conditional-sidebar"
import { CookieConsentProvider } from "@/components/cookie-consent-provider"

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <CookieConsentProvider>
        <SidebarProvider>
          <ConditionalSidebar />
          <main className="h-screen">{children}</main>
        </SidebarProvider>
      </CookieConsentProvider>
    </AuthProvider>
  )
}
