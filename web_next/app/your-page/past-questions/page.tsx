"use client"

import { useState, useEffect, useMemo } from "react"
import { ExternalLink, BookOpen, ChevronDown, Filter } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useSidebar } from "@/components/sidebar"
import { cn } from "@/lib/utils"
import { FIXED_SUBJECTS, getSubjectName, getSubjectId } from "@/lib/subjects"
import { withAuth } from "@/components/auth/with-auth"
import { apiClient } from "@/lib/api-client"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

type ReviewHistoryItem = {
  id: number
  review_id: number
  subject: number | string | null  // 科目ID（1-18）
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
  subject: string
  year: number | null
  examType: string | null
}

// 科目と色の対応表（subjectsページと同じ）
const SUBJECT_COLORS: Record<string, string> = {
  "憲法": "bg-red-100 text-red-700",
  "行政法": "bg-rose-100 text-rose-700",
  "民法": "bg-blue-100 text-blue-700",
  "商法": "bg-cyan-100 text-cyan-700",
  "民事訴訟法": "bg-sky-100 text-sky-700",
  "刑法": "bg-green-100 text-green-700",
  "刑事訴訟法": "bg-emerald-100 text-emerald-700",
  "労働法": "bg-indigo-100 text-indigo-700",
  "知的財産法": "bg-teal-100 text-teal-700",
  "倒産法": "bg-violet-100 text-violet-700",
  "租税法": "bg-purple-100 text-purple-700",
  "経済法": "bg-fuchsia-100 text-fuchsia-700",
  "国際関係法（公法系）": "bg-pink-100 text-pink-700",
  "国際関係法（私法系）": "bg-slate-100 text-slate-700",
  "環境法": "bg-lime-100 text-lime-700",
  "国際関係法": "bg-slate-100 text-slate-700",
  "一般教養科目": "bg-gray-100 text-gray-700",
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
  const [reviewHistory, setReviewHistory] = useState<ReviewHistoryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedSubject, setSelectedSubject] = useState<string | null>(null)  // null = 全科目
  const [selectedYear, setSelectedYear] = useState<number | null>(null)  // null = 全年度

  useEffect(() => {
    const loadReviewHistory = async () => {
      try {
        setLoading(true)
        // 全科目を取得（フィルターはクライアント側で行う）
        const data = await apiClient.get<ReviewHistoryItem[]>(
          `/api/review-history`
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
  }, [])

  // 利用可能な年度のリストを取得
  const availableYears = useMemo(() => {
    const years = new Set<number>()
    reviewHistory.forEach((item) => {
      if (item.year !== null) {
        years.add(item.year)
      }
    })
    return Array.from(years).sort((a, b) => b - a)  // 降順
  }, [reviewHistory])

  // フィルター適用後のデータ
  const filteredData = useMemo(() => {
    let filtered = reviewHistory

    // 科目フィルター
    if (selectedSubject !== null) {
      const subjectId = getSubjectId(selectedSubject)
      filtered = filtered.filter((item) => {
        if (subjectId !== null) {
          return item.subject === subjectId
        }
        return item.subject_name === selectedSubject
      })
    }

    // 年度フィルター
    if (selectedYear !== null) {
      filtered = filtered.filter((item) => item.year === selectedYear)
    }

    return filtered
  }, [reviewHistory, selectedSubject, selectedYear])

  // データを試験種別ごとに分類
  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`
  }

  const resolveSubjectName = (item: ReviewHistoryItem) => {
    if (item.subject_name && item.subject_name !== "不明") {
      return item.subject_name
    }
    const subjectId = typeof item.subject === "string" ? Number(item.subject) : item.subject
    if (typeof subjectId === "number" && !Number.isNaN(subjectId)) {
      return getSubjectName(subjectId)
    }
    return "不明"
  }

  const formatItemName = (item: ReviewHistoryItem) => {
    // subject_nameが優先、なければsubject_idから科目名を取得
    const subjectName = resolveSubjectName(item)
    
    if (item.year) {
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

  // フィルター適用後のデータ（司法試験・予備試験）
  const currentData = {
    shihou: filteredData
      .filter((item) => item.exam_type === "司法試験")
      .map((item) => ({
        id: item.id,
        itemName: formatItemName(item),
        solvedDate: formatDate(item.created_at),
        score: item.score,
        attemptCount: item.attempt_count,
        reviewLink: `/your-page/review/${item.review_id}`,
        subject: resolveSubjectName(item),
        year: item.year,
        examType: item.exam_type,
      })),
    yobi: filteredData
      .filter((item) => item.exam_type === "予備試験")
      .map((item) => ({
        id: item.id,
        itemName: formatItemName(item),
        solvedDate: formatDate(item.created_at),
        score: item.score,
        attemptCount: item.attempt_count,
        reviewLink: `/your-page/review/${item.review_id}`,
        subject: resolveSubjectName(item),
        year: item.year,
        examType: item.exam_type,
      })),
  }

  // 「その他」はフィルターに関わらず常に全データから抽出
  const otherData = useMemo(() => {
    return reviewHistory
      .filter((item) => !item.exam_type || (item.exam_type !== "司法試験" && item.exam_type !== "予備試験"))
      .map((item) => ({
        id: item.id,
        itemName: formatItemName(item),
        solvedDate: formatDate(item.created_at),
        score: item.score,
        attemptCount: item.attempt_count,
        reviewLink: `/your-page/review/${item.review_id}`,
        subject: resolveSubjectName(item),
        year: item.year,
        examType: item.exam_type,
      }))
  }, [reviewHistory])

  return (
    <div 
      className="min-h-screen bg-gradient-to-b from-amber-50/80 to-orange-50/30 transition-all duration-300"
      style={mainContentStyle}
    >
      {/* Fixed Header */}
      <header className="sticky top-0 z-10 bg-white/95 backdrop-blur-sm border-b border-amber-200/60 shadow-sm">
        <div className="container mx-auto px-20 py-3 max-w-6xl">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-amber-600" />
              <h1 className="text-base font-semibold text-amber-900">過去問一覧</h1>
            </div>
            <div className="flex items-center gap-3">
              {/* 科目フィルター */}
              <div className="flex items-center gap-2">
                <Filter className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">科目</span>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className={cn(
                      "flex items-center gap-1.5 text-xs transition-colors px-2 py-1 rounded-md hover:opacity-80",
                      selectedSubject 
                        ? (SUBJECT_COLORS[selectedSubject] || "bg-amber-100 text-amber-900")
                        : "bg-gray-100 text-gray-700"
                    )}>
                      <span>{selectedSubject || "全科目"}</span>
                      <ChevronDown className="h-3.5 w-3.5" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" side="bottom" className="w-32">
                    <DropdownMenuItem
                      onClick={() => setSelectedSubject(null)}
                      className={cn(
                        "text-xs cursor-pointer rounded-sm",
                        "bg-gray-100 text-gray-700",
                        selectedSubject === null && "ring-2 ring-offset-1 ring-amber-500 font-medium"
                      )}
                    >
                      全科目
                    </DropdownMenuItem>
                    {FIXED_SUBJECTS.map((subject) => (
                      <DropdownMenuItem
                        key={subject}
                        onClick={() => setSelectedSubject(subject)}
                        className={cn(
                          "text-xs cursor-pointer rounded-sm",
                          SUBJECT_COLORS[subject] || "bg-gray-100 text-gray-700",
                          selectedSubject === subject && "ring-2 ring-offset-1 ring-amber-500 font-medium"
                        )}
                      >
                        {subject}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              {/* 年度フィルター */}
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">年度</span>
                <Select 
                  value={selectedYear?.toString() || "all"} 
                  onValueChange={(value) => {
                    if (value === "all") {
                      setSelectedYear(null)
                    } else {
                      setSelectedYear(parseInt(value))
                    }
                  }}
                >
                  <SelectTrigger className="h-7 text-xs w-24">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all" className="text-xs">全年度</SelectItem>
                    {availableYears.map((year) => {
                      // 年度を元号表記に変換
                      let eraYear = year
                      let eraPrefix = ""
                      if (year >= 2019) {
                        eraYear = year - 2018
                        eraPrefix = "R"
                      } else if (year >= 1989) {
                        eraYear = year - 1988
                        eraPrefix = "H"
                      } else {
                        eraYear = year - 1925
                        eraPrefix = "S"
                      }
                      return (
                        <SelectItem key={year} value={year.toString()} className="text-xs">
                          {eraPrefix}{eraYear}
                        </SelectItem>
                      )
                    })}
                  </SelectContent>
                </Select>
              </div>
            </div>
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
                <ExamTable data={otherData} title="その他の試験" />
              </>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  )
}

export default withAuth(PastExamsPage, { requireAuth: true })
