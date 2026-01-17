"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { SidebarToggle } from "@/components/sidebar"
import { useSidebar } from "@/components/sidebar"
import { cn } from "@/lib/utils"
import { Plus, FileText, Folder, ChevronRight, ChevronDown } from "lucide-react"
import type { Notebook, NoteSection, NotePage } from "@/types/api"
import { withAuth } from "@/components/auth/with-auth"

function NotesPage() {
  const { isOpen } = useSidebar()
  const [notebooks, setNotebooks] = useState<Notebook[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedNotebooks, setExpandedNotebooks] = useState<Set<number>>(new Set())
  const [expandedSections, setExpandedSections] = useState<Set<number>>(new Set())

  useEffect(() => {
    // ノートブック一覧を取得
    const fetchNotebooks = async () => {
      try {
        const res = await fetch("/api/notebooks")
        if (res.ok) {
          const data = await res.json()
          setNotebooks(data || [])
        }
      } catch (err) {
        console.error("Failed to fetch notebooks:", err)
      } finally {
        setLoading(false)
      }
    }
    fetchNotebooks()
  }, [])

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
          <div className="flex items-center gap-4">
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              新しいノートブック
            </Button>
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
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  最初のノートブックを作成
                </Button>
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
                      </div>
                    </button>
                    {expandedNotebooks.has(notebook.id) && (
                      <div className="pl-8 pr-4 pb-4 space-y-1">
                        {/* セクションとページは今後実装 */}
                        <div className="text-sm text-muted-foreground pl-6 py-2">
                          セクションとページの表示は今後実装予定です
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

export default withAuth(NotesPage, { requireAuth: true })
