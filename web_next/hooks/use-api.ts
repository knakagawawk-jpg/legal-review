"use client"

import { useCallback } from "react"
import { apiClient, ApiError } from "@/lib/api-client"
import { useAuth } from "@/contexts/auth-context"
import { useRouter } from "next/navigation"

/**
 * API呼び出し用のカスタムフック
 * 認証エラーの自動処理とリダイレクトを含む
 */
export function useApi() {
  const { isAuthenticated, logout } = useAuth()
  const router = useRouter()

  const handleApiError = useCallback(
    (error: ApiError) => {
      // 認証エラーの場合
      if (error.status === 401 || error.status === 403) {
        logout()
        router.push("/")
        return
      }

      // その他のエラーはそのままthrow
      throw error
    },
    [logout, router]
  )

  const get = useCallback(
    async <T>(url: string, options?: RequestInit): Promise<T> => {
      try {
        return await apiClient.get<T>(url, options)
      } catch (error) {
        if (error && typeof error === "object" && "status" in error) {
          handleApiError(error as ApiError)
        }
        throw error
      }
    },
    [handleApiError]
  )

  const post = useCallback(
    async <T>(url: string, data?: any, options?: RequestInit): Promise<T> => {
      try {
        return await apiClient.post<T>(url, data, options)
      } catch (error) {
        if (error && typeof error === "object" && "status" in error) {
          handleApiError(error as ApiError)
        }
        throw error
      }
    },
    [handleApiError]
  )

  const put = useCallback(
    async <T>(url: string, data?: any, options?: RequestInit): Promise<T> => {
      try {
        return await apiClient.put<T>(url, data, options)
      } catch (error) {
        if (error && typeof error === "object" && "status" in error) {
          handleApiError(error as ApiError)
        }
        throw error
      }
    },
    [handleApiError]
  )

  const del = useCallback(
    async <T>(url: string, options?: RequestInit): Promise<T> => {
      try {
        return await apiClient.delete<T>(url, options)
      } catch (error) {
        if (error && typeof error === "object" && "status" in error) {
          handleApiError(error as ApiError)
        }
        throw error
      }
    },
    [handleApiError]
  )

  return {
    get,
    post,
    put,
    delete: del,
    isAuthenticated,
  }
}
