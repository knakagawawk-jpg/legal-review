/**
 * API呼び出し用のfetch wrapper
 * 認証トークンを自動的に付与し、エラーハンドリングを統一
 */

import { authStorage } from './auth-storage'

export interface ApiError {
  error: string
  status: number
}

class ApiClient {
  private getAuthToken(): string | null {
    if (typeof window === 'undefined') {
      return null
    }
    return authStorage.getToken()
  }

  private async handleResponse<T>(response: Response): Promise<T> {
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ 
        error: 'Unknown error',
        detail: `HTTP ${response.status}: ${response.statusText}`
      }))
      
      const error: ApiError = {
        error: errorData.error || errorData.detail || 'Unknown error',
        status: response.status,
      }

      // 認証エラーの場合はトークンを削除
      // ただし、一時的なネットワークエラーやサーバーエラーの可能性もあるため、
      // クッキーにトークンがある場合は即座にログアウトしない
      if (response.status === 401 || response.status === 403) {
        // クッキーにトークンがあるか確認（サーバー側で確認するため、ここでは推測のみ）
        // 実際のクッキー確認はできないため、ストレージにトークンがある場合は
        // サーバー側のクッキーと同期していない可能性がある
        const hasToken = authStorage.getToken()
        if (hasToken) {
          // ストレージにトークンがある場合、サーバー側のクッキーと同期していない可能性がある
          // この場合は、認証エラーイベントを発火せず、単にエラーを投げる
          // クライアント側のストレージは削除しない（サーバー側のクッキーが有効な可能性がある）
          console.warn("認証エラーが発生しましたが、ストレージにトークンが存在します。サーバー側のクッキーと同期していない可能性があります。")
        } else {
          // ストレージにトークンがない場合、完全にログアウト状態
          authStorage.removeToken()
          authStorage.removeUser()
          // 認証エラーイベントを発火（AuthContextでリスン）
          window.dispatchEvent(new CustomEvent('auth:error', { detail: error }))
        }
      }

      throw error
    }

    return response.json()
  }

  async get<T>(url: string, options?: RequestInit): Promise<T> {
    const token = this.getAuthToken()
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options?.headers as Record<string, string>),
    }

    if (token) {
      headers['Authorization'] = `Bearer ${token}`
    }

    const response = await fetch(url, {
      ...options,
      method: 'GET',
      headers,
      cache: 'no-store',
    })

    return this.handleResponse<T>(response)
  }

  async post<T>(url: string, data?: any, options?: RequestInit): Promise<T> {
    const token = this.getAuthToken()
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options?.headers as Record<string, string>),
    }

    if (token) {
      headers['Authorization'] = `Bearer ${token}`
    }

    const response = await fetch(url, {
      ...options,
      method: 'POST',
      headers,
      body: data ? JSON.stringify(data) : undefined,
      cache: 'no-store',
    })

    return this.handleResponse<T>(response)
  }

  async put<T>(url: string, data?: any, options?: RequestInit): Promise<T> {
    const token = this.getAuthToken()
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options?.headers as Record<string, string>),
    }

    if (token) {
      headers['Authorization'] = `Bearer ${token}`
    }

    const response = await fetch(url, {
      ...options,
      method: 'PUT',
      headers,
      body: data ? JSON.stringify(data) : undefined,
      cache: 'no-store',
    })

    return this.handleResponse<T>(response)
  }

  async delete<T>(url: string, options?: RequestInit): Promise<T> {
    const token = this.getAuthToken()
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options?.headers as Record<string, string>),
    }

    if (token) {
      headers['Authorization'] = `Bearer ${token}`
    }

    const response = await fetch(url, {
      ...options,
      method: 'DELETE',
      headers,
      cache: 'no-store',
    })

    return this.handleResponse<T>(response)
  }
}

export const apiClient = new ApiClient()
