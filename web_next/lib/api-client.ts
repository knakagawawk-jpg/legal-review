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
      if (response.status === 401 || response.status === 403) {
        authStorage.removeToken()
        authStorage.removeUser()
        // 認証エラーイベントを発火（AuthContextでリスン）
        window.dispatchEvent(new CustomEvent('auth:error', { detail: error }))
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
