"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { SidebarToggle } from "@/components/sidebar"
import { useSidebar } from "@/components/sidebar"
import { cn } from "@/lib/utils"
import { FIXED_SUBJECTS } from "@/lib/subjects"
import { BookOpen, FileText, StickyNote, Plus, Folder, ChevronRight, ChevronDown } from "lucide-react"
import type { Notebook, NoteSection, NotePage } from "@/types/api"

export default function SubjectPage() {
  const params = useParams()
  const router = useRouter()
  const { isOpen } = useSidebar()
  const currentSubject = (params.subject as string) || FIXED_SUBJECTS[0] || "憲法"
  const [selectedSubject, setSelectedSubject] = useState<string>(currentSubject)
  const [mainTab, setMainTab] = useState<"study" | "notes">("study")
  const [studyTab, setStudyTab] = useState<"norms" | "points">("norms")
  const [notebooks, setNotebooks] = useState<Notebook[]>([])
  const [loadingNotebooks, setLoadingNotebooks] = useState(false)
  const [expandedNotebooks, setExpandedNotebooks] = useState<Set<number>>(new Set())
  const [expandedSections, setExpandedSections] = useState<Set<number>>(new Set())

  // URLパラメータが変更されたときに状態を更新
  useEffect(() => {
    if (params.subject && params.subject !== selectedSubject) {
      setSelectedSubject(params.subject as string)
    }
  }, [params.subject, selectedSubject])

  // ノートブック一覧を取得
  useEffect(() => {
    if (mainTab === "notes") {
      const fetchNotebooks = async () => {
        setLoadingNotebooks(true)
        try {
          const res = await fetch("/api/notebooks")
          if (res.ok) {
            const data = await res.json()
            setNotebooks(data || [])
          }
        } catch (err) {
          console.error("Failed to fetch notebooks:", err)
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
    <div className={cn("min-h-screen bg-gradient-to-b from-background to-muted/20 transition-all duration-300", isOpen && "ml-52")}>
      <div className="container mx-auto px-8 py-12 max-w-6xl">
        {/* ヘッダー */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold mb-2">📖 {selectedSubject}</h1>
            <p className="text-muted-foreground text-lg">学習内容とノートを管理します</p>
          </div>
          <div className="flex items-center gap-4">
            <Select value={selectedSubject} onValueChange={handleSubjectChange}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="科目を選択" />
              </SelectTrigger>
              <SelectContent>
                {FIXED_SUBJECTS.map((subject) => (
                  <SelectItem key={subject} value={subject}>
                    {subject}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <SidebarToggle />
          </div>
        </div>

        {/* メインタブ */}
        <Card>
          <CardHeader>
            <CardTitle>{selectedSubject}の学習内容</CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs value={mainTab} onValueChange={(v) => setMainTab(v as "study" | "notes")} className="w-full">
              <TabsList className="mb-6 w-full grid grid-cols-2">
                <TabsTrigger value="study" className="flex items-center gap-2">
                  <BookOpen className="h-4 w-4" />
                  My規範・My論点
                </TabsTrigger>
                <TabsTrigger value="notes" className="flex items-center gap-2">
                  <StickyNote className="h-4 w-4" />
                  ノート
                </TabsTrigger>
              </TabsList>

              {/* My規範・My論点タブ */}
              <TabsContent value="study">
                <Tabs value={studyTab} onValueChange={(v) => setStudyTab(v as "norms" | "points")} className="w-full">
                  <TabsList className="mb-6">
                    <TabsTrigger value="norms">
                      <BookOpen className="h-4 w-4 mr-2" />
                      My 規範
                    </TabsTrigger>
                    <TabsTrigger value="points">
                      <FileText className="h-4 w-4 mr-2" />
                      My 論点
                    </TabsTrigger>
                  </TabsList>
                  <TabsContent value="norms">
                    <div className="border rounded-lg p-4">
                      <div className="flex items-center gap-2 mb-4">
                        <BookOpen className="h-4 w-4 text-muted-foreground" />
                        <h3 className="font-semibold">My 規範</h3>
                      </div>
                      <div className="text-sm text-muted-foreground text-center py-8">
                        テーブル表示は今後実装予定です
                      </div>
                    </div>
                  </TabsContent>
                  <TabsContent value="points">
                    <div className="border rounded-lg p-4">
                      <div className="flex items-center gap-2 mb-4">
                        <FileText className="h-4 w-4 text-muted-foreground" />
                        <h3 className="font-semibold">My 論点</h3>
                      </div>
                      <div className="text-sm text-muted-foreground text-center py-8">
                        テーブル表示は今後実装予定です
                      </div>
                    </div>
                  </TabsContent>
                </Tabs>
              </TabsContent>

              {/* ノートタブ */}
              <TabsContent value="notes">
                <div className="space-y-4">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold">{selectedSubject}のノート</h3>
                    <Button>
                      <Plus className="h-4 w-4 mr-2" />
                      新しいノートブック
                    </Button>
                  </div>
                  {loadingNotebooks ? (
                    <div className="text-center py-8 text-muted-foreground">読み込み中...</div>
                  ) : notebooks.length === 0 ? (
                    <div className="text-center py-12 border rounded-lg">
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
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
