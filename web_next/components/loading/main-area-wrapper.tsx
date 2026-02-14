"use client"

import { useSidebar } from "@/components/sidebar"

/**
 * ローディング等を main 直下で表示するときのラッパー。
 * - 一定幅以上（サイドバーが押し出し）: サイドバー以外の部分の中央に表示
 * - 一定幅以下（サイドバーがオーバーレイ）: 元画面（フルビューポート）の中央に表示
 */
export function MainAreaWrapper({ children }: { children: React.ReactNode }) {
  const { mainContentStyle } = useSidebar()
  const marginLeft = typeof mainContentStyle.marginLeft === "number" ? mainContentStyle.marginLeft : 0
  const style: React.CSSProperties = {
    ...mainContentStyle,
    width: marginLeft > 0 ? `calc(100% - ${marginLeft}px)` : undefined,
  }
  return (
    <div className="min-h-dvh" style={style}>
      {children}
    </div>
  )
}
