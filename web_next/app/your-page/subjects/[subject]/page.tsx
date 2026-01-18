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
import { BookOpen, FileText, StickyNote, Plus, Folder, ChevronRight, ChevronDown, ChevronLeft, X, Menu } from "lucide-react"
import type { Notebook, NotePage } from "@/types/api"
import { withAuth } from "@/components/auth/with-auth"
import { apiClient } from "@/lib/api-client"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

type NotebookWithPages = Notebook & {
  pages?: NotePage[]
}

function SubjectPage() {
  const params = useParams()
  const router = useRouter()
  const { isOpen, setIsOpen } = useSidebar()
  // デフォルトは憲法、またはlocalStorageから直近アクセスした科目を取得
  const getDefaultSubject = () => {
    if (typeof window === 'undefined') return "憲法"
    try {
      const historyStr = localStorage.getItem('recent_subject_pages')
      if (historyStr) {
        const history: Array<{ subject: string; timestamp: number }> = JSON.parse(historyStr)
        if (history.length > 0) {
          const subject = history[0].subject
          // 型ガード: FIXED_SUBJECTSに含まれるかチェック
          if (FIXED_SUBJECTS.includes(subject as typeof FIXED_SUBJECTS[number])) {
            return subject
          }
        }
      }
    } catch (error) {
      console.error('Failed to load recent subject page:', error)
    }
    return "憲法"
  }

  const currentSubject = (params.subject as string) || getDefaultSubject()
  const [selectedSubject, setSelectedSubject] = useState<string>(currentSubject)
  const [mainTab, setMainTab] = useState<"study" | "notes" | null>(null)
  const [studyTab, setStudyTab] = useState<"norms" | "points">("norms")
  const [notebooks, setNotebooks] = useState<NotebookWithPages[]>([])
  const [loadingNotebooks, setLoadingNotebooks] = useState(false)
  const [expandedNotebooks, setExpandedNotebooks] = useState<Set<number>>(new Set())
  const [selectedPageId, setSelectedPageId] = useState<number | null>(null)
  const [isRightSidebarOpen, setIsRightSidebarOpen] = useState(true)

  // My規範・My論点のデータ（モック）
  type StudyItem = {
    id: number
    item: string  // 項目
    content: string  // 内容
    memo: string  // メモ
  }

  const [norms, setNorms] = useState<StudyItem[]>([])
  const [points, setPoints] = useState<StudyItem[]>([])
  const [loadingStudyData, setLoadingStudyData] = useState(false)
  const [isSubjectSelectorOpen, setIsSubjectSelectorOpen] = useState(true)

  // URLパラメータが変更されたときに状態を更新、またはデフォルトで憲法にリダイレクト
  useEffect(() => {
    if (!params.subject) {
      // URLパラメータがない場合、デフォルトで憲法にリダイレクト
      const defaultSubject = getDefaultSubject()
      router.push(`/your-page/subjects/${defaultSubject}`)
      setSelectedSubject(defaultSubject)
    } else if (params.subject !== selectedSubject) {
      setSelectedSubject(params.subject as string)
    }
  }, [params.subject, selectedSubject, router])

  // アクセス時にlocalStorageに保存（直近アクセス履歴）
  useEffect(() => {
    if (selectedSubject && typeof window !== 'undefined') {
      try {
        const historyKey = 'recent_subject_pages'
        const historyStr = localStorage.getItem(historyKey)
        const history: Array<{ subject: string; timestamp: number }> = historyStr ? JSON.parse(historyStr) : []

        // 現在の科目を履歴から削除（重複を避ける）
        const filteredHistory = history.filter(item => item.subject !== selectedSubject)

        // 現在の科目を先頭に追加
        const newHistory = [
          { subject: selectedSubject, timestamp: Date.now() },
          ...filteredHistory
        ].slice(0, 5) // 最大5件まで保持

        localStorage.setItem(historyKey, JSON.stringify(newHistory))
      } catch (error) {
        console.error('Failed to save recent subject page:', error)
      }
    }
  }, [selectedSubject])

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
    } else {
      // My規範・My論点タブの場合は右サイドバーを閉じる
      setIsRightSidebarOpen(false)
    }
  }, [mainTab, selectedSubject])

  // My規範・My論点のデータを取得（モック実装）
  useEffect(() => {
    if (mainTab === "study") {
      const fetchStudyData = async () => {
        setLoadingStudyData(true)
        try {
          // TODO: APIエンドポイントが実装されたら、ここでデータを取得
          // const normsData = await apiClient.get<StudyItem[]>(`/api/norms?subject=${selectedSubject}`)
          // const pointsData = await apiClient.get<StudyItem[]>(`/api/points?subject=${selectedSubject}`)
          // setNorms(normsData)
          // setPoints(pointsData)

          // モックデータ（後で削除）
          setNorms([])
          setPoints([])
        } catch (err) {
          console.error("Failed to fetch study data:", err)
          setNorms([])
          setPoints([])
        } finally {
          setLoadingStudyData(false)
        }
      }
      fetchStudyData()
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

  // 選択されたページを取得
  const selectedPage = notebooks
    .flatMap(nb => nb.pages || [])
    .find(page => page.id === selectedPageId)

  return (
    <div
      className={cn(
        "min-h-screen bg-gradient-to-b from-amber-50/80 to-orange-50/30 transition-all duration-300",
        isRightSidebarOpen && mainTab === "notes" && "mr-64"
      )}
      style={{
        marginLeft: isOpen ? '208px' : '0',
      }}
    >
      {/* サイドバーを開くボタン（閉じている場合のみ表示） */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed left-4 top-4 z-30 flex h-8 w-8 items-center justify-center rounded-md bg-white/95 backdrop-blur-sm border border-amber-200/60 shadow-md hover:bg-amber-50/40 transition-colors"
          aria-label="サイドバーを開く"
        >
          <Menu className="h-4 w-4 text-amber-600" />
        </button>
      )}
      {/* Fixed Header */}
      <header className="sticky top-0 z-10 bg-white/95 backdrop-blur-sm border-b border-amber-200/60 shadow-sm">
        <div className="container mx-auto px-20 py-3 max-w-6xl">
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <StickyNote className="h-4 w-4 text-amber-600" />
              <h1 className="text-base font-semibold text-amber-900">Your Note</h1>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsSubjectSelectorOpen(!isSubjectSelectorOpen)}
                className="flex items-center gap-1.5 text-xs text-amber-900/80 hover:text-amber-900 transition-colors"
              >
                {isSubjectSelectorOpen ? (
                  <ChevronDown className="h-3.5 w-3.5" />
                ) : (
                  <ChevronRight className="h-3.5 w-3.5" />
                )}
                <span>{selectedSubject}</span>
              </button>
              {isSubjectSelectorOpen && (
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
              )}
            </div>
            <div className="flex items-center gap-2">
              <Tabs value={mainTab || ""} onValueChange={(v) => {
                if (v === "study" || v === "notes") {
                  setMainTab(v)
                } else {
                  setMainTab(null)
                }
              }}>
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
              {mainTab && (
                <button
                  onClick={() => setMainTab(null)}
                  className="flex h-6 w-6 items-center justify-center rounded-md hover:bg-amber-200/40 transition-colors text-amber-600"
                  aria-label="タブを閉じる"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
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
                    {loadingStudyData ? (
                      <div className="text-xs text-muted-foreground text-center py-8">
                        読み込み中...
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="w-[20%] text-xs font-semibold text-amber-900/80">項目</TableHead>
                              <TableHead className="w-[60%] text-xs font-semibold text-amber-900/80">内容</TableHead>
                              <TableHead className="w-[20%] text-xs font-semibold text-amber-900/80">メモ</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {norms.length === 0 ? (
                              <TableRow>
                                <TableCell colSpan={3} className="text-xs text-muted-foreground text-center py-8">
                                  データがありません
                                </TableCell>
                              </TableRow>
                            ) : (
                              norms.map((norm) => (
                                <TableRow key={norm.id}>
                                  <TableCell className="text-xs align-top">{norm.item}</TableCell>
                                  <TableCell className="text-xs align-top whitespace-pre-wrap break-words">{norm.content}</TableCell>
                                  <TableCell className="text-xs align-top whitespace-pre-wrap break-words">{norm.memo}</TableCell>
                                </TableRow>
                              ))
                            )}
                          </TableBody>
                        </Table>
                      </div>
                    )}
                  </div>
                </TabsContent>
                <TabsContent value="points">
                  <div className="border border-amber-200/60 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-4">
                      <FileText className="h-4 w-4 text-amber-600" />
                      <h3 className="text-sm font-semibold text-amber-900/80">My 論点</h3>
                    </div>
                    {loadingStudyData ? (
                      <div className="text-xs text-muted-foreground text-center py-8">
                        読み込み中...
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="w-[20%] text-xs font-semibold text-amber-900/80">項目</TableHead>
                              <TableHead className="w-[60%] text-xs font-semibold text-amber-900/80">内容</TableHead>
                              <TableHead className="w-[20%] text-xs font-semibold text-amber-900/80">メモ</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {points.length === 0 ? (
                              <TableRow>
                                <TableCell colSpan={3} className="text-xs text-muted-foreground text-center py-8">
                                  データがありません
                                </TableCell>
                              </TableRow>
                            ) : (
                              points.map((point) => (
                                <TableRow key={point.id}>
                                  <TableCell className="text-xs align-top">{point.item}</TableCell>
                                  <TableCell className="text-xs align-top whitespace-pre-wrap break-words">{point.content}</TableCell>
                                  <TableCell className="text-xs align-top whitespace-pre-wrap break-words">{point.memo}</TableCell>
                                </TableRow>
                              ))
                            )}
                          </TableBody>
                        </Table>
                      </div>
                    )}
                  </div>
                </TabsContent>
              </Tabs>
            )}

            {/* ノートタブ */}
            {mainTab === "notes" && (
              <div className="flex items-start gap-4">
                {/* メインコンテンツエリア */}
                <div className="flex-1 min-w-0">
                  {selectedPage ? (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <h3 className="text-sm font-semibold text-amber-900/80">{selectedPage.title}</h3>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 text-xs"
                          onClick={() => setIsRightSidebarOpen(!isRightSidebarOpen)}
                        >
                          {isRightSidebarOpen ? (
                            <>
                              <ChevronRight className="h-3 w-3 mr-1" />
                              サイドバーを閉じる
                            </>
                          ) : (
                            <>
                              <ChevronLeft className="h-3 w-3 mr-1" />
                              サイドバーを開く
                            </>
                          )}
                        </Button>
                      </div>
                      <div className="border border-amber-200/60 rounded-lg p-4 min-h-[400px]">
                        {selectedPage.content ? (
                          <div className="prose prose-sm max-w-none">
                            <pre className="whitespace-pre-wrap text-xs text-slate-700 font-sans">
                              {selectedPage.content}
                            </pre>
                          </div>
                        ) : (
                          <div className="text-xs text-muted-foreground text-center py-8">
                            内容がありません
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-12 border border-amber-200/60 rounded-lg">
                      <p className="text-muted-foreground mb-4 text-sm">ノートを選択してください</p>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 text-xs"
                        onClick={() => setIsRightSidebarOpen(!isRightSidebarOpen)}
                      >
                        {isRightSidebarOpen ? (
                          <>
                            <ChevronRight className="h-3 w-3 mr-1" />
                            サイドバーを閉じる
                          </>
                        ) : (
                          <>
                            <ChevronLeft className="h-3 w-3 mr-1" />
                            サイドバーを開く
                          </>
                        )}
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </main>

      {/* 右側サイドパネル（ノート管理） */}
      {mainTab === "notes" && (
        <aside
          className={cn(
            "fixed right-0 top-0 h-full w-64 bg-white/95 backdrop-blur-sm border-l border-amber-200/60 shadow-lg z-30 transition-transform duration-300 ease-out",
            isRightSidebarOpen ? "translate-x-0" : "translate-x-full"
          )}
        >
          <div className="flex h-full flex-col">
            {/* ヘッダー */}
            <div className="px-4 py-3 border-b border-amber-200/60 bg-amber-50/60">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-amber-900">ノート管理</h2>
                <button
                  onClick={() => setIsRightSidebarOpen(false)}
                  className="flex h-6 w-6 items-center justify-center rounded-md hover:bg-amber-200/40 transition-colors"
                  aria-label="サイドバーを閉じる"
                >
                  <ChevronRight className="h-3.5 w-3.5 text-amber-600" />
                </button>
              </div>
            </div>

            {/* コンテンツ */}
            <div className="flex-1 overflow-y-auto p-4">
              <div className="flex items-center justify-between mb-4">
                <span className="text-xs font-medium text-amber-900/80">{selectedSubject}のノート</span>
                <Button size="sm" className="h-6 text-xs px-2">
                  <Plus className="h-3 w-3 mr-1" />
                  新規
                </Button>
              </div>
              {loadingNotebooks ? (
                <div className="text-center py-8 text-muted-foreground text-xs">読み込み中...</div>
              ) : notebooks.length === 0 ? (
                <div className="text-center py-8 border border-amber-200/60 rounded-lg">
                  <p className="text-muted-foreground mb-3 text-xs">ノートブックがありません</p>
                  <Button size="sm" className="h-6 text-xs px-2">
                    <Plus className="h-3 w-3 mr-1" />
                    作成
                  </Button>
                </div>
              ) : (
                <div className="space-y-1">
                  {notebooks.map((notebook) => (
                    <div key={notebook.id} className="border border-amber-200/60 rounded-lg overflow-hidden">
                      <button
                        onClick={() => toggleNotebook(notebook.id)}
                        className="w-full flex items-center gap-2 p-2 hover:bg-amber-50/40 transition-colors text-left"
                      >
                        {expandedNotebooks.has(notebook.id) ? (
                          <ChevronDown className="h-3 w-3 text-amber-600 shrink-0" />
                        ) : (
                          <ChevronRight className="h-3 w-3 text-amber-600 shrink-0" />
                        )}
                        <Folder className="h-3.5 w-3.5 text-amber-700 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-xs text-slate-700 truncate">{notebook.title}</h3>
                          {notebook.description && (
                            <p className="text-[10px] text-slate-500 mt-0.5 truncate">{notebook.description}</p>
                          )}
                        </div>
                      </button>
                      {expandedNotebooks.has(notebook.id) && (
                        <div className="pl-6 pr-2 pb-2 space-y-0.5">
                          {notebook.pages && notebook.pages.length > 0 ? (
                            notebook.pages.map((page) => {
                              const isSelected = page.id === selectedPageId
                              return (
                                <button
                                  key={page.id}
                                  onClick={() => setSelectedPageId(page.id)}
                                  className={cn(
                                    "w-full flex items-center gap-2 px-2 py-1.5 text-left text-xs rounded transition-colors",
                                    isSelected
                                      ? "bg-amber-200/60 text-amber-900 font-medium"
                                      : "text-slate-600 hover:bg-amber-50/40"
                                  )}
                                >
                                  <FileText className="h-3 w-3 text-amber-600 shrink-0" />
                                  <span className="truncate">{page.title}</span>
                                </button>
                              )
                            })
                          ) : (
                            <div className="text-[10px] text-muted-foreground pl-4 py-1">
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
          </div>
        </aside>
      )}

      {/* 右サイドバーが閉じている場合の開くボタン */}
      {mainTab === "notes" && !isRightSidebarOpen && (
        <button
          onClick={() => setIsRightSidebarOpen(true)}
          className="fixed right-4 top-20 z-20 flex h-8 w-8 items-center justify-center rounded-md bg-white/95 backdrop-blur-sm border border-amber-200/60 shadow-md hover:bg-amber-50/40 transition-colors"
          aria-label="サイドバーを開く"
        >
          <ChevronLeft className="h-4 w-4 text-amber-600" />
        </button>
      )}
    </div>
  )
}

export default withAuth(SubjectPage, { requireAuth: true })
