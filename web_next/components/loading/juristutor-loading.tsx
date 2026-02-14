"use client"

import { cn } from "@/lib/utils"

export type JuristutorLoadingProps = {
  /** 表示するメッセージ（例: "講評を取得しています" "ページを読み込んでいます"） */
  message?: string
  /** フルスクリーンで中央表示するか（ページ遷移用）。false のときはインラインでコンテンツ幅 */
  fullScreen?: boolean
  /** ロゴのサイズ（fullScreen 時）。default 80 */
  logoSize?: number
  className?: string
}

const DEFAULT_MESSAGE = "読み込み中..."

export function JuristutorLoading({
  message = DEFAULT_MESSAGE,
  fullScreen = true,
  logoSize = 80,
  className,
}: JuristutorLoadingProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-4",
        fullScreen && "min-h-dvh w-full bg-background",
        className
      )}
      role="status"
      aria-live="polite"
      aria-label={message}
    >
      <div
        className="relative flex shrink-0 items-center justify-center"
        style={{ width: logoSize, height: logoSize }}
      >
        <img
          src="/juristutorai-logo-no-star.svg"
          alt=""
          width={logoSize}
          height={logoSize}
          className="animate-pulse opacity-90"
        />
      </div>
      <p className="text-sm font-medium text-muted-foreground">{message}</p>
    </div>
  )
}
