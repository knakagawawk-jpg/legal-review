"use client"

import { useEffect, useState } from "react"
import { MainAreaWrapper } from "./main-area-wrapper"
import { JuristutorLoading } from "./juristutor-loading"

const STORAGE_KEY = "juristutor.navigationMessage"
const DEFAULT_MESSAGE = "ページを読み込んでいます"

export function NavigationLoadingScreen() {
  const [message, setMessage] = useState(DEFAULT_MESSAGE)

  useEffect(() => {
    if (typeof window === "undefined") return
    try {
      const stored = sessionStorage.getItem(STORAGE_KEY)
      if (stored) {
        setMessage(stored)
        sessionStorage.removeItem(STORAGE_KEY)
      }
    } catch {
      // ignore
    }
  }, [])

  return (
    <MainAreaWrapper>
      <JuristutorLoading message={message} fullScreen />
    </MainAreaWrapper>
  )
}

/** 次回のページ遷移時のローディングに表示するメッセージを設定する。router.push() の直前に呼ぶ。 */
export function setNavigationLoadingMessage(message: string) {
  try {
    sessionStorage.setItem(STORAGE_KEY, message)
  } catch {
    // ignore
  }
}

export function clearNavigationLoadingMessage() {
  try {
    sessionStorage.removeItem(STORAGE_KEY)
  } catch {
    // ignore
  }
}
