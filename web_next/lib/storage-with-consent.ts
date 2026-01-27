/**
 * 同意チェック付きストレージ操作ユーティリティ
 * localStorage/Cookieの使用前に同意をチェック
 */

import { hasRequiredConsent, hasFunctionalConsent } from "./cookie-consent"

/**
 * ストレージキーの分類
 */
export type StorageKeyType = 'required' | 'functional'

/**
 * ストレージキーとその分類のマッピング
 */
const STORAGE_KEY_TYPES: Record<string, StorageKeyType> = {
  // 必須（認証関連）
  'auth_token': 'required',
  'auth_remember_me': 'required',
  'auth_user': 'required',
  // 機能（UI状態、履歴など）
  'sidebar_is_open': 'functional',
  'review_panel_ratio': 'functional',
  'review_answer_text': 'functional',
  'study-memo-scroll': 'functional',
  'study-topic-scroll': 'functional',
  'recent_subject_pages': 'functional',
  'recent_note_pages': 'functional',
  'last_main_tab': 'functional',
}

/**
 * ストレージキーの分類を取得
 */
function getStorageKeyType(key: string): StorageKeyType {
  return STORAGE_KEY_TYPES[key] || 'functional' // デフォルトは機能
}

/**
 * 同意チェック付きlocalStorage.setItem
 */
export function setLocalStorageItem(key: string, value: string): boolean {
  if (typeof window === 'undefined') {
    return false
  }

  const keyType = getStorageKeyType(key)

  // 必須は常に許可
  if (keyType === 'required') {
    if (!hasRequiredConsent()) {
      console.warn(`[Cookie同意] 必須Cookieの同意がないため、${key} の保存をスキップしました`)
      return false
    }
    try {
      localStorage.setItem(key, value)
      return true
    } catch (error) {
      console.error(`Failed to set localStorage item ${key}:`, error)
      return false
    }
  }

  // 機能は同意が必要
  if (keyType === 'functional') {
    if (!hasFunctionalConsent()) {
      console.warn(`[Cookie同意] 機能Cookieの同意がないため、${key} の保存をスキップしました`)
      return false
    }
    try {
      localStorage.setItem(key, value)
      return true
    } catch (error) {
      console.error(`Failed to set localStorage item ${key}:`, error)
      return false
    }
  }

  return false
}

/**
 * 同意チェック付きlocalStorage.getItem
 */
export function getLocalStorageItem(key: string): string | null {
  if (typeof window === 'undefined') {
    return null
  }

  const keyType = getStorageKeyType(key)

  // 必須は常に許可
  if (keyType === 'required') {
    if (!hasRequiredConsent()) {
      return null
    }
    try {
      return localStorage.getItem(key)
    } catch (error) {
      console.error(`Failed to get localStorage item ${key}:`, error)
      return null
    }
  }

  // 機能は同意が必要
  if (keyType === 'functional') {
    if (!hasFunctionalConsent()) {
      return null
    }
    try {
      return localStorage.getItem(key)
    } catch (error) {
      console.error(`Failed to get localStorage item ${key}:`, error)
      return null
    }
  }

  return null
}

/**
 * 同意チェック付きlocalStorage.removeItem
 */
export function removeLocalStorageItem(key: string): boolean {
  if (typeof window === 'undefined') {
    return false
  }

  // 削除は常に許可（同意に関係なく）
  try {
    localStorage.removeItem(key)
    return true
  } catch (error) {
    console.error(`Failed to remove localStorage item ${key}:`, error)
    return false
  }
}

/**
 * 同意チェック付きCookie設定
 * 注意: Cookieは主にサーバー側で設定されるため、クライアント側での使用は限定的
 */
export function setCookie(name: string, value: string, options?: { expires?: Date; path?: string; sameSite?: string }): boolean {
  if (typeof document === 'undefined') {
    return false
  }

  const keyType = getStorageKeyType(name)

  // 必須は常に許可
  if (keyType === 'required') {
    if (!hasRequiredConsent()) {
      console.warn(`[Cookie同意] 必須Cookieの同意がないため、${name} の設定をスキップしました`)
      return false
    }
  } else {
    // 機能は同意が必要
    if (!hasFunctionalConsent()) {
      console.warn(`[Cookie同意] 機能Cookieの同意がないため、${name} の設定をスキップしました`)
      return false
    }
  }

  let cookieString = `${name}=${encodeURIComponent(value)}`
  
  if (options?.expires) {
    cookieString += `; expires=${options.expires.toUTCString()}`
  }
  
  if (options?.path) {
    cookieString += `; path=${options.path}`
  } else {
    cookieString += `; path=/`
  }
  
  if (options?.sameSite) {
    cookieString += `; SameSite=${options.sameSite}`
  } else {
    cookieString += `; SameSite=Lax`
  }

  document.cookie = cookieString
  return true
}

/**
 * 同意チェック付きCookie取得
 */
export function getCookie(name: string): string | null {
  if (typeof document === 'undefined') {
    return null
  }

  const keyType = getStorageKeyType(name)

  // 必須は常に許可
  if (keyType === 'required') {
    if (!hasRequiredConsent()) {
      return null
    }
  } else {
    // 機能は同意が必要
    if (!hasFunctionalConsent()) {
      return null
    }
  }

  const cookies = document.cookie.split(';')
  for (const cookie of cookies) {
    const [cookieName, cookieValue] = cookie.trim().split('=')
    if (cookieName === name) {
      return decodeURIComponent(cookieValue)
    }
  }

  return null
}
