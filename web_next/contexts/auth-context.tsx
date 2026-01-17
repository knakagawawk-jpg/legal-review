"use client"

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react"
import { authStorage } from "@/lib/auth-storage"

export interface User {
  user_id: number
  email: string
  name: string
  is_active: boolean
}

interface AuthContextType {
  user: User | null
  token: string | null
  isLoading: boolean
  error: string | null
  login: (token: string, rememberMe?: boolean) => Promise<void>
  logout: () => void
  refreshUser: () => Promise<void>
  clearError: () => void
  isAuthenticated: boolean
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [token, setToken] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchUserInfo = useCallback(async (authToken: string) => {
    try {
      setError(null)
      const response = await fetch("/api/users/me", {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      })

      if (response.ok) {
        const userData = await response.json()
        const userInfo = {
          user_id: userData.id,
          email: userData.email,
          name: userData.name,
          is_active: userData.is_active,
        }
        setUser(userInfo)
        // ユーザー情報をキャッシュに保存
        authStorage.setUser(userInfo)
      } else {
        // トークンが無効な場合は削除
        const errorData = await response.json().catch(() => ({ error: "認証に失敗しました" }))
        setError(errorData.error || "認証に失敗しました")
        authStorage.removeToken()
        authStorage.removeUser()
        setToken(null)
        setUser(null)
      }
    } catch (error: any) {
      console.error("Failed to fetch user info:", error)
      setError(error.message || "ユーザー情報の取得に失敗しました")
      authStorage.removeToken()
      authStorage.removeUser()
      setToken(null)
      setUser(null)
    } finally {
      setIsLoading(false)
    }
  }, [])

  const refreshUser = useCallback(async () => {
    const storedToken = authStorage.getToken()
    if (storedToken) {
      setIsLoading(true)
      await fetchUserInfo(storedToken)
    }
  }, [fetchUserInfo])

  const logout = useCallback(async () => {
    setUser(null)
    setToken(null)
    setError(null)
    authStorage.clear()
    
    // サーバー側のクッキーも削除
    try {
      await fetch("/api/auth/logout", {
        method: "POST",
      })
    } catch (error) {
      console.error("Failed to clear server-side cookie:", error)
      // エラーが発生しても続行（クライアント側のストレージは既にクリア済み）
    }
  }, [])

  const clearError = useCallback(() => {
    setError(null)
  }, [])

  // 認証エラーイベントをリスン
  useEffect(() => {
    const handleAuthError = () => {
      // 認証エラーが発生した場合はログアウト
      logout()
    }

    window.addEventListener('auth:error', handleAuthError)
    return () => {
      window.removeEventListener('auth:error', handleAuthError)
    }
  }, [logout])

  // 初期化時にストレージからトークンを読み込む
  useEffect(() => {
    // まずキャッシュされたユーザー情報を確認（高速化）
    const cachedUser = authStorage.getUser()
    if (cachedUser) {
      setUser(cachedUser)
    }

    const storedToken = authStorage.getToken()
    if (storedToken) {
      setToken(storedToken)
      // トークンからユーザー情報を取得（キャッシュがあっても最新情報を取得）
      fetchUserInfo(storedToken)
    } else {
      setIsLoading(false)
    }
  }, [fetchUserInfo])

  const login = async (idToken: string, rememberMe: boolean = true) => {
    try {
      setError(null)
      setIsLoading(true)
      
      const response = await fetch("/api/auth/google", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ token: idToken }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: "認証に失敗しました" }))
        const errorMessage = errorData.error || "認証に失敗しました"
        setError(errorMessage)
        throw new Error(errorMessage)
      }

      const userData = await response.json()
      
      // バックエンドから返されたJWTトークンを使用（長期有効）
      // 後方互換性のため、access_tokenがない場合はGoogle IDトークンを使用
      const authToken = userData.access_token || idToken
      
      const userInfo = {
        user_id: userData.user_id,
        email: userData.email,
        name: userData.name,
        is_active: userData.is_active,
      }

      setUser(userInfo)
      setToken(authToken)
      setError(null) // 成功時はエラーをクリア
      
      // ストレージに保存（rememberMeに応じて使い分け）
      // JWTトークンは長期有効なので、rememberMeに関係なくlocalStorageに保存することを推奨
      authStorage.setToken(authToken, rememberMe)
      authStorage.setUser(userInfo)
    } catch (error: any) {
      console.error("Login error:", error)
      setError(error.message || "ログインに失敗しました")
      throw error
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isLoading,
        error,
        login,
        logout,
        refreshUser,
        clearError,
        isAuthenticated: !!user && !!token,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider")
  }
  return context
}
