"use client"

import { MessageSquare, MoreHorizontal } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { SidebarToggle } from "@/components/sidebar"

interface ChatHeaderProps {
  title: string
}

export function ChatHeader({ title }: ChatHeaderProps) {
  return (
    <header className="flex items-center justify-between border-b border-indigo-100/50 bg-white/80 backdrop-blur-md px-4 py-3">
      <div className="flex items-center gap-3">
        <SidebarToggle />
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-sky-500">
            <MessageSquare className="h-4 w-4 text-white" />
          </div>
          <div>
            <h1 className="text-sm font-semibold text-foreground">{title}</h1>
          </div>
        </div>
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground">
            <MoreHorizontal className="h-5 w-5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem>タイトルを編集</DropdownMenuItem>
          <DropdownMenuItem>履歴をクリア</DropdownMenuItem>
          <DropdownMenuItem className="text-destructive">チャットを削除</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  )
}
