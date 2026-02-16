"use client"

import type React from "react"
import { useState, useRef, useEffect, memo, useImperativeHandle, forwardRef } from "react"
import { Square } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import { ChatInputBar } from "@/components/chat/chat-input-bar"

export interface ChatInputHandle {
  /** テキストを挿入する。入力欄にフォーカスがあればカーソル位置に、なければ末尾に挿入 */
  insertText: (text: string) => void
}

interface ChatInputProps {
  onSend: (message: string) => void
  isLoading: boolean
  onStop?: () => void
  /** 講評結果ページなど、パネル幅いっぱいに入力欄を表示する場合にtrue */
  fullWidth?: boolean
  /** 制御用: 指定時は左右など複数欄で同じ入力を同期する */
  value?: string
  onChange?: (value: string) => void
}

export const ChatInput = memo(forwardRef<ChatInputHandle, ChatInputProps>(function ChatInput({ onSend, isLoading, onStop, fullWidth, value: controlledValue, onChange: controlledOnChange }, ref) {
  const [internalInput, setInternalInput] = useState("")
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const isControlled = controlledValue !== undefined && controlledOnChange !== undefined
  const input = isControlled ? controlledValue : internalInput
  const setInput = isControlled ? controlledOnChange : setInternalInput
  const onSendRef = useRef(onSend)
  const onStopRef = useRef(onStop)

  useImperativeHandle(ref, () => ({
    insertText(text: string) {
      const textarea = textareaRef.current
      if (!textarea) return
      const isFocused = document.activeElement === textarea
      const start = isFocused ? textarea.selectionStart : input.length
      const end = isFocused ? textarea.selectionEnd : input.length
      const before = input.slice(0, start)
      const after = input.slice(end)
      const next = before + text + after
      setInput(next)
      // カーソルを挿入直後に移動
      requestAnimationFrame(() => {
        const pos = start + text.length
        textarea.setSelectionRange(pos, pos)
        textarea.focus()
      })
    },
  }), [input, setInput, isControlled])

  // onSendとonStopの参照を最新に保つ
  useEffect(() => {
    onSendRef.current = onSend
    onStopRef.current = onStop
  }, [onSend, onStop])

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto"
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`
    }
  }, [input])

  const handleSubmit = () => {
    if (input.trim() && !isLoading) {
      const toSend = input.trim()
      onSendRef.current(toSend)
      setInput("")
      if (textareaRef.current) {
        textareaRef.current.style.height = "auto"
      }
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  return (
    <ChatInputBar
      helperText={<p className="text-[10px] text-muted-foreground/70">Shift + Enter で改行</p>}
      contentClassName={fullWidth ? "w-full max-w-none" : undefined}
    >
      <div className="relative flex items-end gap-2 rounded-2xl border border-indigo-200/60 bg-white p-2 shadow-sm focus-within:border-indigo-400 focus-within:ring-1 focus-within:ring-indigo-400/20">
        {/* Text Input */}
        <Textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="メッセージを入力..."
          disabled={isLoading}
          className={cn(
            "min-h-[44px] max-h-[200px] flex-1 resize-none border-0 bg-transparent p-2 text-sm",
            "focus-visible:ring-0 focus-visible:ring-offset-0",
            "placeholder:text-muted-foreground",
          )}
          rows={1}
        />

        {/* Stop Button (shown when loading) */}
        {isLoading && onStop && (
          <Button
            onClick={() => onStopRef.current?.()}
            size="icon"
            className="h-9 w-9 shrink-0 rounded-full transition-all bg-red-500 text-white hover:bg-red-600 shadow-lg shadow-red-500/30 hover:shadow-red-500/40"
          >
            <Square className="h-4 w-4 fill-white" />
          </Button>
        )}

        {/* Send Button */}
        {!isLoading && (
          <Button
            onClick={handleSubmit}
            disabled={!input.trim()}
            size="icon"
            className={cn(
              "h-9 w-9 shrink-0 rounded-full transition-all",
              input.trim()
                ? "bg-gradient-to-br from-indigo-500 via-indigo-600 to-sky-500 text-white hover:from-indigo-600 hover:via-indigo-700 hover:to-sky-600 shadow-lg shadow-indigo-500/30 hover:shadow-indigo-500/40"
                : "bg-slate-200 text-slate-400 cursor-not-allowed",
            )}
          >
            <span className="text-lg font-medium leading-none">↑</span>
          </Button>
        )}
      </div>
    </ChatInputBar>
  )
}), (prevProps, nextProps) => {
  if (prevProps.isLoading !== nextProps.isLoading || prevProps.onStop !== nextProps.onStop || prevProps.fullWidth !== nextProps.fullWidth) return false
  if (prevProps.value !== nextProps.value) return false
  return true
})
