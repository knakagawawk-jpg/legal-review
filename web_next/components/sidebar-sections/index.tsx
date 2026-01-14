"use client"

import { usePathname } from "next/navigation"
import { FreeChatSection } from "./FreeChatSection"
import { ReviewSection } from "./ReviewSection"
import { ShortAnswerSection } from "./ShortAnswerSection"
import { YourPageSection } from "./YourPageSection"
import { DevSection } from "./DevSection"

export function SidebarContentSection() {
  const pathname = usePathname()

  // パスに基づいて適切なセクションを表示
  if (pathname === "/free-chat" || pathname?.startsWith("/free-chat/")) {
    return <FreeChatSection />
  }

  if (pathname === "/review" || pathname?.startsWith("/review/")) {
    return <ReviewSection />
  }

  if (pathname === "/short-answer" || pathname?.startsWith("/short-answer/")) {
    return <ShortAnswerSection />
  }

  if (pathname === "/your-page" || pathname?.startsWith("/your-page/")) {
    return <YourPageSection />
  }

  if (pathname === "/dev" || pathname?.startsWith("/dev/")) {
    return <DevSection />
  }

  // その他の機能はデフォルトで何も表示しない
  return null
}
