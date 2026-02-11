"use client"

import type React from "react"
import { useState, useRef, useEffect, memo } from "react"
import { Send, Square } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import { ChatInputBar } from "@/components/chat/chat-input-bar"

interface ChatInputProps {
  onSend: (message: string) => void
  isLoading: boolean
  onStop?: () => void
  /** 講評結果ページなど、パネル幅いっぱいに入力欄を表示する場合にtrue */
  fullWidth?: boolean
}

export const ChatInput = memo(function ChatInput({ onSend, isLoading, onStop, fullWidth }: ChatInputProps) {
  const [input, setInput] = useState("")
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const onSendRef = useRef(onSend)
  const onStopRef = useRef(onStop)

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
      onSendRef.current(input)
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
      <div className="relative flex items-end gap-2 rounded-2xl border border-indigo-200/60 bg-white/90 backdrop-blur-sm p-2 shadow-sm focus-within:border-indigo-400 focus-within:ring-1 focus-within:ring-indigo-400/20">
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
            <Send className="h-4 w-4" />
          </Button>
        )}
      </div>
    </ChatInputBar>
  )
}, (prevProps, nextProps) => {
  // isLoading、onStop、fullWidthの変更のみを再レンダリングのトリガーとする
  return prevProps.isLoading === nextProps.isLoading && prevProps.onStop === nextProps.onStop && prevProps.fullWidth === nextProps.fullWidth
})
