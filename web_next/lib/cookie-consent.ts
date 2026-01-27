/**
 * Cookie同意管理ユーティリティ
 * 日本の個人情報保護法に準拠したCookie同意管理
 */

const CONSENT_COOKIE_NAME = 'cookie_consent'
const CONSENT_REQUIRED_KEY = 'cookie_consent_required'
const CONSENT_FUNCTIONAL_KEY = 'cookie_consent_functional'
const CONSENT_PRIVACY_KEY = 'cookie_consent_privacy'
const CONSENT_EXPIRY_DAYS = 365 // 1年

export type ConsentType = 'required' | 'functional' | 'privacy'

export interface ConsentState {
  required: boolean
  functional: boolean
  privacy: boolean
  timestamp: number
}

/**
 * Cookie同意状態を保存
 */
export function saveConsent(required: boolean, functional: boolean, privacy: boolean = false): void {
  if (typeof window === 'undefined') {
    return
  }

  const consentState: ConsentState = {
    required,
    functional,
    privacy,
    timestamp: Date.now(),
  }

  // Cookieに保存（1年間有効）
  const expiryDate = new Date()
  expiryDate.setTime(expiryDate.getTime() + CONSENT_EXPIRY_DAYS * 24 * 60 * 60 * 1000)
  const expires = expiryDate.toUTCString()

  document.cookie = `${CONSENT_COOKIE_NAME}=${JSON.stringify(consentState)}; expires=${expires}; path=/; SameSite=Lax`

  // localStorageにも保存（バックアップ用）
  try {
    localStorage.setItem(CONSENT_REQUIRED_KEY, required ? 'true' : 'false')
    localStorage.setItem(CONSENT_FUNCTIONAL_KEY, functional ? 'true' : 'false')
    localStorage.setItem(CONSENT_PRIVACY_KEY, privacy ? 'true' : 'false')
  } catch (error) {
    console.warn('Failed to save consent to localStorage:', error)
  }
}

/**
 * Cookie同意状態を取得
 */
export function getConsent(): ConsentState | null {
  if (typeof window === 'undefined') {
    return null
  }

  // まずCookieから取得を試みる
  const cookies = document.cookie.split(';')
  for (const cookie of cookies) {
    const [name, value] = cookie.trim().split('=')
    if (name === CONSENT_COOKIE_NAME && value) {
      try {
        const parsed: any = JSON.parse(decodeURIComponent(value))
        // 後方互換性のため、privacyプロパティがない場合はfalseを設定
        const consentState: ConsentState = {
          required: parsed.required ?? true,
          functional: parsed.functional ?? false,
          privacy: parsed.privacy ?? false,
          timestamp: parsed.timestamp ?? Date.now(),
        }
        // 有効期限チェック（1年経過していないか）
        const oneYearAgo = Date.now() - CONSENT_EXPIRY_DAYS * 24 * 60 * 60 * 1000
        if (consentState.timestamp > oneYearAgo) {
          return consentState
        }
      } catch (error) {
        console.warn('Failed to parse consent cookie:', error)
      }
    }
  }

  // Cookieにない場合はlocalStorageから取得（後方互換性）
  try {
    const requiredStr = localStorage.getItem(CONSENT_REQUIRED_KEY)
    const functionalStr = localStorage.getItem(CONSENT_FUNCTIONAL_KEY)
    const privacyStr = localStorage.getItem(CONSENT_PRIVACY_KEY)
    
    if (requiredStr !== null && functionalStr !== null) {
      const consentState: ConsentState = {
        required: requiredStr === 'true',
        functional: functionalStr === 'true',
        privacy: privacyStr === 'true' || false, // 後方互換性のため、ない場合はfalse
        timestamp: Date.now(), // タイムスタンプがない場合は現在時刻を使用
      }
      // localStorageから取得した場合はCookieにも保存
      saveConsent(consentState.required, consentState.functional, consentState.privacy)
      return consentState
    }
  } catch (error) {
    console.warn('Failed to read consent from localStorage:', error)
  }

  return null
}

/**
 * 特定の種類のCookie同意があるかチェック
 */
export function hasConsent(type: ConsentType): boolean {
  const consent = getConsent()
  if (!consent) {
    return false
  }

  if (type === 'required') {
    return consent.required
  } else if (type === 'functional') {
    return consent.functional
  } else if (type === 'privacy') {
    return consent.privacy
  }

  return false
}

/**
 * 必須Cookieの同意があるかチェック
 */
export function hasRequiredConsent(): boolean {
  return hasConsent('required')
}

/**
 * 機能Cookieの同意があるかチェック
 */
export function hasFunctionalConsent(): boolean {
  return hasConsent('functional')
}

/**
 * プライバシーポリシーへの同意があるかチェック
 */
export function hasPrivacyConsent(): boolean {
  return hasConsent('privacy')
}

/**
 * 同意を撤回（すべて削除）
 */
export function revokeConsent(): void {
  if (typeof window === 'undefined') {
    return
  }

  // Cookieを削除
  document.cookie = `${CONSENT_COOKIE_NAME}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`

  // localStorageからも削除
  try {
    localStorage.removeItem(CONSENT_REQUIRED_KEY)
    localStorage.removeItem(CONSENT_FUNCTIONAL_KEY)
    localStorage.removeItem(CONSENT_PRIVACY_KEY)
  } catch (error) {
    console.warn('Failed to remove consent from localStorage:', error)
  }
}

/**
 * 同意が必要かどうか（まだ同意していないか）
 */
export function needsConsent(): boolean {
  return getConsent() === null
}
