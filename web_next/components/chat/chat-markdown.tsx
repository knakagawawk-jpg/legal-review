"use client"

import { cn } from "@/lib/utils"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"

interface ChatMarkdownProps {
  content: string
  className?: string
}

export function ChatMarkdown({ content, className }: ChatMarkdownProps) {
  return (
    <div className={cn("prose prose-sm max-w-none", className)}>
      <ReactMarkdown remarkPlugins={[remarkGfm]}>
        {content}
      </ReactMarkdown>
    </div>
  )
}
