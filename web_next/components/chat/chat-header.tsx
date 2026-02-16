"use client"

import { useState } from "react"
import { MessageSquare, MoreHorizontal, Pencil, Trash2, RotateCcw, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Input } from "@/components/ui/input"
import { SidebarToggle } from "@/components/sidebar"
import { ChatBar } from "@/components/chat/chat-bar"

interface ChatHeaderProps {
  title: string
  onEditTitle?: (newTitle: string) => void
  onClearHistory?: () => void
  onDeleteChat?: () => void
  /** フリーチャット用: 新規タブボタンのコールバック。指定時は新規タブボタン＋推奨文を表示 */
  onNewTab?: () => void
}

export function ChatHeader({ title, onEditTitle, onClearHistory, onDeleteChat, onNewTab }: ChatHeaderProps) {
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [clearDialogOpen, setClearDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [editedTitle, setEditedTitle] = useState(title)

  const handleEditTitle = () => {
    if (onEditTitle && editedTitle.trim()) {
      onEditTitle(editedTitle.trim())
    }
    setEditDialogOpen(false)
  }

  const handleClearHistory = () => {
    if (onClearHistory) {
      onClearHistory()
    }
    setClearDialogOpen(false)
  }

  const handleDeleteChat = () => {
    if (onDeleteChat) {
      onDeleteChat()
    }
    setDeleteDialogOpen(false)
  }

  return (
    <>
      <ChatBar
        className="border-indigo-100/50 bg-white/80 backdrop-blur-md"
        leading={(
          <>
            <SidebarToggle />
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-sky-500">
                <MessageSquare className="h-4 w-4 text-white" />
              </div>
              <div>
                <h1 className="text-sm font-semibold text-foreground">{title}</h1>
              </div>
            </div>
          </>
        )}
        trailing={(
          <div className="flex items-center gap-1">
            {onNewTab && (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onNewTab}
                  title="新しいチャットを開始"
                  className="h-7 text-muted-foreground hover:text-foreground rounded-full"
                >
                  <Plus className="h-3.5 w-3.5 mr-1.5" />
                  新規タブ
                </Button>
                <span className="text-[10px] text-muted-foreground leading-tight hidden sm:inline">
                  話題が変わる場合には
                  <br />
                  新しいタブで行うことを推奨しています
                </span>
              </>
            )}
            <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground">
                <MoreHorizontal className="h-5 w-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem 
                onClick={() => {
                  setEditedTitle(title)
                  setEditDialogOpen(true)
                }}
                disabled={!onEditTitle}
              >
                <Pencil className="h-4 w-4 mr-2" />
                タイトルを編集
              </DropdownMenuItem>
              <DropdownMenuItem 
                onClick={() => setClearDialogOpen(true)}
                disabled={!onClearHistory}
              >
                <RotateCcw className="h-4 w-4 mr-2" />
                履歴をクリア
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem 
                onClick={() => setDeleteDialogOpen(true)}
                disabled={!onDeleteChat}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                チャットを削除
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          </div>
        )}
      />

      {/* タイトル編集ダイアログ */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>タイトルを編集</DialogTitle>
            <DialogDescription>
              チャットのタイトルを編集できます。
            </DialogDescription>
          </DialogHeader>
          <Input
            value={editedTitle}
            onChange={(e) => setEditedTitle(e.target.value)}
            placeholder="タイトルを入力"
            onKeyDown={(e) => e.key === "Enter" && handleEditTitle()}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              キャンセル
            </Button>
            <Button onClick={handleEditTitle} disabled={!editedTitle.trim()}>
              保存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 履歴クリア確認ダイアログ */}
      <AlertDialog open={clearDialogOpen} onOpenChange={setClearDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>履歴をクリアしますか？</AlertDialogTitle>
            <AlertDialogDescription>
              このチャットの履歴をすべて削除します。この操作は取り消せません。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>キャンセル</AlertDialogCancel>
            <AlertDialogAction onClick={handleClearHistory}>
              クリア
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* チャット削除確認ダイアログ */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>チャットを削除しますか？</AlertDialogTitle>
            <AlertDialogDescription>
              このチャットと履歴がすべて削除されます。この操作は取り消せません。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>キャンセル</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteChat} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              削除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
