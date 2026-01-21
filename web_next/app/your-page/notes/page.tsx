"use client"

import { useState, useEffect, useRef } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { SidebarToggle } from "@/components/sidebar"
import { useSidebar } from "@/components/sidebar"
import { cn } from "@/lib/utils"
import { Plus, FileText, Folder, ChevronRight, ChevronDown, MoreVertical, Edit, Trash2 } from "lucide-react"
import type { Notebook, NoteSection, NotePage, NotebookDetail } from "@/types/api"
import { withAuth } from "@/components/auth/with-auth"
import { apiClient } from "@/lib/api-client"
import { SUBJECT_MAP } from "@/lib/subjects"
import { RichTextEditor } from "@/components/editor/rich-text-editor"

type NotebookWithDetails = Notebook & {
  sections?: Array<NoteSection & { pages?: NotePage[] }>
}

function NotesPage() {
  const { isOpen } = useSidebar()
  const [notebooks, setNotebooks] = useState<NotebookWithDetails[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedNotebooks, setExpandedNotebooks] = useState<Set<number>>(new Set())
  const [expandedSections, setExpandedSections] = useState<Set<number>>(new Set())
  const createButtonRef = useRef<HTMLButtonElement>(null)
  
  // ダイアログ状態
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [editNotebookDialogOpen, setEditNotebookDialogOpen] = useState(false)
  const [createSectionDialogOpen, setCreateSectionDialogOpen] = useState(false)
  const [editSectionDialogOpen, setEditSectionDialogOpen] = useState(false)
  const [createPageDialogOpen, setCreatePageDialogOpen] = useState(false)
  const [editPageDialogOpen, setEditPageDialogOpen] = useState(false)
  
  // 操作中フラグ
  const [creating, setCreating] = useState(false)
  const [editingNotebook, setEditingNotebook] = useState(false)
  const [creatingSection, setCreatingSection] = useState(false)
  const [editingSection, setEditingSection] = useState(false)
  const [creatingPage, setCreatingPage] = useState(false)
  const [editingPage, setEditingPage] = useState(false)
  
  // フォーム状態
  const [newNotebook, setNewNotebook] = useState({
    subject_id: 1,
    title: "",
    description: "",
  })
  const [editingNotebookData, setEditingNotebookData] = useState<Notebook | null>(null)
  const [newSection, setNewSection] = useState({
    notebook_id: 0,
    title: "",
  })
  const [editingSectionData, setEditingSectionData] = useState<NoteSection | null>(null)
  const [newPage, setNewPage] = useState({
    section_id: 0,
    title: "",
    content: "",
  })
  const [editingPageData, setEditingPageData] = useState<NotePage | null>(null)

  useEffect(() => {
    console.log("NotesPage component mounted")
    // ノートブック一覧を取得
    const fetchNotebooks = async () => {
      try {
        const data = await apiClient.get<Notebook[]>("/api/notebooks")
        // 各ノートブックの詳細を取得
        const notebooksWithDetails = await Promise.all(
          data.map(async (notebook) => {
            try {
              const detail = await apiClient.get<NotebookDetail>(`/api/notebooks/${notebook.id}`)
              return { ...notebook, sections: detail.sections }
            } catch (err) {
              console.error(`Failed to fetch notebook ${notebook.id} details:`, err)
              return { ...notebook, sections: [] }
            }
          })
        )
        setNotebooks(notebooksWithDetails)
      } catch (err) {
        console.error("Failed to fetch notebooks:", err)
      } finally {
        setLoading(false)
      }
    }
    fetchNotebooks()
  }, [])

  // デバッグ用: createDialogOpenの状態変化を監視
  useEffect(() => {
    console.log("createDialogOpen state changed:", createDialogOpen)
  }, [createDialogOpen])

  // 直接DOMにイベントリスナーを追加（デバッグ用）
  useEffect(() => {
    const button = createButtonRef.current
    console.log("Button ref:", button)
    if (!button) {
      console.log("Button ref is null!")
      // IDでも試す
      const buttonById = document.getElementById('create-notebook-button')
      console.log("Button by ID:", buttonById)
      return
    }

    console.log("Adding event listener to button")
    const handleClick = (e: MouseEvent) => {
      console.log("Direct DOM event listener fired!", e)
      e.preventDefault()
      e.stopPropagation()
      setCreateDialogOpen(true)
    }

    button.addEventListener('click', handleClick, true) // capture phase
    button.addEventListener('mousedown', () => console.log("Direct mousedown"), true)
    button.addEventListener('mouseup', () => console.log("Direct mouseup"), true)

    return () => {
      button.removeEventListener('click', handleClick, true)
    }
  }, [])

  const handleCreateNotebook = async () => {
    if (!newNotebook.title.trim()) {
      alert("タイトルを入力してください")
      return
    }

    setCreating(true)
    try {
      const created = await apiClient.post<Notebook>("/api/notebooks", {
        subject_id: newNotebook.subject_id,
        title: newNotebook.title.trim(),
        description: newNotebook.description.trim() || null,
      })
      
      // ノートブック一覧を更新
      setNotebooks(prev => [created, ...prev])
      
      // フォームをリセット
      setNewNotebook({
        subject_id: 1,
        title: "",
        description: "",
      })
      
      // ダイアログを閉じる
      setCreateDialogOpen(false)
    } catch (err: any) {
      console.error("Failed to create notebook:", err)
      alert(err?.error || "ノートブックの作成に失敗しました")
    } finally {
      setCreating(false)
    }
  }

  const refreshNotebooks = async () => {
    try {
      const data = await apiClient.get<Notebook[]>("/api/notebooks")
      const notebooksWithDetails = await Promise.all(
        data.map(async (notebook) => {
          try {
            const detail = await apiClient.get<NotebookDetail>(`/api/notebooks/${notebook.id}`)
            return { ...notebook, sections: detail.sections }
          } catch (err) {
            console.error(`Failed to fetch notebook ${notebook.id} details:`, err)
            return { ...notebook, sections: [] }
          }
        })
      )
      setNotebooks(notebooksWithDetails)
    } catch (err) {
      console.error("Failed to refresh notebooks:", err)
    }
  }

  const toggleNotebook = (notebookId: number) => {
    const newExpanded = new Set(expandedNotebooks)
    if (newExpanded.has(notebookId)) {
      newExpanded.delete(notebookId)
    } else {
      newExpanded.add(notebookId)
    }
    setExpandedNotebooks(newExpanded)
  }

  const toggleSection = (sectionId: number) => {
    const newExpanded = new Set(expandedSections)
    if (newExpanded.has(sectionId)) {
      newExpanded.delete(sectionId)
    } else {
      newExpanded.add(sectionId)
    }
    setExpandedSections(newExpanded)
  }

  // ノートブック編集
  const handleEditNotebook = (notebook: Notebook) => {
    setEditingNotebookData(notebook)
    setNewNotebook({
      subject_id: notebook.subject_id,
      title: notebook.title,
      description: notebook.description || "",
    })
    setEditNotebookDialogOpen(true)
  }

  const handleUpdateNotebook = async () => {
    if (!editingNotebookData || !newNotebook.title.trim()) {
      alert("タイトルを入力してください")
      return
    }

    setEditingNotebook(true)
    try {
      await apiClient.put(`/api/notebooks/${editingNotebookData.id}`, {
        subject_id: newNotebook.subject_id,
        title: newNotebook.title.trim(),
        description: newNotebook.description.trim() || null,
      })
      await refreshNotebooks()
      setEditNotebookDialogOpen(false)
      setEditingNotebookData(null)
    } catch (err: any) {
      console.error("Failed to update notebook:", err)
      alert(err?.error || "ノートブックの更新に失敗しました")
    } finally {
      setEditingNotebook(false)
    }
  }

  // ノートブック削除
  const handleDeleteNotebook = async (notebookId: number) => {
    if (!confirm("このノートブックを削除しますか？")) return

    try {
      await apiClient.delete(`/api/notebooks/${notebookId}`)
      await refreshNotebooks()
    } catch (err: any) {
      console.error("Failed to delete notebook:", err)
      alert(err?.error || "ノートブックの削除に失敗しました")
    }
  }

  // セクション作成
  const handleCreateSection = (notebookId: number) => {
    setNewSection({ notebook_id: notebookId, title: "" })
    setCreateSectionDialogOpen(true)
  }

  const handleSubmitCreateSection = async () => {
    if (!newSection.title.trim()) {
      alert("セクション名を入力してください")
      return
    }

    setCreatingSection(true)
    try {
      await apiClient.post("/api/note-sections", {
        notebook_id: newSection.notebook_id,
        title: newSection.title.trim(),
        display_order: 0,
      })
      await refreshNotebooks()
      setCreateSectionDialogOpen(false)
      setNewSection({ notebook_id: 0, title: "" })
    } catch (err: any) {
      console.error("Failed to create section:", err)
      alert(err?.error || "セクションの作成に失敗しました")
    } finally {
      setCreatingSection(false)
    }
  }

  // セクション編集
  const handleEditSection = (section: NoteSection) => {
    setEditingSectionData(section)
    setNewSection({ notebook_id: section.notebook_id, title: section.title })
    setEditSectionDialogOpen(true)
  }

  const handleUpdateSection = async () => {
    if (!editingSectionData || !newSection.title.trim()) {
      alert("セクション名を入力してください")
      return
    }

    setEditingSection(true)
    try {
      await apiClient.put(`/api/note-sections/${editingSectionData.id}`, {
        title: newSection.title.trim(),
      })
      await refreshNotebooks()
      setEditSectionDialogOpen(false)
      setEditingSectionData(null)
    } catch (err: any) {
      console.error("Failed to update section:", err)
      alert(err?.error || "セクションの更新に失敗しました")
    } finally {
      setEditingSection(false)
    }
  }

  // セクション削除
  const handleDeleteSection = async (sectionId: number) => {
    if (!confirm("このセクションを削除しますか？セクション内のページもすべて削除されます。")) return

    try {
      await apiClient.delete(`/api/note-sections/${sectionId}`)
      await refreshNotebooks()
    } catch (err: any) {
      console.error("Failed to delete section:", err)
      alert(err?.error || "セクションの削除に失敗しました")
    }
  }

  // ページ作成
  const handleCreatePage = (sectionId: number) => {
    setNewPage({ section_id: sectionId, title: "", content: "" })
    setCreatePageDialogOpen(true)
  }

  const handleSubmitCreatePage = async () => {
    if (!newPage.title?.trim() && !newPage.content?.trim()) {
      alert("タイトルまたは内容を入力してください")
      return
    }

    setCreatingPage(true)
    try {
      await apiClient.post("/api/note-pages", {
        section_id: newPage.section_id,
        title: newPage.title?.trim() || null,
        content: newPage.content?.trim() || null,
        display_order: 0,
      })
      await refreshNotebooks()
      setCreatePageDialogOpen(false)
      setNewPage({ section_id: 0, title: "", content: "" })
    } catch (err: any) {
      console.error("Failed to create page:", err)
      alert(err?.error || "ページの作成に失敗しました")
    } finally {
      setCreatingPage(false)
    }
  }

  // ページ編集
  const handleEditPage = (page: NotePage) => {
    setEditingPageData(page)
    setNewPage({
      section_id: page.section_id,
      title: page.title || "",
      content: page.content || "",
    })
    setEditPageDialogOpen(true)
  }

  const handleUpdatePage = async () => {
    if (!editingPageData) return

    setEditingPage(true)
    try {
      await apiClient.put(`/api/note-pages/${editingPageData.id}`, {
        title: newPage.title?.trim() || null,
        content: newPage.content?.trim() || null,
      })
      await refreshNotebooks()
      setEditPageDialogOpen(false)
      setEditingPageData(null)
    } catch (err: any) {
      console.error("Failed to update page:", err)
      alert(err?.error || "ページの更新に失敗しました")
    } finally {
      setEditingPage(false)
    }
  }

  // ページ削除
  const handleDeletePage = async (pageId: number) => {
    if (!confirm("このページを削除しますか？")) return

    try {
      await apiClient.delete(`/api/note-pages/${pageId}`)
      await refreshNotebooks()
    } catch (err: any) {
      console.error("Failed to delete page:", err)
      alert(err?.error || "ページの削除に失敗しました")
    }
  }

  return (
    <div
      className="min-h-screen bg-gradient-to-b from-background to-muted/20 transition-all duration-300"
      style={{
        marginLeft: isOpen ? '208px' : '0',
      }}
    >
      <div className="container mx-auto px-8 py-12 max-w-6xl">
        {/* ヘッダー */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold mb-2">📓 ノート</h1>
            <p className="text-muted-foreground text-lg">OneNote風のノート管理</p>
          </div>
          <div className="flex items-center gap-4" onClick={(e) => {
            console.log("Parent div clicked", e.target)
          }}>
            <button
              ref={createButtonRef}
              type="button"
              onMouseDown={(e) => {
                console.log("Button onMouseDown fired")
                e.preventDefault()
                e.stopPropagation()
              }}
              onMouseUp={(e) => {
                console.log("Button onMouseUp fired")
                e.preventDefault()
                e.stopPropagation()
              }}
              onClick={(e) => {
                console.log("Button onClick fired")
                e.preventDefault()
                e.stopPropagation()
                setCreateDialogOpen(true)
              }}
              onPointerDown={(e) => {
                console.log("Button onPointerDown fired")
              }}
              className="inline-flex items-center justify-center whitespace-nowrap rounded-lg text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2 cursor-pointer"
              style={{ position: 'relative', zIndex: 10, pointerEvents: 'auto' }}
            >
              <Plus className="h-4 w-4 mr-2" />
              新しいノートブック
            </button>
            <SidebarToggle />
          </div>
        </div>

        {/* ノートブック一覧 */}
        <Card>
          <CardHeader>
            <CardTitle>ノートブック一覧</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8 text-muted-foreground">読み込み中...</div>
            ) : notebooks.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-muted-foreground mb-4">ノートブックがありません</p>
                <button
                  type="button"
                  onMouseDown={(e) => {
                    console.log("Empty state button onMouseDown fired")
                    e.preventDefault()
                    e.stopPropagation()
                  }}
                  onMouseUp={(e) => {
                    console.log("Empty state button onMouseUp fired")
                    e.preventDefault()
                    e.stopPropagation()
                  }}
                  onClick={(e) => {
                    console.log("Empty state button onClick fired")
                    e.preventDefault()
                    e.stopPropagation()
                    setCreateDialogOpen(true)
                  }}
                  onPointerDown={(e) => {
                    console.log("Empty state button onPointerDown fired")
                  }}
                  className="inline-flex items-center justify-center whitespace-nowrap rounded-lg text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2 cursor-pointer"
                  style={{ pointerEvents: 'auto' }}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  最初のノートブックを作成
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                {notebooks.map((notebook) => (
                  <div key={notebook.id} className="border rounded-lg">
                    <button
                      onClick={() => toggleNotebook(notebook.id)}
                      className="w-full flex items-center gap-2 p-4 hover:bg-muted/50 transition-colors text-left"
                    >
                      {expandedNotebooks.has(notebook.id) ? (
                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      )}
                      <Folder className="h-5 w-5 text-primary" />
                      <div className="flex-1">
                        <h3 className="font-semibold">{notebook.title}</h3>
                        {notebook.description && (
                          <p className="text-sm text-muted-foreground">{notebook.description}</p>
                        )}
                        <p className="text-xs text-muted-foreground mt-1">
                          {SUBJECT_MAP[notebook.subject_id]}
                        </p>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleEditNotebook(notebook)}>
                            <Edit className="h-4 w-4 mr-2" />
                            編集
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => handleDeleteNotebook(notebook.id)}
                            className="text-destructive"
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            削除
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </button>
                    {expandedNotebooks.has(notebook.id) && (
                      <div className="pl-8 pr-4 pb-4 space-y-1">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs text-muted-foreground ml-6">セクション</span>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 px-2 text-xs"
                            onClick={() => handleCreateSection(notebook.id)}
                          >
                            <Plus className="h-3 w-3 mr-1" />
                            セクションを追加
                          </Button>
                        </div>
                        {notebook.sections && notebook.sections.length > 0 ? (
                          notebook.sections.map((section) => (
                            <div key={section.id} className="ml-6 border-l-2 border-muted pl-3">
                              <div className="flex items-center gap-2 py-1 group">
                                <button
                                  onClick={() => toggleSection(section.id)}
                                  className="flex-1 flex items-center gap-2 text-left hover:text-primary transition-colors"
                                >
                                  {expandedSections.has(section.id) ? (
                                    <ChevronDown className="h-3 w-3 text-muted-foreground" />
                                  ) : (
                                    <ChevronRight className="h-3 w-3 text-muted-foreground" />
                                  )}
                                  <FileText className="h-4 w-4 text-muted-foreground" />
                                  <span className="text-sm font-medium">{section.title}</span>
                                </button>
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                                    >
                                      <MoreVertical className="h-3 w-3" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end">
                                    <DropdownMenuItem onClick={() => handleEditSection(section)}>
                                      <Edit className="h-3 w-3 mr-2" />
                                      編集
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                      onClick={() => handleDeleteSection(section.id)}
                                      className="text-destructive"
                                    >
                                      <Trash2 className="h-3 w-3 mr-2" />
                                      削除
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </div>
                              {expandedSections.has(section.id) && (
                                <div className="ml-6 mt-1 space-y-1">
                                  <div className="flex items-center justify-between mb-1">
                                    <span className="text-xs text-muted-foreground">ページ</span>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-5 px-2 text-xs"
                                      onClick={() => handleCreatePage(section.id)}
                                    >
                                      <Plus className="h-3 w-3 mr-1" />
                                      ページを追加
                                    </Button>
                                  </div>
                                  {section.pages && section.pages.length > 0 ? (
                                    section.pages.map((page) => (
                                      <div
                                        key={page.id}
                                        className="flex items-center gap-2 py-1 group/page hover:bg-muted/50 rounded px-2"
                                      >
                                        <FileText className="h-3 w-3 text-muted-foreground" />
                                        <span className="text-xs flex-1 truncate">
                                          {page.title || "（タイトルなし）"}
                                        </span>
                                        <DropdownMenu>
                                          <DropdownMenuTrigger asChild>
                                            <Button
                                              variant="ghost"
                                              size="sm"
                                              className="h-5 w-5 p-0 opacity-0 group-hover/page:opacity-100 transition-opacity"
                                            >
                                              <MoreVertical className="h-3 w-3" />
                                            </Button>
                                          </DropdownMenuTrigger>
                                          <DropdownMenuContent align="end">
                                            <DropdownMenuItem onClick={() => handleEditPage(page)}>
                                              <Edit className="h-3 w-3 mr-2" />
                                              編集
                                            </DropdownMenuItem>
                                            <DropdownMenuItem
                                              onClick={() => handleDeletePage(page.id)}
                                              className="text-destructive"
                                            >
                                              <Trash2 className="h-3 w-3 mr-2" />
                                              削除
                                            </DropdownMenuItem>
                                          </DropdownMenuContent>
                                        </DropdownMenu>
                                      </div>
                                    ))
                                  ) : (
                                    <div className="text-xs text-muted-foreground py-1 px-2">
                                      ページがありません
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          ))
                        ) : (
                          <div className="text-sm text-muted-foreground pl-6 py-2">
                            セクションがありません
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* 新規作成ダイアログ */}
        <Dialog 
          open={createDialogOpen} 
          onOpenChange={(open) => {
            console.log("Dialog onOpenChange:", open)
            setCreateDialogOpen(open)
          }}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>新しいノートブックを作成</DialogTitle>
              <DialogDescription>
                ノートブックの情報を入力してください
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="subject">科目</Label>
                <Select
                  value={newNotebook.subject_id.toString()}
                  onValueChange={(value) =>
                    setNewNotebook(prev => ({ ...prev, subject_id: parseInt(value) }))
                  }
                >
                  <SelectTrigger id="subject">
                    <SelectValue placeholder="科目を選択" />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(SUBJECT_MAP).map(([id, name]) => (
                      <SelectItem key={id} value={id}>
                        {name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="title">タイトル</Label>
                <Input
                  id="title"
                  value={newNotebook.title}
                  onChange={(e) =>
                    setNewNotebook(prev => ({ ...prev, title: e.target.value }))
                  }
                  placeholder="ノートブックのタイトルを入力"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="description">説明（任意）</Label>
                <Textarea
                  id="description"
                  value={newNotebook.description}
                  onChange={(e) =>
                    setNewNotebook(prev => ({ ...prev, description: e.target.value }))
                  }
                  placeholder="ノートブックの説明を入力（任意）"
                  rows={3}
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setCreateDialogOpen(false)}
                disabled={creating}
              >
                キャンセル
              </Button>
              <Button onClick={handleCreateNotebook} disabled={creating}>
                {creating ? "作成中..." : "作成"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* ノートブック編集ダイアログ */}
        <Dialog open={editNotebookDialogOpen} onOpenChange={setEditNotebookDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>ノートブックを編集</DialogTitle>
              <DialogDescription>
                ノートブックの情報を編集してください
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="edit-subject">科目</Label>
                <Select
                  value={newNotebook.subject_id.toString()}
                  onValueChange={(value) =>
                    setNewNotebook(prev => ({ ...prev, subject_id: parseInt(value) }))
                  }
                >
                  <SelectTrigger id="edit-subject">
                    <SelectValue placeholder="科目を選択" />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(SUBJECT_MAP).map(([id, name]) => (
                      <SelectItem key={id} value={id}>
                        {name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit-title">タイトル</Label>
                <Input
                  id="edit-title"
                  value={newNotebook.title}
                  onChange={(e) =>
                    setNewNotebook(prev => ({ ...prev, title: e.target.value }))
                  }
                  placeholder="ノートブックのタイトルを入力"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit-description">説明（任意）</Label>
                <Textarea
                  id="edit-description"
                  value={newNotebook.description}
                  onChange={(e) =>
                    setNewNotebook(prev => ({ ...prev, description: e.target.value }))
                  }
                  placeholder="ノートブックの説明を入力（任意）"
                  rows={3}
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setEditNotebookDialogOpen(false)}
                disabled={editingNotebook}
              >
                キャンセル
              </Button>
              <Button onClick={handleUpdateNotebook} disabled={editingNotebook}>
                {editingNotebook ? "更新中..." : "更新"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* セクション作成ダイアログ */}
        <Dialog open={createSectionDialogOpen} onOpenChange={setCreateSectionDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>新しいセクションを作成</DialogTitle>
              <DialogDescription>
                セクション名を入力してください
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="section-title">セクション名</Label>
                <Input
                  id="section-title"
                  value={newSection.title}
                  onChange={(e) =>
                    setNewSection(prev => ({ ...prev, title: e.target.value }))
                  }
                  placeholder="セクション名を入力"
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setCreateSectionDialogOpen(false)}
                disabled={creatingSection}
              >
                キャンセル
              </Button>
              <Button onClick={handleSubmitCreateSection} disabled={creatingSection}>
                {creatingSection ? "作成中..." : "作成"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* セクション編集ダイアログ */}
        <Dialog open={editSectionDialogOpen} onOpenChange={setEditSectionDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>セクションを編集</DialogTitle>
              <DialogDescription>
                セクション名を編集してください
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="edit-section-title">セクション名</Label>
                <Input
                  id="edit-section-title"
                  value={newSection.title}
                  onChange={(e) =>
                    setNewSection(prev => ({ ...prev, title: e.target.value }))
                  }
                  placeholder="セクション名を入力"
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setEditSectionDialogOpen(false)}
                disabled={editingSection}
              >
                キャンセル
              </Button>
              <Button onClick={handleUpdateSection} disabled={editingSection}>
                {editingSection ? "更新中..." : "更新"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* ページ作成ダイアログ */}
        <Dialog open={createPageDialogOpen} onOpenChange={setCreatePageDialogOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>新しいページを作成</DialogTitle>
              <DialogDescription>
                ページのタイトルと内容を入力してください
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="page-title">タイトル（任意）</Label>
                <Input
                  id="page-title"
                  value={newPage.title}
                  onChange={(e) =>
                    setNewPage(prev => ({ ...prev, title: e.target.value }))
                  }
                  placeholder="ページのタイトルを入力（任意）"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="page-content">内容（Markdown形式）</Label>
                <Textarea
                  id="page-content"
                  value={newPage.content}
                  onChange={(e) =>
                    setNewPage(prev => ({ ...prev, content: e.target.value }))
                  }
                  placeholder="ページの内容を入力（Markdown形式）"
                  rows={10}
                  className="font-mono text-sm"
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setCreatePageDialogOpen(false)}
                disabled={creatingPage}
              >
                キャンセル
              </Button>
              <Button onClick={handleSubmitCreatePage} disabled={creatingPage}>
                {creatingPage ? "作成中..." : "作成"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* ページ編集ダイアログ */}
        <Dialog open={editPageDialogOpen} onOpenChange={setEditPageDialogOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>ページを編集</DialogTitle>
              <DialogDescription>
                ページのタイトルと内容を編集してください
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="edit-page-title">タイトル（任意）</Label>
                <Input
                  id="edit-page-title"
                  value={newPage.title}
                  onChange={(e) =>
                    setNewPage(prev => ({ ...prev, title: e.target.value }))
                  }
                  placeholder="ページのタイトルを入力（任意）"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit-page-content">内容</Label>
                <RichTextEditor
                  content={newPage.content || ""}
                  onChange={(content) =>
                    setNewPage(prev => ({ ...prev, content }))
                  }
                  placeholder="ページの内容を入力"
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setEditPageDialogOpen(false)}
                disabled={editingPage}
              >
                キャンセル
              </Button>
              <Button onClick={handleUpdatePage} disabled={editingPage}>
                {editingPage ? "更新中..." : "更新"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  )
}

export default withAuth(NotesPage, { requireAuth: true })
