"use client"

import { useState, useEffect } from "react"
import { ExternalLink, BookOpen } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area"
import { useSidebar } from "@/components/sidebar"
import { cn } from "@/lib/utils"
import { FIXED_SUBJECTS, getSubjectName, getSubjectId } from "@/lib/subjects"
import { withAuth } from "@/components/auth/with-auth"
import { apiClient } from "@/lib/api-client"

type ReviewHistoryItem = {
  id: number
  review_id: number
  subject: number | null  // 科目ID（1-18）
  subject_name: string | null  // 科目名（表示用）
  exam_type: string | null
  year: number | null
  score: number | null
  attempt_count: number
  created_at: string
}

type ExamRecord = {
  id: number
  itemName: string
  solvedDate: string
  score: number | null
  attemptCount: number
  reviewLink: string
}

function ExamTable({ data, title }: { data: ExamRecord[]; title: string }) {
  return (
    <div>
      <h3 className="text-sm font-semibold mb-2 text-amber-900/80">{title}</h3>
      <div className="border border-amber-200/60 rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-amber-50/60">
              <TableHead className="w-[200px] text-xs">項目名</TableHead>
              <TableHead className="w-[100px] text-xs">解いた日</TableHead>
              <TableHead className="w-[80px] text-xs">点数</TableHead>
              <TableHead className="w-[60px] text-xs">何回目</TableHead>
              <TableHead className="w-[90px] text-xs">講評</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground py-6 text-sm">
                  データがありません
                </TableCell>
              </TableRow>
            ) : (
              data.map((record) => (
                <TableRow key={record.id} className="hover:bg-amber-50/40">
                  <TableCell className="font-medium text-sm">{record.itemName}</TableCell>
                  <TableCell className="text-sm text-stone-600">{record.solvedDate}</TableCell>
                  <TableCell>
                    {record.score !== null ? (
                      <span className="text-sm font-semibold text-slate-700">
                        {record.score.toFixed(1)}点
                      </span>
                    ) : (
                      <span className="text-sm text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell className="text-sm text-stone-600">{record.attemptCount}回目</TableCell>
                  <TableCell>
                    <a
                      href={record.reviewLink}
                      className="flex items-center gap-1 text-xs text-amber-700 hover:text-amber-900 hover:underline"
                    >
                      <ExternalLink className="h-3 w-3" />
                      講評を見る
                    </a>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}

function PastExamsPage() {
  const { mainContentStyle } = useSidebar()
  const [selectedSubject, setSelectedSubject] = useState<string>(FIXED_SUBJECTS[0] as string)
  const [reviewHistory, setReviewHistory] = useState<ReviewHistoryItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const loadReviewHistory = async () => {
      try {
        setLoading(true)
        // 科目名からIDに変換
        const subjectId = selectedSubject ? getSubjectId(selectedSubject) : null
        const queryParam = subjectId 
          ? `subject=${subjectId}` 
          : selectedSubject 
            ? `subject_name=${encodeURIComponent(selectedSubject)}`
            : ""
        const data = await apiClient.get<ReviewHistoryItem[]>(
          `/api/review-history${queryParam ? `?${queryParam}` : ""}`
        )
        setReviewHistory(data)
      } catch (error) {
        console.error("Failed to load review history:", error)
        setReviewHistory([])
      } finally {
        setLoading(false)
      }
    }

    loadReviewHistory()
  }, [selectedSubject])

  // データを試験種別ごとに分類
  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`
  }

  const formatItemName = (item: ReviewHistoryItem) => {
    // subject_nameが優先、なければsubject_idから科目名を取得
    const subjectName = item.subject_name || (item.subject ? getSubjectName(item.subject) : "不明")
    
    if (item.year && subjectName !== "不明") {
      // 年度から元号記号を計算（2019年以降はR、1989年以降はH）
      let eraYear = item.year
      let eraPrefix = ""
      if (item.year >= 2019) {
        eraYear = item.year - 2018
        eraPrefix = "R"
      } else if (item.year >= 1989) {
        eraYear = item.year - 1988
        eraPrefix = "H"
      } else {
        eraYear = item.year - 1925
        eraPrefix = "S"
      }
      return `${eraPrefix}${eraYear}${subjectName}`
    }
    return subjectName
  }

  const currentData = {
    shihou: reviewHistory
      .filter((item) => item.exam_type === "司法試験")
      .map((item) => ({
        id: item.id,
        itemName: formatItemName(item),
        solvedDate: formatDate(item.created_at),
        score: item.score,
        attemptCount: item.attempt_count,
        reviewLink: `/your-page/review/${item.review_id}`,
      })),
    yobi: reviewHistory
      .filter((item) => item.exam_type === "予備試験")
      .map((item) => ({
        id: item.id,
        itemName: formatItemName(item),
        solvedDate: formatDate(item.created_at),
        score: item.score,
        attemptCount: item.attempt_count,
        reviewLink: `/your-page/review/${item.review_id}`,
      })),
    other: reviewHistory
      .filter((item) => !item.exam_type || (item.exam_type !== "司法試験" && item.exam_type !== "予備試験"))
      .map((item) => ({
        id: item.id,
        itemName: formatItemName(item),
        solvedDate: formatDate(item.created_at),
        score: item.score,
        attemptCount: item.attempt_count,
        reviewLink: `/your-page/review/${item.review_id}`,
      })),
  }

  return (
    <div 
      className="min-h-screen bg-gradient-to-b from-amber-50/80 to-orange-50/30 transition-all duration-300"
      style={mainContentStyle}
    >
      {/* Fixed Header */}
      <header className="sticky top-0 z-10 bg-white/95 backdrop-blur-sm border-b border-amber-200/60 shadow-sm">
        <div className="container mx-auto px-20 py-3 max-w-6xl">
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-amber-600" />
              <h1 className="text-base font-semibold text-amber-900">科目別過去問一覧</h1>
            </div>
            <Tabs value={selectedSubject} onValueChange={setSelectedSubject}>
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
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-20 py-4 max-w-6xl">
        <Card className="shadow-sm border-amber-200/60">
          <CardContent className="p-4 space-y-4">
            {loading ? (
              <div className="text-center text-muted-foreground py-8">読み込み中...</div>
            ) : (
              <>
                <ExamTable data={currentData.shihou} title="司法試験" />
                <ExamTable data={currentData.yobi} title="予備試験" />
                <ExamTable data={currentData.other} title="その他の試験" />
              </>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  )
}

export default withAuth(PastExamsPage, { requireAuth: true })
