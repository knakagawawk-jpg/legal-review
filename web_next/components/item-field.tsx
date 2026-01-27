"use client"

import { useState, useEffect, useRef } from "react"
import { Input } from "@/components/ui/input"

interface ItemFieldProps {
  value: string
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  placeholder?: string
  className?: string
}

export function ItemField({ value, onChange, placeholder = "項目を入力...", className }: ItemFieldProps) {
  const [isComposing, setIsComposing] = useState(false)
  const [localValue, setLocalValue] = useState(value)
  const inputRef = useRef<HTMLInputElement>(null)

  // 外部からvalueが変更された場合（親のstate更新など）、ローカル値を同期
  useEffect(() => {
    if (!isComposing) {
      setLocalValue(value)
    }
  }, [value, isComposing])

  return (
    <Input
      ref={inputRef}
      value={isComposing ? localValue : value}
      onChange={(e) => {
        const newValue = e.target.value
        const cursorPosition = e.target.selectionStart
        
        setLocalValue(newValue)
        
        // IME入力中は親のonChangeを呼ばない（確定後に呼ぶ）
        if (!isComposing) {
          onChange(e)
        }
        
        // カーソル位置を復元
        requestAnimationFrame(() => {
          if (inputRef.current && cursorPosition !== null) {
            // カーソル位置を復元（値の長さを超えないようにする）
            const maxPosition = Math.min(cursorPosition, newValue.length)
            inputRef.current.setSelectionRange(maxPosition, maxPosition)
          }
        })
      }}
      onCompositionStart={() => {
        setIsComposing(true)
      }}
      onCompositionUpdate={() => {
        // IME入力中は何もしない
      }}
      onCompositionEnd={() => {
        setIsComposing(false)
        // IME確定後に、現在の値を親に通知
        if (inputRef.current) {
          const cursorPosition = inputRef.current.selectionStart
          const syntheticEvent = {
            target: inputRef.current,
            currentTarget: inputRef.current,
            bubbles: true,
            cancelable: true,
          } as React.ChangeEvent<HTMLInputElement>
          onChange(syntheticEvent)
          
          // IME確定後にカーソル位置を復元
          requestAnimationFrame(() => {
            if (inputRef.current && cursorPosition !== null) {
              const maxPosition = Math.min(cursorPosition, inputRef.current.value.length)
              inputRef.current.setSelectionRange(maxPosition, maxPosition)
            }
          })
        }
      }}
      placeholder={placeholder}
      className={`h-7 text-xs border-0 shadow-none bg-transparent hover:bg-muted/50 focus:bg-muted/50 focus-visible:ring-0 ${className || ""}`}
    />
  )
}
