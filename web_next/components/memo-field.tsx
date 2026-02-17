"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"

export interface MemoFieldProps {
  value: string
  onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void
  placeholder?: string
  className?: string
  onBlur?: () => void
  onKeyDown?: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void
  /** Max lines when not focused (1–10). Default 5. */
  maxDisplayLines?: number
  /** Max lines when focused (for scroll). Default 10. */
  maxInputLines?: number
}

/**
 * Shared auto-resizing memo textarea with IME support.
 * Used by data/memo, data/topics, data/page, history, dashboard, subjects.
 */
export function MemoField({
  value,
  onChange,
  placeholder = "",
  className,
  onBlur,
  onKeyDown,
  maxDisplayLines = 5,
  maxInputLines = 10,
}: MemoFieldProps) {
  const [isFocused, setIsFocused] = useState(false)
  const [isComposing, setIsComposing] = useState(false)
  const [localValue, setLocalValue] = useState(value)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const lineHeight = 24
  const maxHeight = lineHeight * maxInputLines

  useEffect(() => {
    if (!isComposing) {
      setLocalValue(value)
    }
  }, [value, isComposing])

  const adjustHeight = useCallback(() => {
    if (!textareaRef.current) return

    const currentValue = isComposing ? localValue : value

    if (isFocused) {
      textareaRef.current.style.height = "auto"
      const scrollHeight = textareaRef.current.scrollHeight
      textareaRef.current.style.height = `${Math.min(scrollHeight, maxHeight)}px`
      textareaRef.current.style.maxHeight = `${maxHeight}px`
    } else {
      textareaRef.current.scrollTop = 0

      if (!currentValue || currentValue.trim() === "") {
        textareaRef.current.style.height = "1.5rem"
        textareaRef.current.style.maxHeight = "1.5rem"
        return
      }

      textareaRef.current.style.height = "1.5rem"
      const scrollHeight = textareaRef.current.scrollHeight

      let displayLines = 1
      if (scrollHeight > lineHeight + 1) {
        displayLines = maxDisplayLines
        for (let i = 2; i <= maxDisplayLines; i++) {
          if (scrollHeight <= lineHeight * i + 1) {
            displayLines = i
            break
          }
        }
      }

      const displayHeight = displayLines * lineHeight
      const capHeight = lineHeight * maxDisplayLines
      textareaRef.current.style.height = `${Math.min(displayHeight, capHeight)}px`
      textareaRef.current.style.maxHeight = `${capHeight}px`
    }
  }, [localValue, value, isFocused, isComposing, maxHeight, lineHeight, maxDisplayLines])

  useEffect(() => {
    adjustHeight()
  }, [adjustHeight])

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value
    setLocalValue(newValue)
    if (!isComposing) {
      onChange(e)
    }
    requestAnimationFrame(() => {
      adjustHeight()
      if (textareaRef.current) {
        const maxPos = Math.min(e.target.selectionStart ?? 0, newValue.length)
        textareaRef.current.setSelectionRange(maxPos, maxPos)
      }
    })
  }

  const handleCompositionEnd = () => {
    setIsComposing(false)
    if (textareaRef.current) {
      const v = textareaRef.current.value
      onChange({ target: { value: v } } as React.ChangeEvent<HTMLTextAreaElement>)
      requestAnimationFrame(adjustHeight)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      textareaRef.current?.blur()
      onBlur?.()
      return
    }
    onKeyDown?.(e)
  }

  const handleBlur = () => {
    setIsFocused(false)
    onBlur?.()
  }

  return (
    <Textarea
      ref={textareaRef}
      value={isComposing ? localValue : value}
      onChange={handleChange}
      onCompositionStart={() => setIsComposing(true)}
      onCompositionEnd={handleCompositionEnd}
      onKeyDown={handleKeyDown}
      onFocus={() => setIsFocused(true)}
      onBlur={handleBlur}
      placeholder={placeholder}
      className={cn(
        "min-h-[1.5rem] text-xs border-0 shadow-none bg-transparent hover:bg-muted/50 focus:bg-muted/50 focus-visible:ring-0 resize-none overflow-y-auto w-full",
        className
      )}
      style={{ lineHeight: `${lineHeight}px` }}
    />
  )
}
