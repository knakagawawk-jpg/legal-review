"use client"

import { cn } from "@/lib/utils"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"

interface ChatMessageProps {
  role: "user" | "assistant"
  content: string
}

export function ChatMessage({ role, content }: ChatMessageProps) {
  const isUser = role === "user"

  return (
    <div className={cn("flex gap-2", isUser && "justify-end")}>
      <div
        className={cn(
          "max-w-[85%] rounded-2xl px-4 py-2",
          isUser
            ? "bg-primary text-primary-foreground rounded-br-md"
            : "bg-secondary text-secondary-foreground rounded-bl-md",
        )}
      >
        {isUser ? (
          <p className="text-sm leading-relaxed">{content}</p>
        ) : (
          <div className="prose prose-sm max-w-none 
            prose-headings:mt-4 prose-headings:mb-2 
            prose-h1:text-xl prose-h1:font-bold prose-h1:text-foreground prose-h1:mt-4 prose-h1:mb-3
            prose-h2:text-lg prose-h2:font-semibold prose-h2:text-foreground prose-h2:mt-3 prose-h2:mb-2 prose-h2:border-b prose-h2:border-border/50 prose-h2:pb-1.5
            prose-h3:text-base prose-h3:font-semibold prose-h3:text-foreground prose-h3:mt-3 prose-h3:mb-1.5
            prose-p:my-2 prose-p:leading-6 prose-p:text-foreground prose-p:text-sm
            prose-ul:my-2 prose-ul:space-y-0.5 prose-ul:list-disc prose-ul:pl-5
            prose-ol:my-2 prose-ol:space-y-0.5 prose-ol:list-decimal prose-ol:pl-5
            prose-li:my-0.5 prose-li:leading-5 prose-li:text-sm
            prose-strong:font-bold prose-strong:text-foreground
            prose-em:text-foreground prose-em:italic
            prose-code:text-xs prose-code:bg-muted/80 prose-code:text-foreground prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:font-mono prose-code:before:content-[''] prose-code:after:content-['']
            prose-pre:bg-slate-900 prose-pre:text-slate-100 prose-pre:p-3 prose-pre:rounded-lg prose-pre:overflow-x-auto prose-pre:shadow-md prose-pre:my-3 prose-pre:text-xs
            prose-pre code:bg-transparent prose-pre code:text-inherit prose-pre code:p-0 prose-pre code:before:content-[''] prose-pre code:after:content-['']
            prose-blockquote:border-l-3 prose-blockquote:border-muted-foreground/50 prose-blockquote:bg-muted/30 prose-blockquote:pl-3 prose-blockquote:pr-3 prose-blockquote:py-1.5 prose-blockquote:my-3 prose-blockquote:italic prose-blockquote:text-muted-foreground prose-blockquote:text-sm
            prose-table:my-3 prose-table:w-full prose-table:border-collapse prose-table:text-xs
            prose-th:border prose-th:border-border prose-th:bg-muted/50 prose-th:px-3 prose-th:py-1.5 prose-th:text-left prose-th:font-semibold prose-th:text-foreground
            prose-td:border prose-td:border-border prose-td:px-3 prose-td:py-1.5 prose-td:text-muted-foreground
            prose-hr:my-4 prose-hr:border-border
            prose-a:text-primary prose-a:no-underline hover:prose-a:underline
            prose-img:rounded-md prose-img:shadow-sm prose-img:my-3">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {content}
            </ReactMarkdown>
          </div>
        )}
      </div>
    </div>
  )
}
