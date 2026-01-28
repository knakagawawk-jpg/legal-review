"use client"

import { useState, useEffect } from "react"
import { usePathname } from "next/navigation"
import { CookieConsentBanner } from "@/components/cookie-consent-banner"
import { needsConsent } from "@/lib/cookie-consent"

export function CookieConsentProvider({ children }: { children: React.ReactNode }) {
  const [showBanner, setShowBanner] = useState(false)
  const [mounted, setMounted] = useState(false)
  const pathname = usePathname()

  useEffect(() => {
    setMounted(true)
    // 初回訪問時（同意がない場合）にバナーを表示
    if (needsConsent()) {
      setShowBanner(true)
    }
  }, [])

  const handleConsent = (required: boolean, functional: boolean) => {
    setShowBanner(false)
  }

  // プライバシーポリシーページではバナーを出さない（リンクで開いたタブでポリシーを読めるようにする）
  const hideBannerOnPrivacyPage = pathname === "/privacy-policy"

  if (!mounted) {
    return <>{children}</>
  }

  return (
    <>
      {showBanner && !hideBannerOnPrivacyPage && (
        <CookieConsentBanner
          onConsent={handleConsent}
          showOnlyRequired={false}
        />
      )}
      {children}
    </>
  )
}
