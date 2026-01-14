"use client"

import { createContext, useContext, useState, useEffect, ReactNode } from "react"

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
  login: (token: string) => Promise<void>
  logout: () => void
  isAuthenticated: boolean
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [token, setToken] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const fetchUserInfo = async (authToken: string) => {
    try {
      const response = await fetch("/api/users/me", {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      })

      if (response.ok) {
        const userData = await response.json()
        setUser({
          user_id: userData.id,
          email: userData.email,
          name: userData.name,
          is_active: userData.is_active,
        })
      } else {
        // トークンが無効な場合は削除
        localStorage.removeItem("auth_token")
        setToken(null)
        setUser(null)
      }
    } catch (error) {
      console.error("Failed to fetch user info:", error)
      localStorage.removeItem("auth_token")
      setToken(null)
      setUser(null)
    } finally {
      setIsLoading(false)
    }
  }

  // 初期化時にローカルストレージからトークンを読み込む
  useEffect(() => {
    const storedToken = localStorage.getItem("auth_token")
    if (storedToken) {
      setToken(storedToken)
      // トークンからユーザー情報を取得
      fetchUserInfo(storedToken)
    } else {
      setIsLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const login = async (idToken: string) => {
    try {
      const response = await fetch("/api/auth/google", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ token: idToken }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "認証に失敗しました")
      }

      const userData = await response.json()
      const authToken = idToken // Google IDトークンを認証トークンとして使用

      setUser({
        user_id: userData.user_id,
        email: userData.email,
        name: userData.name,
        is_active: userData.is_active,
      })
      setToken(authToken)
      localStorage.setItem("auth_token", authToken)
    } catch (error) {
      console.error("Login error:", error)
      throw error
    }
  }

  const logout = () => {
    setUser(null)
    setToken(null)
    localStorage.removeItem("auth_token")
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isLoading,
        login,
        logout,
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
