/**
 * 認証状態の永続化管理
 * localStorage と sessionStorage の使い分けを実装
 */

const TOKEN_KEY = 'auth_token'
const REMEMBER_ME_KEY = 'auth_remember_me'
const USER_KEY = 'auth_user'

/**
 * ストレージの種類
 */
export type StorageType = 'localStorage' | 'sessionStorage'

/**
 * ストレージ操作のヘルパー関数
 */
class AuthStorage {
  /**
   * トークンを保存
   * @param token 認証トークン
   * @param rememberMe ログインを記憶するかどうか（デフォルト: true）
   */
  setToken(token: string, rememberMe: boolean = true): void {
    if (typeof window === 'undefined') {
      return
    }

    if (rememberMe) {
      // 「ログインを記憶する」がONの場合: localStorageに保存（永続的）
      localStorage.setItem(TOKEN_KEY, token)
      localStorage.setItem(REMEMBER_ME_KEY, 'true')
      // sessionStorageから削除（念のため）
      sessionStorage.removeItem(TOKEN_KEY)
    } else {
      // 「ログインを記憶する」がOFFの場合: sessionStorageに保存（セッションのみ）
      sessionStorage.setItem(TOKEN_KEY, token)
      localStorage.setItem(REMEMBER_ME_KEY, 'false')
      // localStorageから削除（念のため）
      localStorage.removeItem(TOKEN_KEY)
    }
  }

  /**
   * トークンを取得
   * 優先順位: sessionStorage > localStorage
   */
  getToken(): string | null {
    if (typeof window === 'undefined') {
      return null
    }

    // sessionStorageを優先（セキュリティ上、より安全）
    const sessionToken = sessionStorage.getItem(TOKEN_KEY)
    if (sessionToken) {
      return sessionToken
    }

    // sessionStorageにない場合はlocalStorageから取得
    return localStorage.getItem(TOKEN_KEY)
  }

  /**
   * トークンを削除（両方のストレージから）
   */
  removeToken(): void {
    if (typeof window === 'undefined') {
      return
    }

    localStorage.removeItem(TOKEN_KEY)
    sessionStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(REMEMBER_ME_KEY)
  }

  /**
   * 「ログインを記憶する」設定を取得
   */
  getRememberMe(): boolean {
    if (typeof window === 'undefined') {
      return true // デフォルトはtrue
    }

    const rememberMe = localStorage.getItem(REMEMBER_ME_KEY)
    return rememberMe !== 'false' // 'false'以外はtrueとみなす（デフォルト動作）
  }

  /**
   * ユーザー情報を保存（キャッシュ用、オプション）
   * 注意: 機密情報は保存しない
   */
  setUser(user: { user_id: number; email: string; name: string; is_active: boolean }): void {
    if (typeof window === 'undefined') {
      return
    }

    const rememberMe = this.getRememberMe()
    const storage = rememberMe ? localStorage : sessionStorage

    try {
      storage.setItem(USER_KEY, JSON.stringify(user))
    } catch (error) {
      console.warn('Failed to save user info to storage:', error)
    }
  }

  /**
   * ユーザー情報を取得（キャッシュから）
   */
  getUser(): { user_id: number; email: string; name: string; is_active: boolean } | null {
    if (typeof window === 'undefined') {
      return null
    }

    // sessionStorageを優先
    const sessionUser = sessionStorage.getItem(USER_KEY)
    if (sessionUser) {
      try {
        return JSON.parse(sessionUser)
      } catch {
        return null
      }
    }

    // localStorageから取得
    const localUser = localStorage.getItem(USER_KEY)
    if (localUser) {
      try {
        return JSON.parse(localUser)
      } catch {
        return null
      }
    }

    return null
  }

  /**
   * ユーザー情報を削除
   */
  removeUser(): void {
    if (typeof window === 'undefined') {
      return
    }

    localStorage.removeItem(USER_KEY)
    sessionStorage.removeItem(USER_KEY)
  }

  /**
   * すべての認証情報をクリア
   */
  clear(): void {
    this.removeToken()
    this.removeUser()
  }

  /**
   * 現在使用しているストレージの種類を取得
   */
  getStorageType(): StorageType | null {
    if (typeof window === 'undefined') {
      return null
    }

    if (sessionStorage.getItem(TOKEN_KEY)) {
      return 'sessionStorage'
    }

    if (localStorage.getItem(TOKEN_KEY)) {
      return 'localStorage'
    }

    return null
  }
}

export const authStorage = new AuthStorage()
