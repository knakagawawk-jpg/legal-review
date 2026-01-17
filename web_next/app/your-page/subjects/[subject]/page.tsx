"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import { Card, CardContent } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area"
import { Button } from "@/components/ui/button"
import { useSidebar } from "@/components/sidebar"
import { cn } from "@/lib/utils"
import { FIXED_SUBJECTS } from "@/lib/subjects"
import { BookOpen, FileText, StickyNote, Plus, Folder, ChevronRight, ChevronDown } from "lucide-react"
import type { Notebook, NotePage } from "@/types/api"
import { withAuth } from "@/components/auth/with-auth"
import { apiClient } from "@/lib/api-client"

type NotebookWithPages = Notebook & {
  pages?: NotePage[]
}

function SubjectPage() {
  const params = useParams()
  const router = useRouter()
  const { isOpen } = useSidebar()
  const currentSubject = (params.subject as string) || FIXED_SUBJECTS[0] || "憲法"
  const [selectedSubject, setSelectedSubject] = useState<string>(currentSubject)
  const [mainTab, setMainTab] = useState<"study" | "notes">("study")
  const [studyTab, setStudyTab] = useState<"norms" | "points">("norms")
  const [notebooks, setNotebooks] = useState<NotebookWithPages[]>([])
  const [loadingNotebooks, setLoadingNotebooks] = useState(false)
  const [expandedNotebooks, setExpandedNotebooks] = useState<Set<number>>(new Set())

  // URLパラメータが変更されたときに状態を更新
  useEffect(() => {
    if (params.subject && params.subject !== selectedSubject) {
      setSelectedSubject(params.subject as string)
    }
  }, [params.subject, selectedSubject])

  // ノートブック一覧を取得（ページも含む）
  useEffect(() => {
    if (mainTab === "notes") {
      const fetchNotebooks = async () => {
        setLoadingNotebooks(true)
        try {
          const notebooksData = await apiClient.get<Notebook[]>("/api/notebooks")
          // 各ノートブックの詳細（ページを含む）を取得
          const notebooksWithPages = await Promise.all(
            notebooksData.map(async (notebook) => {
              try {
                const detail = await apiClient.get<{ sections: Array<{ pages: NotePage[] }> }>(`/api/notebooks/${notebook.id}`)
                // Sectionを無視して、すべてのPageを直接Notebookに紐付ける
                const allPages: NotePage[] = []
                detail.sections?.forEach((section) => {
                  if (section.pages) {
                    allPages.push(...section.pages)
                  }
                })
                return { ...notebook, pages: allPages }
              } catch (err) {
                console.error(`Failed to fetch notebook ${notebook.id} details:`, err)
                return { ...notebook, pages: [] }
              }
            })
          )
          setNotebooks(notebooksWithPages)
        } catch (err) {
          console.error("Failed to fetch notebooks:", err)
          setNotebooks([])
        } finally {
          setLoadingNotebooks(false)
        }
      }
      fetchNotebooks()
    }
  }, [mainTab, selectedSubject])

  const handleSubjectChange = (value: string) => {
    setSelectedSubject(value)
    router.push(`/your-page/subjects/${value}`)
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

  return (
    <div className={cn("min-h-screen bg-gradient-to-b from-amber-50/80 to-orange-50/30 transition-all duration-300", isOpen && "ml-52")}>
      {/* Fixed Header */}
      <header className="sticky top-0 z-10 bg-white/95 backdrop-blur-sm border-b border-amber-200/60 shadow-sm">
        <div className="container mx-auto px-20 py-3 max-w-6xl">
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <StickyNote className="h-4 w-4 text-amber-600" />
              <h1 className="text-base font-semibold text-amber-900">Your Note</h1>
            </div>
            <Tabs value={selectedSubject} onValueChange={handleSubjectChange}>
              <ScrollArea className="w-full">
                <TabsList className="inline-flex w-max h-8 bg-amber-100/60 p-0.5">
                  {FIXED_SUBJECTS.map((subject) => (
                    <TabsTrigger
                      key={subject}
                      value={subject}
                      className="text-xs px-2.5 py-1 data-[state=active]:bg-white data-[state=active]:text-amber-800 data-[state=active]:shadow-sm"
                    >
                      {subject}
                    </TabsTrigger>
                  ))}
                </TabsList>
                <ScrollBar orientation="horizontal" className="h-1.5" />
              </ScrollArea>
            </Tabs>
            <Tabs value={mainTab} onValueChange={(v) => setMainTab(v as "study" | "notes")}>
              <TabsList className="inline-flex w-max h-8 bg-amber-100/60 p-0.5">
                <TabsTrigger
                  value="study"
                  className="text-xs px-2.5 py-1 data-[state=active]:bg-white data-[state=active]:text-amber-800 data-[state=active]:shadow-sm flex items-center gap-1.5"
                >
                  <BookOpen className="h-3 w-3" />
                  My規範・My論点
                </TabsTrigger>
                <TabsTrigger
                  value="notes"
                  className="text-xs px-2.5 py-1 data-[state=active]:bg-white data-[state=active]:text-amber-800 data-[state=active]:shadow-sm flex items-center gap-1.5"
                >
                  <StickyNote className="h-3 w-3" />
                  ノート
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-20 py-4 max-w-6xl">
        <Card className="shadow-sm border-amber-200/60">
          <CardContent className="p-4">
            {/* My規範・My論点タブ */}
            {mainTab === "study" && (
              <Tabs value={studyTab} onValueChange={(v) => setStudyTab(v as "norms" | "points")} className="w-full">
                <TabsList className="mb-6">
                  <TabsTrigger value="norms" className="text-xs">
                    <BookOpen className="h-3 w-3 mr-1.5" />
                    My 規範
                  </TabsTrigger>
                  <TabsTrigger value="points" className="text-xs">
                    <FileText className="h-3 w-3 mr-1.5" />
                    My 論点
                  </TabsTrigger>
                </TabsList>
                <TabsContent value="norms">
                  <div className="border border-amber-200/60 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-4">
                      <BookOpen className="h-4 w-4 text-amber-600" />
                      <h3 className="text-sm font-semibold text-amber-900/80">My 規範</h3>
                    </div>
                    <div className="text-xs text-muted-foreground text-center py-8">
                      テーブル表示は今後実装予定です
                    </div>
                  </div>
                </TabsContent>
                <TabsContent value="points">
                  <div className="border border-amber-200/60 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-4">
                      <FileText className="h-4 w-4 text-amber-600" />
                      <h3 className="text-sm font-semibold text-amber-900/80">My 論点</h3>
                    </div>
                    <div className="text-xs text-muted-foreground text-center py-8">
                      テーブル表示は今後実装予定です
                    </div>
                  </div>
                </TabsContent>
              </Tabs>
            )}

            {/* ノートタブ */}
            {mainTab === "notes" && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-semibold text-amber-900/80">{selectedSubject}のノート</h3>
                    <Button size="sm" className="h-7 text-xs">
                      <Plus className="h-3 w-3 mr-1" />
                      新しいノートブック
                    </Button>
                  </div>
                  {loadingNotebooks ? (
                    <div className="text-center py-8 text-muted-foreground text-sm">読み込み中...</div>
                  ) : notebooks.length === 0 ? (
                    <div className="text-center py-12 border border-amber-200/60 rounded-lg">
                      <p className="text-muted-foreground mb-4 text-sm">ノートブックがありません</p>
                      <Button size="sm" className="h-7 text-xs">
                        <Plus className="h-3 w-3 mr-1" />
                        最初のノートブックを作成
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {notebooks.map((notebook) => (
                        <div key={notebook.id} className="border border-amber-200/60 rounded-lg overflow-hidden">
                          <button
                            onClick={() => toggleNotebook(notebook.id)}
                            className="w-full flex items-center gap-2 p-3 hover:bg-amber-50/40 transition-colors text-left"
                          >
                            {expandedNotebooks.has(notebook.id) ? (
                              <ChevronDown className="h-4 w-4 text-amber-600" />
                            ) : (
                              <ChevronRight className="h-4 w-4 text-amber-600" />
                            )}
                            <Folder className="h-4 w-4 text-amber-700" />
                            <div className="flex-1">
                              <h3 className="font-semibold text-sm text-slate-700">{notebook.title}</h3>
                              {notebook.description && (
                                <p className="text-xs text-slate-500 mt-0.5">{notebook.description}</p>
                              )}
                            </div>
                          </button>
                          {expandedNotebooks.has(notebook.id) && (
                            <div className="pl-8 pr-4 pb-3 space-y-1">
                              {notebook.pages && notebook.pages.length > 0 ? (
                                notebook.pages.map((page) => (
                                  <button
                                    key={page.id}
                                    className="w-full flex items-center gap-2 px-2 py-1.5 text-left text-xs text-slate-600 hover:bg-amber-50/40 rounded transition-colors"
                                  >
                                    <FileText className="h-3 w-3 text-amber-600" />
                                    <span>{page.title}</span>
                                  </button>
                                ))
                              ) : (
                                <div className="text-xs text-muted-foreground pl-6 py-2">
                                  ページがありません
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  )
}

export default withAuth(SubjectPage, { requireAuth: true })
