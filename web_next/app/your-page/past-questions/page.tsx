"use client"

import { useState } from "react"
import { ExternalLink, BookOpen } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area"
import { useSidebar } from "@/components/sidebar"
import { cn } from "@/lib/utils"
import { FIXED_SUBJECTS } from "@/lib/subjects"
import { withAuth } from "@/components/auth/with-auth"

type ExamRecord = {
  id: number
  itemName: string
  solvedDate: string
  evaluation: string
  attemptCount: number
  memo: string
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
              <TableHead className="w-[60px] text-xs">評価</TableHead>
              <TableHead className="w-[60px] text-xs">何回目</TableHead>
              <TableHead className="w-[180px] text-xs">メモ</TableHead>
              <TableHead className="w-[90px] text-xs">講評</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-6 text-sm">
                  データがありません
                </TableCell>
              </TableRow>
            ) : (
              data.map((record) => (
                <TableRow key={record.id} className="hover:bg-amber-50/40">
                  <TableCell className="font-medium text-sm">{record.itemName}</TableCell>
                  <TableCell className="text-sm text-stone-600">{record.solvedDate}</TableCell>
                  <TableCell>
                    <span
                      className={cn(
                        "inline-flex items-center justify-center w-6 h-6 rounded text-xs font-semibold",
                        record.evaluation === "A" && "bg-emerald-100 text-emerald-700",
                        record.evaluation === "B" && "bg-amber-100 text-amber-700",
                        record.evaluation === "C" && "bg-rose-100 text-rose-700",
                      )}
                    >
                      {record.evaluation}
                    </span>
                  </TableCell>
                  <TableCell className="text-sm text-stone-600">{record.attemptCount}回目</TableCell>
                  <TableCell className="text-sm text-muted-foreground truncate max-w-[180px]">
                    {record.memo || "-"}
                  </TableCell>
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

// サンプルデータ
const sampleData: Record<
  string,
  {
    shihou: ExamRecord[]
    yobi: ExamRecord[]
    other: ExamRecord[]
  }
> = {
  憲法: {
    shihou: [
      {
        id: 1,
        itemName: "令和5年 憲法 第1問",
        solvedDate: "2024-01-10",
        evaluation: "A",
        attemptCount: 2,
        memo: "表現の自由の論点を整理",
        reviewLink: "/review/1",
      },
      {
        id: 2,
        itemName: "令和5年 憲法 第2問",
        solvedDate: "2024-01-15",
        evaluation: "B",
        attemptCount: 1,
        memo: "",
        reviewLink: "/review/2",
      },
      {
        id: 3,
        itemName: "令和4年 憲法 第1問",
        solvedDate: "2024-01-20",
        evaluation: "A",
        attemptCount: 3,
        memo: "違憲審査基準の適用に注意",
        reviewLink: "/review/3",
      },
    ],
    yobi: [
      {
        id: 4,
        itemName: "令和5年 憲法",
        solvedDate: "2024-02-01",
        evaluation: "B",
        attemptCount: 1,
        memo: "時間配分に課題",
        reviewLink: "/review/4",
      },
      {
        id: 5,
        itemName: "令和4年 憲法",
        solvedDate: "2024-02-10",
        evaluation: "A",
        attemptCount: 2,
        memo: "",
        reviewLink: "/review/5",
      },
    ],
    other: [
      {
        id: 6,
        itemName: "ロースクール入試 2024",
        solvedDate: "2024-03-01",
        evaluation: "A",
        attemptCount: 1,
        memo: "基礎知識の確認",
        reviewLink: "/review/6",
      },
    ],
  },
  民法: {
    shihou: [
      {
        id: 7,
        itemName: "令和5年 民法 第1問",
        solvedDate: "2024-01-12",
        evaluation: "B",
        attemptCount: 1,
        memo: "債権譲渡の要件整理",
        reviewLink: "/review/7",
      },
      {
        id: 8,
        itemName: "令和5年 民法 第2問",
        solvedDate: "2024-01-18",
        evaluation: "C",
        attemptCount: 1,
        memo: "物権変動の対抗要件を復習",
        reviewLink: "/review/8",
      },
    ],
    yobi: [
      {
        id: 9,
        itemName: "令和5年 民法",
        solvedDate: "2024-02-05",
        evaluation: "B",
        attemptCount: 2,
        memo: "",
        reviewLink: "/review/9",
      },
    ],
    other: [],
  },
}

function PastExamsPage() {
  const { isOpen } = useSidebar()
  const [selectedSubject, setSelectedSubject] = useState<string>(FIXED_SUBJECTS[0] as string)

  const currentData = sampleData[selectedSubject] || { shihou: [], yobi: [], other: [] }

  return (
    <div className={cn("min-h-screen bg-gradient-to-b from-amber-50/80 to-orange-50/30 transition-all duration-300", isOpen && "ml-52")}>
      {/* Fixed Header */}
      <header className="sticky top-0 z-10 bg-white/95 backdrop-blur-sm border-b border-amber-200/60 shadow-sm">
        <div className="container mx-auto px-4 py-3 max-w-6xl">
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
      <main className="container mx-auto px-4 py-4 max-w-6xl">
        <Card className="shadow-sm border-amber-200/60">
          <CardContent className="p-4 space-y-4">
            <ExamTable data={currentData.shihou} title="司法試験" />
            <ExamTable data={currentData.yobi} title="予備試験" />
            <ExamTable data={currentData.other} title="その他の試験" />
          </CardContent>
        </Card>
      </main>
    </div>
  )
}

export default withAuth(PastExamsPage, { requireAuth: true })
