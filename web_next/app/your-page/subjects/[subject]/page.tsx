"use client"

import React, { useState, useEffect, useRef, useCallback, useMemo } from "react"
import { createPortal } from "react-dom"
import { useParams, useRouter, useSearchParams } from "next/navigation"
import { Card, CardContent } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { useSidebar } from "@/components/sidebar"
import { cn } from "@/lib/utils"
import { FIXED_SUBJECTS, getSubjectId } from "@/lib/subjects"
import { BookOpen, FileText, StickyNote, Plus, Folder, ChevronRight, ChevronDown, ChevronLeft, X, Menu, GripVertical, Trash2, CalendarDays, MoreVertical, Edit } from "lucide-react"
import type { Notebook, NoteSection, NotePage } from "@/types/api"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { withAuth } from "@/components/auth/with-auth"
import { apiClient } from "@/lib/api-client"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { RichTextEditor } from "@/components/editor/rich-text-editor"
import { Calendar, DatePickerCalendar } from "@/components/ui/calendar"
import { Checkbox } from "@/components/ui/checkbox"
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core"
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"

type NoteSectionWithPages = NoteSection & {
  pages?: NotePage[]
}

type NotebookWithSections = Notebook & {
  sections?: NoteSectionWithPages[]
}

// Dashboardと同じ高さ制御ロジック（入力時は最大5行、表示時は1〜3行）
function MemoField({
  value,
  onChange,
  onBlur,
  onKeyDown,
  placeholder = "",
}: {
  value: string
  onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void
  onBlur?: () => void
  onKeyDown?: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void
  placeholder?: string
}) {
  const [isFocused, setIsFocused] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const lineHeight = 24 // 1.5rem = 24px
  const inputHeight = 7.5 // 入力時高さ（5行分: 1.5rem * 5）
  const maxHeight = inputHeight * 16 // 7.5rem = 120px (16px基準)

  const adjustHeight = useCallback(() => {
    if (!textareaRef.current) return

    if (isFocused) {
      textareaRef.current.style.height = "auto"
      const scrollHeight = textareaRef.current.scrollHeight
      textareaRef.current.style.height = `${Math.min(scrollHeight, maxHeight)}px`
      textareaRef.current.style.maxHeight = `${maxHeight}px`
    } else {
      if (!value || value.trim() === "") {
        textareaRef.current.style.height = "1.5rem"
        textareaRef.current.style.maxHeight = "1.5rem"
        return
      }

      textareaRef.current.style.height = "1.5rem"
      const scrollHeight = textareaRef.current.scrollHeight

      let displayLines = 1
      if (scrollHeight > lineHeight + 1) {
        if (scrollHeight <= lineHeight * 2 + 1) {
          displayLines = 2
        } else {
          displayLines = 3
        }
      }

      const displayHeight = displayLines * lineHeight
      textareaRef.current.style.height = `${displayHeight}px`
      textareaRef.current.style.maxHeight = `${displayHeight}px`
    }
  }, [isFocused, value, lineHeight, maxHeight])

  useEffect(() => {
    adjustHeight()
  }, [adjustHeight])

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    onChange(e)
    setTimeout(() => {
      adjustHeight()
    }, 0)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      textareaRef.current?.blur()
      if (onBlur) onBlur()
      return
    }
    if (onKeyDown) onKeyDown(e)
  }

  return (
    <Textarea
      ref={textareaRef}
      value={value}
      onChange={handleChange}
      onKeyDown={handleKeyDown}
      onFocus={() => setIsFocused(true)}
      onBlur={() => {
        setIsFocused(false)
        if (onBlur) onBlur()
      }}
      placeholder={placeholder}
      className={cn(
        "text-xs border-0 shadow-none bg-transparent hover:bg-muted/50 focus:bg-muted/50 focus-visible:ring-0 resize-none whitespace-pre-wrap break-words py-1 px-0",
        isFocused ? "overflow-y-auto min-h-[7.5rem]" : "overflow-hidden"
      )}
      style={{
        lineHeight: "1.5rem",
        height: (!value || value.trim() === "") && !isFocused ? "1.5rem" : undefined,
        minHeight: isFocused ? "7.5rem" : "1.5rem",
      }}
    />
  )
}

type StudyTag = {
  id: number
  user_id: number
  subject_id: number
  name: string
  created_at: string
}

// My規範・My論点のデータ型
type StudyItem = {
  id: number
  item: string  // 項目
  importance: number  // 重要度 (1=High, 2=Middle, 3=Low)
  masteryLevel?: number | null  // 理解度 (1=未習得, 2=初級, 3=中級, 4=上級, 5=完全習得)
  content: string  // 内容
  memo: string  // メモ
  tags?: string[]  // タグ（配列）
  createdAt: string  // 作成日 (mm/dd形式)
}

// Sortable Row Component
function SortableRow({
  item,
  children,
  onDelete,
  onEditCreatedDate,
}: {
  item: StudyItem
  children: React.ReactNode
  onDelete: (id: number) => void
  onEditCreatedDate?: (id: number) => void
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id.toString() })
  const [showMenu, setShowMenu] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const handleButtonRef = useRef<HTMLButtonElement>(null)
  const clickStartPos = useRef<{ x: number; y: number } | null>(null)
  const [menuPos, setMenuPos] = useState<{ left: number; top: number } | null>(null)

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node
      if (menuRef.current && menuRef.current.contains(target)) return
      if (handleButtonRef.current && handleButtonRef.current.contains(target)) return
      if (showMenu) {
        setShowMenu(false)
      }
    }

    if (showMenu) {
      document.addEventListener("mousedown", handleClickOutside)
      return () => {
        document.removeEventListener("mousedown", handleClickOutside)
      }
    }
  }, [showMenu])

  // Handle mouse down to track click position
  const handleMouseDown = (e: React.MouseEvent) => {
    clickStartPos.current = { x: e.clientX, y: e.clientY }
  }

  // Handle click on drag handle
  const handleClick = (e: React.MouseEvent) => {
    // マウスが動いていない場合（クリック）のみメニューを表示
    if (clickStartPos.current) {
      const deltaX = Math.abs(e.clientX - clickStartPos.current.x)
      const deltaY = Math.abs(e.clientY - clickStartPos.current.y)
      if (deltaX < 5 && deltaY < 5) {
        e.stopPropagation()
        e.preventDefault()
        // メニュー位置を固定座標で保存（スクロールコンテナにクリップされないようPortal表示）
        try {
          const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
          setMenuPos({
            left: rect.left + rect.width + 6,
            top: rect.top + rect.height / 2,
          })
        } catch {
          setMenuPos({ left: e.clientX + 6, top: e.clientY })
        }
        setShowMenu(true)
      }
      clickStartPos.current = null
    }
  }

  return (
    <TableRow
      ref={setNodeRef}
      style={style}
      className={cn(
        "border-b border-border/50 hover:bg-amber-50/30 transition-colors",
        isDragging && "opacity-50 bg-amber-50"
      )}
    >
      <TableCell className="py-1.5 px-1 w-6 relative">
        <button
          ref={handleButtonRef}
          {...attributes}
          {...listeners}
          onMouseDown={handleMouseDown}
          onClick={handleClick}
          className="cursor-grab active:cursor-grabbing p-0.5 hover:bg-muted rounded"
        >
          <GripVertical className="h-3 w-3 text-muted-foreground" />
        </button>
        {showMenu && menuPos && typeof document !== "undefined" && createPortal(
          <div
            ref={menuRef}
            className="fixed z-[9999] flex gap-1 bg-card border rounded shadow-lg p-1"
            style={{
              left: menuPos.left,
              top: menuPos.top,
              transform: "translateY(-50%)",
            }}
          >
            <Button
              variant="ghost"
              size="icon"
              onClick={(e) => {
                e.stopPropagation()
                e.preventDefault()
                onDelete(item.id)
                setShowMenu(false)
              }}
              className="h-6 w-6 bg-destructive/10 text-destructive hover:bg-destructive hover:text-destructive-foreground"
              title="削除"
            >
              <Trash2 className="h-3 w-3" />
            </Button>
            {onEditCreatedDate && (
              <Button
                variant="ghost"
                size="icon"
                onClick={(e) => {
                  e.stopPropagation()
                  e.preventDefault()
                  onEditCreatedDate(item.id)
                  setShowMenu(false)
                }}
                className="h-6 w-6 bg-muted hover:bg-muted/80"
                title="作成日の編集"
              >
                <CalendarDays className="h-3 w-3" />
              </Button>
            )}
          </div>,
          document.body
        )}
      </TableCell>
      {children}
    </TableRow>
  )
}

/**
 * 科目と色の対応:
 * 
 * 【憲法系（赤系）】
 * - 憲法: bg-red-100 text-red-700
 * - 行政法: bg-rose-100 text-rose-700
 * - 国際関係法（公法系）: bg-pink-100 text-pink-700
 * 
 * 【民事系（青系）】
 * - 民法: bg-blue-100 text-blue-700
 * - 商法: bg-cyan-100 text-cyan-700
 * - 民事訴訟法: bg-sky-100 text-sky-700
 * - 実務基礎（民事）: bg-indigo-100 text-indigo-700
 * - 倒産法: bg-teal-100 text-teal-700
 * - 租税法: bg-blue-200 text-blue-800
 * - 知的財産法: bg-sky-200 text-sky-800
 * - 労働法: bg-indigo-200 text-indigo-800
 * - 国際関係法（私法系）: bg-blue-300 text-blue-900
 * 
 * 【刑事系（緑系）】
 * - 刑法: bg-green-100 text-green-700
 * - 刑事訴訟法: bg-emerald-100 text-emerald-700
 * - 実務基礎（刑事）: bg-lime-100 text-lime-700
 * 
 * 【その他】
 * - 経済法: bg-yellow-100 text-yellow-700
 * - 環境法: bg-amber-100 text-amber-700
 * - 一般教養科目: bg-gray-100 text-gray-700
 */
const SUBJECT_COLORS: Record<string, string> = {
  // 憲法系（赤系）
  "憲法": "bg-red-100 text-red-700",
  "行政法": "bg-rose-100 text-rose-700",
  "国際関係法（公法系）": "bg-pink-100 text-pink-700",

  // 民事系（青系）
  "民法": "bg-blue-100 text-blue-700",
  "商法": "bg-cyan-100 text-cyan-700",
  "民事訴訟法": "bg-sky-100 text-sky-700",
  "実務基礎（民事）": "bg-indigo-100 text-indigo-700",
  "倒産法": "bg-teal-100 text-teal-700",
  "租税法": "bg-blue-200 text-blue-800",
  "知的財産法": "bg-sky-200 text-sky-800",
  "労働法": "bg-indigo-200 text-indigo-800",
  "国際関係法（私法系）": "bg-blue-300 text-blue-900",

  // 刑事系（緑系）
  "刑法": "bg-green-100 text-green-700",
  "刑事訴訟法": "bg-emerald-100 text-emerald-700",
  "実務基礎（刑事）": "bg-lime-100 text-lime-700",

  // その他
  "経済法": "bg-yellow-100 text-yellow-700",
  "環境法": "bg-amber-100 text-amber-700",
  "一般教養科目": "bg-gray-100 text-gray-700",
}

function SubjectPage() {
  const params = useParams()
  const router = useRouter()
  const searchParams = useSearchParams()
  const { isOpen, setIsOpen } = useSidebar()

  // URLパラメータをデコードする関数
  const decodeSubject = (subject: string | string[] | undefined): string | null => {
    if (!subject) return null
    const subjectStr = Array.isArray(subject) ? subject[0] : subject
    try {
      const decoded = decodeURIComponent(subjectStr)
      // 型ガード: FIXED_SUBJECTSに含まれるかチェック
      if (FIXED_SUBJECTS.includes(decoded as typeof FIXED_SUBJECTS[number])) {
        return decoded
      }
    } catch (error) {
      console.error('Failed to decode subject:', error)
    }
    return null
  }

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

  // 初期値を決定: URLパラメータがあればそれをデコード、なければlocalStorageから取得、それもなければ「憲法」
  const getInitialSubject = (): string => {
    const decodedFromUrl = decodeSubject(params.subject)
    if (decodedFromUrl) {
      return decodedFromUrl
    }
    return getDefaultSubject()
  }

  const [selectedSubject, setSelectedSubject] = useState<string>(getInitialSubject())

  // デフォルトは"study"（規範論点）、またはlocalStorageから直近アクセスしたタブを取得。
  // URLクエリ（tab=study|notes）があればそれを優先。
  const getInitialMainTab = (): "study" | "notes" => {
    if (typeof window === 'undefined') return "study"
    try {
      const urlTab = searchParams.get("tab")
      if (urlTab === "study" || urlTab === "notes") {
        return urlTab
      }
      const lastTab = localStorage.getItem('last_main_tab')
      if (lastTab === "study" || lastTab === "notes") {
        return lastTab
      }
    } catch (error) {
      console.error('Failed to load last main tab:', error)
    }
    return "study"
  }

  const [mainTab, setMainTab] = useState<"study" | "notes">(() => {
    // クライアントサイドでのみ実行
    if (typeof window !== 'undefined') {
      return getInitialMainTab()
    }
    return "study"
  })
  const [notebooks, setNotebooks] = useState<NotebookWithSections[]>([])
  const [loadingNotebooks, setLoadingNotebooks] = useState(false)
  const [expandedNotebooks, setExpandedNotebooks] = useState<Set<number>>(new Set())
  const [expandedSections, setExpandedSections] = useState<Set<number>>(new Set())
  
  // ノートブック作成ダイアログ
  const [createNotebookDialogOpen, setCreateNotebookDialogOpen] = useState(false)
  const [newNotebook, setNewNotebook] = useState({ title: "", description: "" })
  const [creatingNotebook, setCreatingNotebook] = useState(false)
  
  // ノートブック編集ダイアログ
  const [editNotebookDialogOpen, setEditNotebookDialogOpen] = useState(false)
  const [editingNotebookId, setEditingNotebookId] = useState<number | null>(null)
  const [editingNotebookData, setEditingNotebookData] = useState({ title: "", description: "" })
  const [updatingNotebook, setUpdatingNotebook] = useState(false)
  
  // セクション作成ダイアログ
  const [createSectionDialogOpen, setCreateSectionDialogOpen] = useState(false)
  const [newSection, setNewSection] = useState({ notebook_id: 0, title: "" })
  const [creatingSection, setCreatingSection] = useState(false)
  
  // セクション編集ダイアログ
  const [editSectionDialogOpen, setEditSectionDialogOpen] = useState(false)
  const [editingSectionId, setEditingSectionId] = useState<number | null>(null)
  const [editingSectionTitle, setEditingSectionTitle] = useState("")
  const [updatingSection, setUpdatingSection] = useState(false)
  
  // ページ作成ダイアログ
  const [createPageDialogOpen, setCreatePageDialogOpen] = useState(false)
  const [newPage, setNewPage] = useState({ section_id: 0, title: "", content: "" })
  const [creatingPage, setCreatingPage] = useState(false)
  
  // ページ編集用
  const [editingPageTitle, setEditingPageTitle] = useState("")
  const [editingPageContent, setEditingPageContent] = useState("")
  const [savingPage, setSavingPage] = useState(false)
  const pageContentTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  
  const getInitialSelectedPageId = (): number | null => {
    if (typeof window === "undefined") return null
    try {
      const raw = searchParams.get("pageId")
      if (!raw) return null
      const n = Number(raw)
      return Number.isFinite(n) ? n : null
    } catch (error) {
      console.error("Failed to load initial pageId:", error)
      return null
    }
  }

  const [selectedPageId, setSelectedPageId] = useState<number | null>(() => getInitialSelectedPageId())
  const [isRightSidebarOpen, setIsRightSidebarOpen] = useState(true)

  // URLクエリと状態を同期（サイドパネルの「直近アクセス」から復元できるようにする）
  useEffect(() => {
    if (typeof window === "undefined") return
    const urlTab = searchParams.get("tab")
    if (urlTab === "study" || urlTab === "notes") {
      setMainTab(urlTab)
    }
    const raw = searchParams.get("pageId")
    if (!raw) {
      setSelectedPageId(null)
    } else {
      const n = Number(raw)
      setSelectedPageId(Number.isFinite(n) ? n : null)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams])


  // 重要度オプション定義
  const IMPORTANCE_OPTIONS = [
    // 重要度は 1〜3 を維持（表示は High〜Low）
    { value: 1, label: "High", color: "bg-pink-600 text-white" },
    { value: 2, label: "Middle", color: "bg-lime-600 text-white" },
    { value: 3, label: "Low", color: "bg-cyan-600 text-white" },
  ]

  // 重要度の表示用関数
  const getImportanceLabel = (importance: number): string => {
    const option = IMPORTANCE_OPTIONS.find(opt => opt.value === importance)
    return option ? option.label : ""
  }

  // 重要度の色取得関数
  const getImportanceColor = (importance: number): string => {
    const option = IMPORTANCE_OPTIONS.find(opt => opt.value === importance)
    return option ? option.color : ""
  }

  // 理解度オプション定義
  const MASTERY_LEVEL_OPTIONS = [
    { value: 1, label: "1", description: "未習得", color: "bg-gray-100 text-gray-700" },
    { value: 2, label: "2", description: "初級", color: "bg-blue-100 text-blue-700" },
    { value: 3, label: "3", description: "中級", color: "bg-yellow-100 text-yellow-700" },
    { value: 4, label: "4", description: "上級", color: "bg-green-100 text-green-700" },
    { value: 5, label: "5", description: "完全習得", color: "bg-purple-100 text-purple-700" },
  ]

  // 理解度の表示用関数
  const getMasteryLevelLabel = (masteryLevel: number | null): string => {
    if (!masteryLevel) return ""
    const option = MASTERY_LEVEL_OPTIONS.find(opt => opt.value === masteryLevel)
    return option ? option.label : ""
  }

  // 理解度の色取得関数
  const getMasteryLevelColor = (masteryLevel: number | null): string => {
    if (!masteryLevel) return ""
    const option = MASTERY_LEVEL_OPTIONS.find(opt => opt.value === masteryLevel)
    return option ? option.color : ""
  }

  const [norms, setNorms] = useState<StudyItem[]>([])
  const [points, setPoints] = useState<StudyItem[]>([])
  const [availableTags, setAvailableTags] = useState<StudyTag[]>([])
  const saveTimeoutRef = useRef<Record<number, number>>({})
  const [importanceFilter, setImportanceFilter] = useState<string>("all") // "all" | "1" | "2" | "3"
  const [masteryFilter, setMasteryFilter] = useState<string>("all") // "all" | "unset" | "1".."5"
  const [tagFilters, setTagFilters] = useState<string[]>([])
  const [tagFilterOpen, setTagFilterOpen] = useState(false)

  type StudyItemApi = {
    id: number
    entry_type: 1 | 2
    subject_id: number
    item: string
    importance: number
    mastery_level: number | null
    content: string
    memo: string | null
    tags: string[]
    created_date: string
    position: number
  }

  const formatCreatedAtMmDd = useCallback((createdDateIso: string): string => {
    try {
      const d = new Date(createdDateIso)
      return d.toLocaleDateString("en-US", { month: "2-digit", day: "2-digit" })
    } catch {
      return new Date().toLocaleDateString("en-US", { month: "2-digit", day: "2-digit" })
    }
  }, [])

  const toUiStudyItem = useCallback((api: StudyItemApi): StudyItem => {
    return {
      id: api.id,
      item: api.item,
      importance: api.importance,
      masteryLevel: api.mastery_level,
      content: api.content,
      memo: api.memo ?? "",
      tags: api.tags ?? [],
      createdAt: formatCreatedAtMmDd(api.created_date),
    }
  }, [formatCreatedAtMmDd])

  const queueUpdateStudyItem = (id: number, patch: Record<string, any>) => {
    const existing = saveTimeoutRef.current[id]
    if (existing) {
      window.clearTimeout(existing)
    }
    saveTimeoutRef.current[id] = window.setTimeout(async () => {
      try {
        await apiClient.put(`/api/study-items/${id}`, patch)
      } catch (e) {
        console.error("Failed to update study item:", e)
      }
    }, 350)
  }

  const deleteStudyTagCandidate = async (tagName: string) => {
    const subjectId = getSubjectId(selectedSubject)
    if (!subjectId) return

    const candidate = availableTags.find((t) => t.subject_id === subjectId && t.name === tagName)
    if (!candidate) return

    try {
      await apiClient.delete(`/api/study-tags/${candidate.id}`)
      setAvailableTags((prev) => prev.filter((t) => t.id !== candidate.id))
    } catch (e) {
      console.error("Failed to delete study tag candidate:", e)
    }
  }

  // タグ管理（既存タグの一覧を取得）
  const getAllTags = (items: StudyItem[]): string[] => {
    const tagSet = new Set<string>()
    items.forEach(item => {
      if (item.tags && Array.isArray(item.tags)) {
        item.tags.forEach(tag => {
          if (tag && typeof tag === 'string') {
            tagSet.add(tag)
          }
        })
      }
    })
    return Array.from(tagSet).sort()
  }

  const filterTagOptions = useMemo(() => {
    const s = new Set<string>()
    for (const t of availableTags) {
      if (t && t.name) s.add(t.name)
    }
    for (const t of getAllTags([...norms, ...points])) {
      s.add(t)
    }
    return Array.from(s).sort()
  }, [availableTags, norms, points])

  const matchesStudyFilters = useCallback((it: StudyItem) => {
    if (importanceFilter !== "all") {
      if (String(it.importance) !== importanceFilter) return false
    }
    if (masteryFilter !== "all") {
      if (masteryFilter === "unset") {
        if (it.masteryLevel != null) return false
      } else {
        if (String(it.masteryLevel ?? "") !== masteryFilter) return false
      }
    }
    if (tagFilters.length > 0) {
      const tags = it.tags || []
      if (!tags.some((t) => tagFilters.includes(t))) return false
    }
    return true
  }, [importanceFilter, masteryFilter, tagFilters])

  const filteredNorms = useMemo(() => norms.filter(matchesStudyFilters), [norms, matchesStudyFilters])
  const filteredPoints = useMemo(() => points.filter(matchesStudyFilters), [points, matchesStudyFilters])

  // 科目別タグ候補を取得（DB）
  useEffect(() => {
    const fetchStudyTags = async () => {
      try {
        const subjectId = getSubjectId(selectedSubject)
        if (!subjectId) {
          setAvailableTags([])
          return
        }
        const tags = await apiClient.get<StudyTag[]>(`/api/study-tags?subject_id=${subjectId}`)
        setAvailableTags(Array.isArray(tags) ? tags : [])
      } catch (e) {
        console.error("Failed to fetch study tags:", e)
        setAvailableTags([])
      }
    }
    fetchStudyTags()
  }, [selectedSubject])

  // タグのPopover状態
  const [tagsPopoverOpen, setTagsPopoverOpen] = useState<Record<number, boolean>>({})
  const [loadingStudyData, setLoadingStudyData] = useState(false)

  // フォールディング状態
  const [normsOpen, setNormsOpen] = useState(true)
  const [pointsOpen, setPointsOpen] = useState(true)

  // 作成日編集用のPopover状態
  const [createdDatePickerOpen, setCreatedDatePickerOpen] = useState<Record<number, boolean>>({})

  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  // 空行の管理（draftRows）
  const [draftNormsRows, setDraftNormsRows] = useState<Record<string, Partial<StudyItem>>>({})
  const [draftPointsRows, setDraftPointsRows] = useState<Record<string, Partial<StudyItem>>>({})

  // 空行数の計算（デフォルト3行、draftRowsも考慮）
  // Dashboardと同じ空行仕様：0件→2行、1件→1行、それ以外→0行
  // ただし本ページは「追加」ボタンでdraft行が増えるため、draft行数も必ず表示対象に含める
  const getEmptyRowsCount = (dataLength: number, draftRowsCount: number) => {
    const baseCount = dataLength === 0 ? 2 : dataLength === 1 ? 1 : 0
    return Math.max(baseCount, draftRowsCount)
  }

  // 空行の配列を生成（draftRowsのキーとインデックスの組み合わせ）
  const emptyNormsRowsCount = getEmptyRowsCount(filteredNorms.length, Object.keys(draftNormsRows).length)
  const emptyNormsRows = Array.from({ length: emptyNormsRowsCount }, (_, i) => {
    const existingKeys = Object.keys(draftNormsRows).filter(key => key.startsWith('norms-'))
    return existingKeys[i] || `norms-${i}`
  })

  const emptyPointsRowsCount = getEmptyRowsCount(filteredPoints.length, Object.keys(draftPointsRows).length)
  const emptyPointsRows = Array.from({ length: emptyPointsRowsCount }, (_, i) => {
    const existingKeys = Object.keys(draftPointsRows).filter(key => key.startsWith('points-'))
    return existingKeys[i] || `points-${i}`
  })

  // 7行を超えたらテーブル内スクロール（元の仕様）
  const getTableMaxHeight = (itemCount: number, emptyCount: number) => {
    const totalRows = itemCount + emptyCount
    const rowHeight = 44
    const headerHeight = 40
    if (totalRows <= 7) return undefined
    return headerHeight + rowHeight * 7
  }

  const normsMaxHeight = getTableMaxHeight(filteredNorms.length, emptyNormsRows.length)
  const pointsMaxHeight = getTableMaxHeight(filteredPoints.length, emptyPointsRows.length)

  // 次のIDを生成（簡易版）
  const getNextId = (items: StudyItem[]) => {
    if (items.length === 0) return 1
    return Math.max(...items.map(item => item.id)) + 1
  }

  // URLパラメータが変更されたときに状態を更新、またはデフォルトで憲法にリダイレクト
  useEffect(() => {
    const decodedSubject = decodeSubject(params.subject)
    if (!decodedSubject) {
      // URLパラメータがない、または無効な場合、デフォルトでlocalStorageから取得または「憲法」にリダイレクト
      const defaultSubject = getDefaultSubject()
      const encodedSubject = encodeURIComponent(defaultSubject)
      router.push(`/your-page/subjects/${encodedSubject}`)
      setSelectedSubject(defaultSubject)
    } else if (decodedSubject !== selectedSubject) {
      setSelectedSubject(decodedSubject)
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

  // ノートブック一覧を取得（セクション・ページを含む3階層）
  const fetchNotebooks = useCallback(async () => {
    setLoadingNotebooks(true)
    try {
      const subjectId = getSubjectId(selectedSubject)
      if (!subjectId) {
        setNotebooks([])
        return
      }
      const notebooksData = await apiClient.get<Notebook[]>(
        `/api/notebooks?subject_id=${subjectId}`
      )
      // 各ノートブックの詳細（セクション・ページを含む）を取得
      const notebooksWithSections = await Promise.all(
        notebooksData.map(async (notebook) => {
          try {
            const detail = await apiClient.get<{ sections: NoteSectionWithPages[] }>(`/api/notebooks/${notebook.id}`)
            return { ...notebook, sections: detail.sections || [] }
          } catch (err) {
            console.error(`Failed to fetch notebook ${notebook.id} details:`, err)
            return { ...notebook, sections: [] }
          }
        })
      )
      setNotebooks(notebooksWithSections)
    } catch (err) {
      console.error("Failed to fetch notebooks:", err)
      setNotebooks([])
    } finally {
      setLoadingNotebooks(false)
    }
  }, [selectedSubject])

  useEffect(() => {
    if (mainTab === "notes") {
      fetchNotebooks()
    } else {
      // My規範・My論点タブの場合は右サイドバーを閉じる
      setIsRightSidebarOpen(false)
    }
  }, [mainTab, selectedSubject, fetchNotebooks])

  // My規範・My論点のデータを取得（DB）
  useEffect(() => {
    if (mainTab === "study") {
      const fetchStudyData = async () => {
        setLoadingStudyData(true)
        try {
          const subjectId = getSubjectId(selectedSubject)
          if (!subjectId) {
            setNorms([])
            setPoints([])
            return
          }

          const [normsData, pointsData] = await Promise.all([
            apiClient.get<StudyItemApi[]>(`/api/study-items?subject_id=${subjectId}&entry_type=1`),
            apiClient.get<StudyItemApi[]>(`/api/study-items?subject_id=${subjectId}&entry_type=2`),
          ])

          setNorms((Array.isArray(normsData) ? normsData : []).map(toUiStudyItem))
          setPoints((Array.isArray(pointsData) ? pointsData : []).map(toUiStudyItem))
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
  }, [mainTab, selectedSubject, toUiStudyItem])

  const handleSubjectChange = (value: string) => {
    setSelectedSubject(value)
    const encodedValue = encodeURIComponent(value)
    // 科目を変えるとpageIdは無効になりうるためクリア。タブだけは引き継ぐ。
    const nextParams = new URLSearchParams(searchParams.toString())
    nextParams.set("tab", mainTab)
    nextParams.delete("pageId")
    router.push(`/your-page/subjects/${encodedValue}?${nextParams.toString()}`)
  }

  // 空行のレンダリング関数（規範用）
  const renderEmptyNormsRow = (rowKey: string | number) => {
    const key = typeof rowKey === 'string' ? rowKey : `norms-${rowKey}`
    const draft = draftNormsRows[key] || {}

    const updateDraft = (field: keyof StudyItem, value: any) => {
      setDraftNormsRows(prev => ({
        ...prev,
        [key]: {
          ...prev[key],
          [field]: value,
        }
      }))
    }

    const hasValidDraft = () => {
      const item = draft.item
      const content = draft.content
      return (item && item.trim() !== '') || (content && content.trim() !== '')
    }

    const confirmDraft = async () => {
      if (!hasValidDraft()) {
        setDraftNormsRows(prev => {
          const newDraft = { ...prev }
          delete newDraft[key]
          return newDraft
        })
        return
      }

      try {
        const subjectId = getSubjectId(selectedSubject)
        if (!subjectId) return
        const created = await apiClient.post<StudyItemApi>("/api/study-items", {
          entry_type: 1,
          subject_id: subjectId,
          item: draft.item || "",
          importance: draft.importance || 1,
          mastery_level: draft.masteryLevel || null,
          content: draft.content || "",
          memo: draft.memo || "",
          tags: draft.tags || [],
        })

        setNorms(prev => [...prev, toUiStudyItem(created)])
        setDraftNormsRows(prev => {
          const newDraft = { ...prev }
          delete newDraft[key]
          return newDraft
        })
      } catch (e) {
        console.error("Failed to create study item:", e)
      }
    }

    const handleBlur = () => {
      confirmDraft()
    }

    const handleKeyDown = (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        confirmDraft()
      }
    }

    return (
      <TableRow key={`empty-norms-${key}`}>
        {/* 操作列（ドラッグ列のダミー） */}
        <TableCell className="py-1.5 px-1 w-6" />
        <TableCell className="text-xs align-top">
          <Input
            value={draft.item || ""}
            onChange={(e) => updateDraft("item", e.target.value)}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
            placeholder="項目を入力..."
            className="h-7 text-xs border-0 shadow-none bg-transparent hover:bg-muted/50 focus:bg-muted/50 focus-visible:ring-0"
          />
        </TableCell>
        <TableCell className="text-xs align-top">
          <Select
            value={draft.importance?.toString() || "1"}
            onValueChange={(value) => updateDraft("importance", parseInt(value))}
            onOpenChange={(open) => {
              if (!open) {
                setTimeout(handleBlur, 100)
              }
            }}
          >
            <SelectTrigger className="h-7 text-[10px] border-0 px-1 w-16">
              {draft.importance ? (
                <span className={`px-1.5 py-0.5 rounded ${getImportanceColor(draft.importance)}`}>
                  {getImportanceLabel(draft.importance)}
                </span>
              ) : (
                <SelectValue placeholder="--" />
              )}
            </SelectTrigger>
            <SelectContent>
              {IMPORTANCE_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value.toString()} className="text-xs">
                  <span className={`px-1.5 py-0.5 rounded ${opt.color}`}>{opt.label}</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </TableCell>
        <TableCell className="text-xs align-top">
          <Select
            value={draft.masteryLevel?.toString() ?? "none"}
            onValueChange={(value) => updateDraft("masteryLevel", value === "none" ? null : parseInt(value))}
            onOpenChange={(open) => {
              if (!open) {
                setTimeout(handleBlur, 100)
              }
            }}
          >
            <SelectTrigger className="h-7 text-[10px] border-0 px-1 w-16">
              {draft.masteryLevel ? (
                <span className={`px-1.5 py-0.5 rounded ${getMasteryLevelColor(draft.masteryLevel)}`}>
                  {getMasteryLevelLabel(draft.masteryLevel)}
                </span>
              ) : (
                <SelectValue placeholder="--" />
              )}
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none" className="text-xs">--</SelectItem>
              {MASTERY_LEVEL_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value.toString()} className="text-xs">
                  <span className={`px-1.5 py-0.5 rounded ${opt.color}`}>{opt.label}</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </TableCell>
        <TableCell className="text-xs align-top">
          <MemoField
            value={draft.content || ""}
            onChange={(e) => updateDraft("content", e.target.value)}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
            placeholder="内容を入力..."
          />
        </TableCell>
        <TableCell className="text-xs align-top">
          <MemoField
            value={draft.memo || ""}
            onChange={(e) => updateDraft("memo", e.target.value)}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
            placeholder="メモを入力..."
          />
        </TableCell>
        <TableCell className="text-xs align-top">
          <span className="text-muted-foreground">--</span>
        </TableCell>
        <TableCell className="text-xs align-top">
          <span className="text-muted-foreground">--</span>
        </TableCell>
      </TableRow>
    )
  }

  // 空行のレンダリング関数（論点用）
  const renderEmptyPointsRow = (rowKey: string | number) => {
    const key = typeof rowKey === 'string' ? rowKey : `points-${rowKey}`
    const draft = draftPointsRows[key] || {}

    const updateDraft = (field: keyof StudyItem, value: any) => {
      setDraftPointsRows(prev => ({
        ...prev,
        [key]: {
          ...prev[key],
          [field]: value,
        }
      }))
    }

    const hasValidDraft = () => {
      const item = draft.item
      const content = draft.content
      return (item && item.trim() !== '') || (content && content.trim() !== '')
    }

    const confirmDraft = async () => {
      if (!hasValidDraft()) {
        setDraftPointsRows(prev => {
          const newDraft = { ...prev }
          delete newDraft[key]
          return newDraft
        })
        return
      }

      try {
        const subjectId = getSubjectId(selectedSubject)
        if (!subjectId) return
        const created = await apiClient.post<StudyItemApi>("/api/study-items", {
          entry_type: 2,
          subject_id: subjectId,
          item: draft.item || "",
          importance: draft.importance || 1,
          mastery_level: draft.masteryLevel || null,
          content: draft.content || "",
          memo: draft.memo || "",
          tags: draft.tags || [],
        })

        setPoints(prev => [...prev, toUiStudyItem(created)])
        setDraftPointsRows(prev => {
          const newDraft = { ...prev }
          delete newDraft[key]
          return newDraft
        })
      } catch (e) {
        console.error("Failed to create study item:", e)
      }
    }

    const handleBlur = () => {
      confirmDraft()
    }

    const handleKeyDown = (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        confirmDraft()
      }
    }

    return (
      <TableRow key={`empty-points-${key}`}>
        {/* 操作列（ドラッグ列のダミー） */}
        <TableCell className="py-1.5 px-1 w-6" />
        <TableCell className="text-xs align-top">
          <Input
            value={draft.item || ""}
            onChange={(e) => updateDraft("item", e.target.value)}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
            placeholder="項目を入力..."
            className="h-7 text-xs border-0 shadow-none bg-transparent hover:bg-muted/50 focus:bg-muted/50 focus-visible:ring-0"
          />
        </TableCell>
        <TableCell className="text-xs align-top">
          <Select
            value={draft.importance?.toString() || "1"}
            onValueChange={(value) => updateDraft("importance", parseInt(value))}
            onOpenChange={(open) => {
              if (!open) {
                setTimeout(handleBlur, 100)
              }
            }}
          >
            <SelectTrigger className="h-7 text-[10px] border-0 px-1 w-16">
              {draft.importance ? (
                <span className={`px-1.5 py-0.5 rounded ${getImportanceColor(draft.importance)}`}>
                  {getImportanceLabel(draft.importance)}
                </span>
              ) : (
                <SelectValue placeholder="--" />
              )}
            </SelectTrigger>
            <SelectContent>
              {IMPORTANCE_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value.toString()} className="text-xs">
                  <span className={`px-1.5 py-0.5 rounded ${opt.color}`}>{opt.label}</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </TableCell>
        <TableCell className="text-xs align-top">
          <Select
            value={draft.masteryLevel?.toString() ?? "none"}
            onValueChange={(value) => updateDraft("masteryLevel", value === "none" ? null : parseInt(value))}
            onOpenChange={(open) => {
              if (!open) {
                setTimeout(handleBlur, 100)
              }
            }}
          >
            <SelectTrigger className="h-7 text-[10px] border-0 px-1 w-16">
              {draft.masteryLevel ? (
                <span className={`px-1.5 py-0.5 rounded ${getMasteryLevelColor(draft.masteryLevel)}`}>
                  {getMasteryLevelLabel(draft.masteryLevel)}
                </span>
              ) : (
                <SelectValue placeholder="--" />
              )}
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none" className="text-xs">--</SelectItem>
              {MASTERY_LEVEL_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value.toString()} className="text-xs">
                  <span className={`px-1.5 py-0.5 rounded ${opt.color}`}>{opt.label}</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </TableCell>
        <TableCell className="text-xs align-top">
          <MemoField
            value={draft.content || ""}
            onChange={(e) => updateDraft("content", e.target.value)}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
            placeholder="内容を入力..."
          />
        </TableCell>
        <TableCell className="text-xs align-top">
          <MemoField
            value={draft.memo || ""}
            onChange={(e) => updateDraft("memo", e.target.value)}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
            placeholder="メモを入力..."
          />
        </TableCell>
        <TableCell className="text-xs align-top">
          <span className="text-muted-foreground">--</span>
        </TableCell>
        <TableCell className="text-xs align-top">
          <span className="text-muted-foreground">--</span>
        </TableCell>
      </TableRow>
    )
  }

  // 行追加関数（空行を追加）
  const addNormsRow = () => {
    const newRowKey = `norms-${Date.now()}-${Math.random()}`
    setDraftNormsRows(prev => ({
      ...prev,
      [newRowKey]: { importance: 1 }
    }))
  }

  const addPointsRow = () => {
    const newRowKey = `points-${Date.now()}-${Math.random()}`
    setDraftPointsRows(prev => ({
      ...prev,
      [newRowKey]: { importance: 1 }
    }))
  }

  // 削除関数
  const deleteNormsItem = (id: number) => {
    setNorms(prev => prev.filter(item => item.id !== id))
    apiClient.delete(`/api/study-items/${id}`).catch((e) => console.error("Failed to delete study item:", e))
  }

  const deletePointsItem = (id: number) => {
    setPoints(prev => prev.filter(item => item.id !== id))
    apiClient.delete(`/api/study-items/${id}`).catch((e) => console.error("Failed to delete study item:", e))
  }

  // ドラッグエンド処理（規範）
  const handleDragEndNorms = (event: DragEndEvent) => {
    const { active, over } = event

    if (over && active.id !== over.id) {
      const oldIndex = norms.findIndex((item) => item.id.toString() === active.id)
      const newIndex = norms.findIndex((item) => item.id.toString() === over.id)

      if (oldIndex !== -1 && newIndex !== -1) {
        const newNorms = arrayMove(norms, oldIndex, newIndex)
        setNorms(newNorms)
        const subjectId = getSubjectId(selectedSubject)
        if (subjectId) {
          apiClient.post("/api/study-items/reorder", {
            subject_id: subjectId,
            entry_type: 1,
            ordered_ids: newNorms.map(n => n.id),
          }).catch((e) => console.error("Failed to reorder study items:", e))
        }
      }
    }
  }

  // ドラッグエンド処理（論点）
  const handleDragEndPoints = (event: DragEndEvent) => {
    const { active, over } = event

    if (over && active.id !== over.id) {
      const oldIndex = points.findIndex((item) => item.id.toString() === active.id)
      const newIndex = points.findIndex((item) => item.id.toString() === over.id)

      if (oldIndex !== -1 && newIndex !== -1) {
        const newPoints = arrayMove(points, oldIndex, newIndex)
        setPoints(newPoints)
        const subjectId = getSubjectId(selectedSubject)
        if (subjectId) {
          apiClient.post("/api/study-items/reorder", {
            subject_id: subjectId,
            entry_type: 2,
            ordered_ids: newPoints.map(p => p.id),
          }).catch((e) => console.error("Failed to reorder study items:", e))
        }
      }
    }
  }

  // 作成日を更新する関数
  const updateCreatedDate = (id: number, date: Date, type: "norms" | "points") => {
    const dateStr = date.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit' })
    const iso = date.toISOString().split("T")[0]
    if (type === "norms") {
      setNorms(prev => prev.map(item => item.id === id ? { ...item, createdAt: dateStr } : item))
    } else {
      setPoints(prev => prev.map(item => item.id === id ? { ...item, createdAt: dateStr } : item))
    }
    queueUpdateStudyItem(id, { created_date: iso })
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

  // ノートブック作成
  const handleCreateNotebook = async () => {
    if (!newNotebook.title.trim()) {
      alert("タイトルを入力してください")
      return
    }

    const subjectId = getSubjectId(selectedSubject)
    if (!subjectId) {
      alert("科目が選択されていません")
      return
    }

    setCreatingNotebook(true)
    try {
      await apiClient.post<Notebook>("/api/notebooks", {
        subject_id: subjectId,
        title: newNotebook.title.trim(),
        description: newNotebook.description.trim() || null,
      })
      await fetchNotebooks()
      setNewNotebook({ title: "", description: "" })
      setCreateNotebookDialogOpen(false)
    } catch (err: any) {
      alert(err?.error || "ノートブックの作成に失敗しました")
    } finally {
      setCreatingNotebook(false)
    }
  }

  // セクション作成
  const handleCreateSection = async () => {
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
      await fetchNotebooks()
      setNewSection({ notebook_id: 0, title: "" })
      setCreateSectionDialogOpen(false)
    } catch (err: any) {
      alert(err?.error || "セクションの作成に失敗しました")
    } finally {
      setCreatingSection(false)
    }
  }

  // ページ作成
  const handleCreatePage = async () => {
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
      await fetchNotebooks()
      setNewPage({ section_id: 0, title: "", content: "" })
      setCreatePageDialogOpen(false)
    } catch (err: any) {
      alert(err?.error || "ページの作成に失敗しました")
    } finally {
      setCreatingPage(false)
    }
  }

  // セクション作成ダイアログを開く
  const openCreateSectionDialog = (notebookId: number) => {
    setNewSection({ notebook_id: notebookId, title: "" })
    setCreateSectionDialogOpen(true)
  }

  // ページ作成ダイアログを開く
  const openCreatePageDialog = (sectionId: number) => {
    setNewPage({ section_id: sectionId, title: "", content: "" })
    setCreatePageDialogOpen(true)
  }

  // ノートブック編集ダイアログを開く
  const openEditNotebookDialog = (notebook: NotebookWithSections) => {
    setEditingNotebookId(notebook.id)
    setEditingNotebookData({ title: notebook.title, description: notebook.description || "" })
    setEditNotebookDialogOpen(true)
  }

  // ノートブック更新
  const handleUpdateNotebook = async () => {
    if (!editingNotebookId || !editingNotebookData.title.trim()) {
      alert("タイトルを入力してください")
      return
    }

    setUpdatingNotebook(true)
    try {
      await apiClient.put(`/api/notebooks/${editingNotebookId}`, {
        title: editingNotebookData.title.trim(),
        description: editingNotebookData.description.trim() || null,
      })
      await fetchNotebooks()
      setEditNotebookDialogOpen(false)
      setEditingNotebookId(null)
    } catch (err: any) {
      alert(err?.error || "ノートブックの更新に失敗しました")
    } finally {
      setUpdatingNotebook(false)
    }
  }

  // ノートブック削除
  const handleDeleteNotebook = async (notebookId: number) => {
    if (!confirm("このノートブックを削除しますか？\nセクションとページもすべて削除されます。")) return

    try {
      await apiClient.delete(`/api/notebooks/${notebookId}`)
      await fetchNotebooks()
    } catch (err: any) {
      alert(err?.error || "ノートブックの削除に失敗しました")
    }
  }

  // セクション編集ダイアログを開く
  const openEditSectionDialog = (section: NoteSectionWithPages) => {
    setEditingSectionId(section.id)
    setEditingSectionTitle(section.title)
    setEditSectionDialogOpen(true)
  }

  // セクション更新
  const handleUpdateSection = async () => {
    if (!editingSectionId || !editingSectionTitle.trim()) {
      alert("セクション名を入力してください")
      return
    }

    setUpdatingSection(true)
    try {
      await apiClient.put(`/api/note-sections/${editingSectionId}`, {
        title: editingSectionTitle.trim(),
      })
      await fetchNotebooks()
      setEditSectionDialogOpen(false)
      setEditingSectionId(null)
    } catch (err: any) {
      alert(err?.error || "セクションの更新に失敗しました")
    } finally {
      setUpdatingSection(false)
    }
  }

  // セクション削除
  const handleDeleteSection = async (sectionId: number) => {
    if (!confirm("このセクションを削除しますか？\nセクション内のページもすべて削除されます。")) return

    try {
      await apiClient.delete(`/api/note-sections/${sectionId}`)
      await fetchNotebooks()
    } catch (err: any) {
      alert(err?.error || "セクションの削除に失敗しました")
    }
  }

  // ページ削除
  const handleDeletePage = async (pageId: number) => {
    if (!confirm("このページを削除しますか？")) return

    try {
      await apiClient.delete(`/api/note-pages/${pageId}`)
      if (selectedPageId === pageId) {
        setSelectedPageId(null)
      }
      await fetchNotebooks()
    } catch (err: any) {
      alert(err?.error || "ページの削除に失敗しました")
    }
  }

  // 選択されたページを取得（3階層対応）
  const selectedPage = notebooks
    .flatMap(nb => nb.sections || [])
    .flatMap(section => section.pages || [])
    .find(page => page.id === selectedPageId)

  // 選択ページが変わったら編集用状態を同期
  useEffect(() => {
    if (selectedPage) {
      setEditingPageTitle(selectedPage.title || "")
      setEditingPageContent(selectedPage.content || "")
    } else {
      setEditingPageTitle("")
      setEditingPageContent("")
    }
  }, [selectedPage?.id]) // selectedPage.id で判定（参照が変わっても同じページなら更新しない）

  // ページ更新（デバウンス付き自動保存）
  const savePageContent = useCallback(async (pageId: number, title: string, content: string) => {
    setSavingPage(true)
    try {
      await apiClient.put(`/api/note-pages/${pageId}`, {
        title: title || null,
        content: content || null,
      })
      // ノートブック一覧を再取得して反映
      await fetchNotebooks()
    } catch (err: any) {
      console.error("Failed to save page:", err)
    } finally {
      setSavingPage(false)
    }
  }, [fetchNotebooks])

  // タイトル変更時（フォーカスアウトで保存）
  const handlePageTitleBlur = () => {
    if (!selectedPage) return
    if (editingPageTitle !== (selectedPage.title || "")) {
      savePageContent(selectedPage.id, editingPageTitle, editingPageContent)
    }
  }

  // コンテンツ変更時（デバウンス自動保存）
  const handlePageContentChange = (newContent: string) => {
    setEditingPageContent(newContent)
    
    // 既存のタイマーをクリア
    if (pageContentTimeoutRef.current) {
      clearTimeout(pageContentTimeoutRef.current)
    }
    
    // 1秒後に自動保存
    pageContentTimeoutRef.current = setTimeout(() => {
      if (selectedPage) {
        savePageContent(selectedPage.id, editingPageTitle, newContent)
      }
    }, 1000)
  }

  // note_pageの直近アクセス履歴（最大5件）をlocalStorageに保存
  useEffect(() => {
    if (typeof window === "undefined") return
    if (mainTab !== "notes") return
    if (!selectedSubject) return
    if (!selectedPageId) return
    if (!selectedPage) return

    try {
      const historyKey = "recent_note_pages"
      const historyStr = localStorage.getItem(historyKey)
      const history: Array<{ subject: string; pageId: number; title: string; timestamp: number }> = historyStr
        ? JSON.parse(historyStr)
        : []

      const title = selectedPage.title || "無題"
      const filtered = history.filter(item => !(item.subject === selectedSubject && item.pageId === selectedPageId))
      const next = [{ subject: selectedSubject, pageId: selectedPageId, title, timestamp: Date.now() }, ...filtered].slice(0, 5)
      localStorage.setItem(historyKey, JSON.stringify(next))
    } catch (error) {
      console.error("Failed to save recent note page:", error)
    }
  }, [mainTab, selectedSubject, selectedPageId, selectedPage])

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
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <StickyNote className="h-4 w-4 text-amber-600" />
              <h1 className="text-base font-semibold text-amber-900">Your Note</h1>
            </div>
            <div className="flex items-center gap-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className={cn(
                    "flex items-center gap-1.5 text-xs transition-colors px-2 py-1 rounded-md hover:opacity-80",
                    SUBJECT_COLORS[selectedSubject] || "bg-amber-100 text-amber-900"
                  )}>
                    <span>{selectedSubject}</span>
                    <ChevronDown className="h-3.5 w-3.5" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" side="bottom" className="w-32">
                  {FIXED_SUBJECTS.map((subject) => (
                    <DropdownMenuItem
                      key={subject}
                      onClick={() => handleSubjectChange(subject)}
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
              <Tabs value={mainTab} onValueChange={(v) => {
                if (v === "study" || v === "notes") {
                  setMainTab(v)
                  // localStorageに保存
                  try {
                    localStorage.setItem('last_main_tab', v)
                  } catch (error) {
                    console.error('Failed to save last main tab:', error)
                  }
                  // URLにも同期（notes以外ではpageIdを外す）
                  try {
                    const params = new URLSearchParams(searchParams.toString())
                    params.set("tab", v)
                    if (v !== "notes") params.delete("pageId")
                    const encodedSubject = encodeURIComponent(selectedSubject)
                    router.replace(`/your-page/subjects/${encodedSubject}?${params.toString()}`)
                  } catch (error) {
                    console.error("Failed to sync tab to URL:", error)
                  }
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
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-20 py-4 max-w-6xl">
        <Card className="shadow-sm border-amber-200/60">
          <CardContent className="p-4">
            {/* My規範・My論点 */}
            {mainTab === "study" && (
              <div className="space-y-6">
                {/* フィルター（重要度・理解度・タグ） */}
                <div className="border border-amber-200/60 rounded-lg p-3 bg-white/60">
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="text-xs font-semibold text-amber-900/80">フィルター</div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">重要度</span>
                      <Select value={importanceFilter} onValueChange={setImportanceFilter}>
                        <SelectTrigger className="h-7 text-xs w-28">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all" className="text-xs">すべて</SelectItem>
                          {IMPORTANCE_OPTIONS.map((opt) => (
                            <SelectItem key={opt.value} value={String(opt.value)} className="text-xs">
                              <span className={`px-1.5 py-0.5 rounded ${opt.color}`}>{opt.label}</span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">理解度</span>
                      <Select value={masteryFilter} onValueChange={setMasteryFilter}>
                        <SelectTrigger className="h-7 text-xs w-28">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all" className="text-xs">すべて</SelectItem>
                          <SelectItem value="unset" className="text-xs">未設定</SelectItem>
                          {MASTERY_LEVEL_OPTIONS.map((opt) => (
                            <SelectItem key={opt.value} value={String(opt.value)} className="text-xs">
                              <span className={`px-1.5 py-0.5 rounded ${opt.color}`}>{opt.label}</span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">タグ</span>
                      <Popover open={tagFilterOpen} onOpenChange={setTagFilterOpen}>
                        <PopoverTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-7 text-xs px-2 hover:bg-muted/50">
                            {tagFilters.length > 0 ? (
                              <span className="truncate max-w-[160px]">
                                {tagFilters.slice(0, 3).join(", ")}
                                {tagFilters.length > 3 && ` +${tagFilters.length - 3}`}
                              </span>
                            ) : (
                              "すべて"
                            )}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-64 p-3" align="start">
                          <div className="space-y-2">
                            <div className="text-xs font-semibold">タグで絞り込み</div>
                            <div className="max-h-48 overflow-y-auto space-y-2">
                              {filterTagOptions.length === 0 ? (
                                <div className="text-xs text-muted-foreground">タグがありません</div>
                              ) : (
                                filterTagOptions.map((tag) => (
                                  <div key={tag} className="flex items-center space-x-2">
                                    <Checkbox
                                      id={`filter-tag-${tag}`}
                                      checked={tagFilters.includes(tag)}
                                      onCheckedChange={(checked: boolean) => {
                                        setTagFilters((prev) =>
                                          checked ? [...prev, tag] : prev.filter((t) => t !== tag)
                                        )
                                      }}
                                    />
                                    <label htmlFor={`filter-tag-${tag}`} className="text-xs cursor-pointer flex-1">
                                      {tag}
                                    </label>
                                  </div>
                                ))
                              )}
                            </div>
                          </div>
                        </PopoverContent>
                      </Popover>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 text-xs"
                      onClick={() => {
                        setImportanceFilter("all")
                        setMasteryFilter("all")
                        setTagFilters([])
                      }}
                    >
                      クリア
                    </Button>
                  </div>
                </div>

                {/* 規範一覧 */}
                <div className="border border-amber-200/60 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <BookOpen className="h-4 w-4 text-amber-600" />
                      <h3 className="text-sm font-semibold text-amber-900/80">規範一覧</h3>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 text-xs"
                        onClick={addNormsRow}
                      >
                        <Plus className="h-3 w-3 mr-1" />
                        追加
                      </Button>
                      <Collapsible open={normsOpen} onOpenChange={setNormsOpen}>
                        <CollapsibleTrigger asChild>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 w-7 text-xs p-0"
                          >
                            <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", normsOpen && "rotate-180")} />
                          </Button>
                        </CollapsibleTrigger>
                      </Collapsible>
                    </div>
                  </div>
                  <Collapsible open={normsOpen} onOpenChange={setNormsOpen}>
                    <CollapsibleContent>
                      {loadingStudyData ? (
                        <div className="text-xs text-muted-foreground text-center py-8">
                          読み込み中...
                        </div>
                      ) : (
                        <DndContext
                          sensors={sensors}
                          collisionDetection={closestCenter}
                          onDragEnd={handleDragEndNorms}
                        >
                          <div
                            className="overflow-x-auto overflow-y-auto"
                            style={normsMaxHeight ? { maxHeight: normsMaxHeight } : undefined}
                          >
                            <Table className="min-w-[980px] table-fixed">
                              {/* 列幅は % だとズレやすいので、pxベースで固定 */}
                              <colgroup>
                                <col className="w-6" />          {/* 操作 */}
                                <col className="w-[180px]" />    {/* 項目 */}
                                <col className="w-[92px]" />     {/* 重要度 */}
                                <col className="w-[92px]" />     {/* 理解度 */}
                                <col className="w-[420px]" />    {/* 内容 */}
                                <col className="w-[260px]" />    {/* メモ */}
                                <col className="w-[140px]" />    {/* タグ */}
                                <col className="w-[96px]" />     {/* 作成日 */}
                              </colgroup>
                              <TableHeader>
                                <TableRow>
                                  <TableHead className="w-6 sticky top-0 bg-white z-10"></TableHead>
                                  <TableHead className="text-xs font-semibold text-amber-900/80 sticky top-0 bg-white z-10">項目</TableHead>
                                  <TableHead className="text-xs font-semibold text-amber-900/80 sticky top-0 bg-white z-10">重要度</TableHead>
                                  <TableHead className="text-xs font-semibold text-amber-900/80 sticky top-0 bg-white z-10">理解度</TableHead>
                                  <TableHead className="text-xs font-semibold text-amber-900/80 sticky top-0 bg-white z-10">内容</TableHead>
                                  <TableHead className="text-xs font-semibold text-amber-900/80 sticky top-0 bg-white z-10">メモ</TableHead>
                                  <TableHead className="text-xs font-semibold text-amber-900/80 sticky top-0 bg-white z-10">タグ</TableHead>
                                  <TableHead className="text-xs font-semibold text-amber-900/80 sticky top-0 bg-white z-10">作成日</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                <SortableContext
                                  items={filteredNorms.length > 0 ? filteredNorms.map(n => n.id.toString()) : []}
                                  strategy={verticalListSortingStrategy}
                                >
                                  {filteredNorms.map((norm) => {
                                    const normTags = norm.tags || []
                                    const allTags = Array.from(new Set([...(availableTags.map(t => t.name)), ...normTags])).sort()
                                    return (
                                      <SortableRow
                                        key={norm.id}
                                        item={norm}
                                        onDelete={deleteNormsItem}
                                        onEditCreatedDate={(id) => {
                                          setCreatedDatePickerOpen(prev => ({ ...prev, [id]: true }))
                                        }}
                                      >
                                        {/* 項目：確定後も編集可能（Dashboard仕様に合わせる） */}
                                        <TableCell className="text-xs align-top">
                                          <Input
                                            value={norm.item}
                                            onChange={(e) => {
                                              const v = e.target.value
                                              setNorms(prev => prev.map(n => n.id === norm.id ? { ...n, item: v } : n))
                                              queueUpdateStudyItem(norm.id, { item: v })
                                            }}
                                            placeholder="項目を入力..."
                                            className="h-7 text-xs border-0 shadow-none bg-transparent hover:bg-muted/50 focus:bg-muted/50 focus-visible:ring-0"
                                          />
                                        </TableCell>
                                        <TableCell className="text-xs align-top">
                                          <Select
                                            value={norm.importance.toString()}
                                            onValueChange={(value) => {
                                              const v = parseInt(value)
                                              const updatedNorms = norms.map(n =>
                                                n.id === norm.id ? { ...n, importance: v } : n
                                              )
                                              setNorms(updatedNorms)
                                              queueUpdateStudyItem(norm.id, { importance: v })
                                            }}
                                          >
                                            <SelectTrigger className="h-7 text-[10px] border-0 px-1 w-16">
                                              {norm.importance ? (
                                                <span className={`px-1.5 py-0.5 rounded ${getImportanceColor(norm.importance)}`}>
                                                  {getImportanceLabel(norm.importance)}
                                                </span>
                                              ) : (
                                                <SelectValue placeholder="--" />
                                              )}
                                            </SelectTrigger>
                                            <SelectContent>
                                              {IMPORTANCE_OPTIONS.map((opt) => (
                                                <SelectItem key={opt.value} value={opt.value.toString()} className="text-xs">
                                                  <span className={`px-1.5 py-0.5 rounded ${opt.color}`}>{opt.label}</span>
                                                </SelectItem>
                                              ))}
                                            </SelectContent>
                                          </Select>
                                        </TableCell>
                                        <TableCell className="text-xs align-top">
                                          <Select
                                            value={norm.masteryLevel?.toString() ?? "none"}
                                            onValueChange={(value) => {
                                              const v = value === "none" ? null : parseInt(value)
                                              const updatedNorms = norms.map(n =>
                                                n.id === norm.id ? { ...n, masteryLevel: v } : n
                                              )
                                              setNorms(updatedNorms)
                                              queueUpdateStudyItem(norm.id, { mastery_level: v })
                                            }}
                                          >
                                            <SelectTrigger className="h-7 text-[10px] border-0 px-1 w-16">
                                              {norm.masteryLevel ? (
                                                <span className={`px-1.5 py-0.5 rounded ${getMasteryLevelColor(norm.masteryLevel)}`}>
                                                  {getMasteryLevelLabel(norm.masteryLevel)}
                                                </span>
                                              ) : (
                                                <SelectValue placeholder="--" />
                                              )}
                                            </SelectTrigger>
                                            <SelectContent>
                                              <SelectItem value="none" className="text-xs">--</SelectItem>
                                              {MASTERY_LEVEL_OPTIONS.map((opt) => (
                                                <SelectItem key={opt.value} value={opt.value.toString()} className="text-xs">
                                                  <span className={`px-1.5 py-0.5 rounded ${opt.color}`}>{opt.label}</span>
                                                </SelectItem>
                                              ))}
                                            </SelectContent>
                                          </Select>
                                        </TableCell>
                                        {/* 内容/メモ：入力時は最大5行、表示時は1〜3行（Dashboardと同じ） */}
                                        <TableCell className="text-xs align-top">
                                          <MemoField
                                            value={norm.content}
                                            onChange={(e) => {
                                              const v = e.target.value
                                              setNorms(prev => prev.map(n => n.id === norm.id ? { ...n, content: v } : n))
                                              queueUpdateStudyItem(norm.id, { content: v })
                                            }}
                                            placeholder="内容を入力..."
                                          />
                                        </TableCell>
                                        <TableCell className="text-xs align-top">
                                          <MemoField
                                            value={norm.memo}
                                            onChange={(e) => {
                                              const v = e.target.value
                                              setNorms(prev => prev.map(n => n.id === norm.id ? { ...n, memo: v } : n))
                                              queueUpdateStudyItem(norm.id, { memo: v })
                                            }}
                                            placeholder="メモを入力..."
                                          />
                                        </TableCell>
                                        <TableCell className="text-xs align-top">
                                          <Popover
                                            open={tagsPopoverOpen[norm.id] || false}
                                            onOpenChange={(open) => {
                                              setTagsPopoverOpen(prev => ({ ...prev, [norm.id]: open }))
                                            }}
                                          >
                                            <PopoverTrigger asChild>
                                              <Button
                                                variant="ghost"
                                                size="sm"
                                                className="h-7 text-xs px-2 hover:bg-muted/50"
                                              >
                                                {normTags.length > 0 ? (
                                                  <span className="truncate max-w-[80px]">
                                                    {normTags.slice(0, 2).join(", ")}
                                                    {normTags.length > 2 && ` +${normTags.length - 2}`}
                                                  </span>
                                                ) : (
                                                  "タグを選択"
                                                )}
                                              </Button>
                                            </PopoverTrigger>
                                            <PopoverContent className="w-64 p-3" align="start">
                                              <div className="space-y-2">
                                                <div className="text-xs font-semibold mb-2">タグを選択</div>
                                                <div className="max-h-48 overflow-y-auto space-y-2">
                                                  {allTags.length === 0 ? (
                                                    <div className="text-xs text-muted-foreground">タグがありません</div>
                                                  ) : (
                                                    allTags.map((tag) => (
                                                      <div key={tag} className="flex items-center space-x-2">
                                                        <Checkbox
                                                          id={`tag-${norm.id}-${tag}`}
                                                          checked={normTags.includes(tag)}
                                                          onCheckedChange={(checked: boolean) => {
                                                            const updatedTags = checked
                                                              ? [...normTags, tag]
                                                              : normTags.filter(t => t !== tag)
                                                            const updatedNorms = norms.map(n =>
                                                              n.id === norm.id ? { ...n, tags: updatedTags } : n
                                                            )
                                                            setNorms(updatedNorms)
                                                            queueUpdateStudyItem(norm.id, { tags: updatedTags })
                                                          }}
                                                        />
                                                        <label
                                                          htmlFor={`tag-${norm.id}-${tag}`}
                                                          className="text-xs cursor-pointer flex-1"
                                                        >
                                                          {tag}
                                                        </label>
                                                        {availableTags.some((t) => t.subject_id === getSubjectId(selectedSubject) && t.name === tag) && (
                                                          <button
                                                            type="button"
                                                            className="p-1 rounded hover:bg-muted"
                                                            title="候補から削除"
                                                            onClick={(e) => {
                                                              e.preventDefault()
                                                              e.stopPropagation()
                                                              deleteStudyTagCandidate(tag)
                                                            }}
                                                          >
                                                            <Trash2 className="h-3 w-3 text-muted-foreground" />
                                                          </button>
                                                        )}
                                                      </div>
                                                    ))
                                                  )}
                                                </div>
                                                <Input
                                                  placeholder="新規タグを追加..."
                                                  className="h-7 text-xs mt-2"
                                                  onKeyDown={(e) => {
                                                    if (e.key === 'Enter') {
                                                      const input = e.currentTarget
                                                      const newTag = input.value.trim()
                                                      if (newTag && !normTags.includes(newTag)) {
                                                        // DBにも登録（科目別タグ候補）
                                                        const subjectId = getSubjectId(selectedSubject)
                                                        if (subjectId) {
                                                          apiClient.post<StudyTag>("/api/study-tags", { subject_id: subjectId, name: newTag })
                                                            .then((created) => {
                                                              setAvailableTags(prev => {
                                                                if (prev.some(t => t.id === created.id)) return prev
                                                                return [...prev, created].sort((a, b) => a.name.localeCompare(b.name))
                                                              })
                                                            })
                                                            .catch((err) => console.error("Failed to create study tag:", err))
                                                        }
                                                        const updatedNorms = norms.map(n =>
                                                          n.id === norm.id ? { ...n, tags: [...normTags, newTag] } : n
                                                        )
                                                        setNorms(updatedNorms)
                                                        queueUpdateStudyItem(norm.id, { tags: [...normTags, newTag] })
                                                        input.value = ""
                                                      }
                                                    }
                                                  }}
                                                />
                                              </div>
                                            </PopoverContent>
                                          </Popover>
                                        </TableCell>
                                        <TableCell className="text-xs align-top">
                                          <Popover
                                            open={createdDatePickerOpen[norm.id] || false}
                                            onOpenChange={(open) => {
                                              setCreatedDatePickerOpen(prev => ({ ...prev, [norm.id]: open }))
                                            }}
                                          >
                                            <PopoverTrigger asChild>
                                              <Button
                                                variant="ghost"
                                                size="sm"
                                                className="h-7 text-xs px-2 hover:bg-muted/50"
                                              >
                                                {norm.createdAt}
                                              </Button>
                                            </PopoverTrigger>
                                            <PopoverContent className="w-auto p-3" align="start">
                                              <DatePickerCalendar
                                                selectedDate={norm.createdAt ? (() => {
                                                  const [month, day] = norm.createdAt.split('/')
                                                  const currentYear = new Date().getFullYear()
                                                  return new Date(currentYear, parseInt(month) - 1, parseInt(day))
                                                })() : null}
                                                onSelect={(date) => {
                                                  if (date) {
                                                    updateCreatedDate(norm.id, date, "norms")
                                                    setCreatedDatePickerOpen(prev => ({ ...prev, [norm.id]: false }))
                                                  }
                                                }}
                                              />
                                            </PopoverContent>
                                          </Popover>
                                        </TableCell>
                                      </SortableRow>
                                    )
                                  })}
                                </SortableContext>
                                {emptyNormsRows.map((index) => renderEmptyNormsRow(index))}
                              </TableBody>
                            </Table>
                          </div>
                        </DndContext>
                      )}
                    </CollapsibleContent>
                  </Collapsible>
                </div>

                {/* 論点一覧 */}
                <div className="border border-amber-200/60 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-amber-600" />
                      <h3 className="text-sm font-semibold text-amber-900/80">論点一覧</h3>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 text-xs"
                        onClick={addPointsRow}
                      >
                        <Plus className="h-3 w-3 mr-1" />
                        追加
                      </Button>
                      <Collapsible open={pointsOpen} onOpenChange={setPointsOpen}>
                        <CollapsibleTrigger asChild>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 w-7 text-xs p-0"
                          >
                            <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", pointsOpen && "rotate-180")} />
                          </Button>
                        </CollapsibleTrigger>
                      </Collapsible>
                    </div>
                  </div>
                  <Collapsible open={pointsOpen} onOpenChange={setPointsOpen}>
                    <CollapsibleContent>
                      {loadingStudyData ? (
                        <div className="text-xs text-muted-foreground text-center py-8">
                          読み込み中...
                        </div>
                      ) : (
                        <DndContext
                          sensors={sensors}
                          collisionDetection={closestCenter}
                          onDragEnd={handleDragEndPoints}
                        >
                          <div
                            className="overflow-x-auto overflow-y-auto"
                            style={pointsMaxHeight ? { maxHeight: pointsMaxHeight } : undefined}
                          >
                            <Table className="min-w-[980px] table-fixed">
                              <colgroup>
                                <col className="w-6" />
                                <col className="w-[180px]" />
                                <col className="w-[92px]" />
                                <col className="w-[92px]" />
                                <col className="w-[420px]" />
                                <col className="w-[260px]" />
                                <col className="w-[140px]" />
                                <col className="w-[96px]" />
                              </colgroup>
                              <TableHeader>
                                <TableRow>
                                  <TableHead className="w-6 sticky top-0 bg-white z-10"></TableHead>
                                  <TableHead className="text-xs font-semibold text-amber-900/80 sticky top-0 bg-white z-10">項目</TableHead>
                                  <TableHead className="text-xs font-semibold text-amber-900/80 sticky top-0 bg-white z-10">重要度</TableHead>
                                  <TableHead className="text-xs font-semibold text-amber-900/80 sticky top-0 bg-white z-10">理解度</TableHead>
                                  <TableHead className="text-xs font-semibold text-amber-900/80 sticky top-0 bg-white z-10">内容</TableHead>
                                  <TableHead className="text-xs font-semibold text-amber-900/80 sticky top-0 bg-white z-10">メモ</TableHead>
                                  <TableHead className="text-xs font-semibold text-amber-900/80 sticky top-0 bg-white z-10">タグ</TableHead>
                                  <TableHead className="text-xs font-semibold text-amber-900/80 sticky top-0 bg-white z-10">作成日</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                <SortableContext
                                  items={filteredPoints.length > 0 ? filteredPoints.map(p => p.id.toString()) : []}
                                  strategy={verticalListSortingStrategy}
                                >
                                  {filteredPoints.map((point) => {
                                    const pointTags = point.tags || []
                                    const allTags = Array.from(new Set([...(availableTags.map(t => t.name)), ...pointTags])).sort()
                                    return (
                                      <SortableRow
                                        key={point.id}
                                        item={point}
                                        onDelete={deletePointsItem}
                                        onEditCreatedDate={(id) => {
                                          setCreatedDatePickerOpen(prev => ({ ...prev, [id]: true }))
                                        }}
                                      >
                                        {/* 項目：確定後も編集可能（Dashboard仕様に合わせる） */}
                                        <TableCell className="text-xs align-top">
                                          <Input
                                            value={point.item}
                                            onChange={(e) => {
                                              const v = e.target.value
                                              setPoints(prev => prev.map(p => p.id === point.id ? { ...p, item: v } : p))
                                              queueUpdateStudyItem(point.id, { item: v })
                                            }}
                                            placeholder="項目を入力..."
                                            className="h-7 text-xs border-0 shadow-none bg-transparent hover:bg-muted/50 focus:bg-muted/50 focus-visible:ring-0"
                                          />
                                        </TableCell>
                                        <TableCell className="text-xs align-top">
                                          <Select
                                            value={point.importance.toString()}
                                            onValueChange={(value) => {
                                              const v = parseInt(value)
                                              const updatedPoints = points.map(p =>
                                                p.id === point.id ? { ...p, importance: v } : p
                                              )
                                              setPoints(updatedPoints)
                                              queueUpdateStudyItem(point.id, { importance: v })
                                            }}
                                          >
                                            <SelectTrigger className="h-7 text-[10px] border-0 px-1 w-16">
                                              {point.importance ? (
                                                <span className={`px-1.5 py-0.5 rounded ${getImportanceColor(point.importance)}`}>
                                                  {getImportanceLabel(point.importance)}
                                                </span>
                                              ) : (
                                                <SelectValue placeholder="--" />
                                              )}
                                            </SelectTrigger>
                                            <SelectContent>
                                              {IMPORTANCE_OPTIONS.map((opt) => (
                                                <SelectItem key={opt.value} value={opt.value.toString()} className="text-xs">
                                                  <span className={`px-1.5 py-0.5 rounded ${opt.color}`}>{opt.label}</span>
                                                </SelectItem>
                                              ))}
                                            </SelectContent>
                                          </Select>
                                        </TableCell>
                                        <TableCell className="text-xs align-top">
                                          <Select
                                            value={point.masteryLevel?.toString() ?? "none"}
                                            onValueChange={(value) => {
                                              const v = value === "none" ? null : parseInt(value)
                                              const updatedPoints = points.map(p =>
                                                p.id === point.id ? { ...p, masteryLevel: v } : p
                                              )
                                              setPoints(updatedPoints)
                                              queueUpdateStudyItem(point.id, { mastery_level: v })
                                            }}
                                          >
                                            <SelectTrigger className="h-7 text-[10px] border-0 px-1 w-16">
                                              {point.masteryLevel ? (
                                                <span className={`px-1.5 py-0.5 rounded ${getMasteryLevelColor(point.masteryLevel)}`}>
                                                  {getMasteryLevelLabel(point.masteryLevel)}
                                                </span>
                                              ) : (
                                                <SelectValue placeholder="--" />
                                              )}
                                            </SelectTrigger>
                                            <SelectContent>
                                              <SelectItem value="none" className="text-xs">--</SelectItem>
                                              {MASTERY_LEVEL_OPTIONS.map((opt) => (
                                                <SelectItem key={opt.value} value={opt.value.toString()} className="text-xs">
                                                  <span className={`px-1.5 py-0.5 rounded ${opt.color}`}>{opt.label}</span>
                                                </SelectItem>
                                              ))}
                                            </SelectContent>
                                          </Select>
                                        </TableCell>
                                        {/* 内容/メモ：入力時は最大5行、表示時は1〜3行（Dashboardと同じ） */}
                                        <TableCell className="text-xs align-top">
                                          <MemoField
                                            value={point.content}
                                            onChange={(e) => {
                                              const v = e.target.value
                                              setPoints(prev => prev.map(p => p.id === point.id ? { ...p, content: v } : p))
                                              queueUpdateStudyItem(point.id, { content: v })
                                            }}
                                            placeholder="内容を入力..."
                                          />
                                        </TableCell>
                                        <TableCell className="text-xs align-top">
                                          <MemoField
                                            value={point.memo}
                                            onChange={(e) => {
                                              const v = e.target.value
                                              setPoints(prev => prev.map(p => p.id === point.id ? { ...p, memo: v } : p))
                                              queueUpdateStudyItem(point.id, { memo: v })
                                            }}
                                            placeholder="メモを入力..."
                                          />
                                        </TableCell>
                                        <TableCell className="text-xs align-top">
                                          <Popover
                                            open={tagsPopoverOpen[point.id] || false}
                                            onOpenChange={(open) => {
                                              setTagsPopoverOpen(prev => ({ ...prev, [point.id]: open }))
                                            }}
                                          >
                                            <PopoverTrigger asChild>
                                              <Button
                                                variant="ghost"
                                                size="sm"
                                                className="h-7 text-xs px-2 hover:bg-muted/50"
                                              >
                                                {pointTags.length > 0 ? (
                                                  <span className="truncate max-w-[80px]">
                                                    {pointTags.slice(0, 2).join(", ")}
                                                    {pointTags.length > 2 && ` +${pointTags.length - 2}`}
                                                  </span>
                                                ) : (
                                                  "タグを選択"
                                                )}
                                              </Button>
                                            </PopoverTrigger>
                                            <PopoverContent className="w-64 p-3" align="start">
                                              <div className="space-y-2">
                                                <div className="text-xs font-semibold mb-2">タグを選択</div>
                                                <div className="max-h-48 overflow-y-auto space-y-2">
                                                  {allTags.length === 0 ? (
                                                    <div className="text-xs text-muted-foreground">タグがありません</div>
                                                  ) : (
                                                    allTags.map((tag) => (
                                                      <div key={tag} className="flex items-center space-x-2">
                                                        <Checkbox
                                                          id={`tag-${point.id}-${tag}`}
                                                          checked={pointTags.includes(tag)}
                                                          onCheckedChange={(checked: boolean) => {
                                                            const updatedTags = checked
                                                              ? [...pointTags, tag]
                                                              : pointTags.filter(t => t !== tag)
                                                            const updatedPoints = points.map(p =>
                                                              p.id === point.id ? { ...p, tags: updatedTags } : p
                                                            )
                                                            setPoints(updatedPoints)
                                                            queueUpdateStudyItem(point.id, { tags: updatedTags })
                                                          }}
                                                        />
                                                        <label
                                                          htmlFor={`tag-${point.id}-${tag}`}
                                                          className="text-xs cursor-pointer flex-1"
                                                        >
                                                          {tag}
                                                        </label>
                                                        {availableTags.some((t) => t.subject_id === getSubjectId(selectedSubject) && t.name === tag) && (
                                                          <button
                                                            type="button"
                                                            className="p-1 rounded hover:bg-muted"
                                                            title="候補から削除"
                                                            onClick={(e) => {
                                                              e.preventDefault()
                                                              e.stopPropagation()
                                                              deleteStudyTagCandidate(tag)
                                                            }}
                                                          >
                                                            <Trash2 className="h-3 w-3 text-muted-foreground" />
                                                          </button>
                                                        )}
                                                      </div>
                                                    ))
                                                  )}
                                                </div>
                                                <Input
                                                  placeholder="新規タグを追加..."
                                                  className="h-7 text-xs mt-2"
                                                  onKeyDown={(e) => {
                                                    if (e.key === 'Enter') {
                                                      const input = e.currentTarget
                                                      const newTag = input.value.trim()
                                                      if (newTag && !pointTags.includes(newTag)) {
                                                        // DBにも登録（科目別タグ候補）
                                                        const subjectId = getSubjectId(selectedSubject)
                                                        if (subjectId) {
                                                          apiClient.post<StudyTag>("/api/study-tags", { subject_id: subjectId, name: newTag })
                                                            .then((created) => {
                                                              setAvailableTags(prev => {
                                                                if (prev.some(t => t.id === created.id)) return prev
                                                                return [...prev, created].sort((a, b) => a.name.localeCompare(b.name))
                                                              })
                                                            })
                                                            .catch((err) => console.error("Failed to create study tag:", err))
                                                        }
                                                        const updatedPoints = points.map(p =>
                                                          p.id === point.id ? { ...p, tags: [...pointTags, newTag] } : p
                                                        )
                                                        setPoints(updatedPoints)
                                                        queueUpdateStudyItem(point.id, { tags: [...pointTags, newTag] })
                                                        input.value = ""
                                                      }
                                                    }
                                                  }}
                                                />
                                              </div>
                                            </PopoverContent>
                                          </Popover>
                                        </TableCell>
                                        <TableCell className="text-xs align-top">
                                          <Popover
                                            open={createdDatePickerOpen[point.id] || false}
                                            onOpenChange={(open) => {
                                              setCreatedDatePickerOpen(prev => ({ ...prev, [point.id]: open }))
                                            }}
                                          >
                                            <PopoverTrigger asChild>
                                              <Button
                                                variant="ghost"
                                                size="sm"
                                                className="h-7 text-xs px-2 hover:bg-muted/50"
                                              >
                                                {point.createdAt}
                                              </Button>
                                            </PopoverTrigger>
                                            <PopoverContent className="w-auto p-3" align="start">
                                              <DatePickerCalendar
                                                selectedDate={point.createdAt ? (() => {
                                                  const [month, day] = point.createdAt.split('/')
                                                  const currentYear = new Date().getFullYear()
                                                  return new Date(currentYear, parseInt(month) - 1, parseInt(day))
                                                })() : null}
                                                onSelect={(date) => {
                                                  if (date) {
                                                    updateCreatedDate(point.id, date, "points")
                                                    setCreatedDatePickerOpen(prev => ({ ...prev, [point.id]: false }))
                                                  }
                                                }}
                                              />
                                            </PopoverContent>
                                          </Popover>
                                        </TableCell>
                                      </SortableRow>
                                    )
                                  })}
                                </SortableContext>
                                {emptyPointsRows.map((index) => renderEmptyPointsRow(index))}
                              </TableBody>
                            </Table>
                          </div>
                        </DndContext>
                      )}
                    </CollapsibleContent>
                  </Collapsible>
                </div>
              </div>
            )}

            {/* ノートタブ */}
            {mainTab === "notes" && (
              <div className="flex flex-col h-[calc(100vh-180px)]">
                {/* メインコンテンツエリア */}
                <div className="flex-1 min-w-0 flex flex-col">
                  {selectedPage ? (
                    <div className="flex flex-col h-full">
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <Input
                          value={editingPageTitle}
                          onChange={(e) => setEditingPageTitle(e.target.value)}
                          onBlur={handlePageTitleBlur}
                          placeholder="ページタイトル"
                          className="flex-1 text-sm font-semibold text-amber-900/80 border-0 bg-transparent hover:bg-amber-50/50 focus:bg-amber-50/50 px-2 h-8"
                        />
                        <div className="flex items-center gap-2 shrink-0">
                          {savingPage && (
                            <span className="text-[10px] text-muted-foreground">保存中...</span>
                          )}
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
                                ノート一覧を開く
                                <ChevronRight className="h-3 w-3 ml-1" />
                              </>
                            )}
                          </Button>
                        </div>
                      </div>
                      <div className="border-0 rounded-lg overflow-hidden flex-1">
                        <RichTextEditor
                          key={selectedPage.id}
                          content={editingPageContent}
                          onChange={handlePageContentChange}
                          placeholder="ノートの内容を入力..."
                        />
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
                            ノート一覧を開く
                            <ChevronRight className="h-3 w-3 ml-1" />
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

      {/* 右側サイドパネル（ノート管理 - 3階層対応） */}
      {mainTab === "notes" && (
        <aside
          className={cn(
            "fixed right-0 top-0 h-full w-72 bg-white/95 backdrop-blur-sm border-l border-amber-200/60 shadow-lg z-30 transition-transform duration-300 ease-out",
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
            <div className="flex-1 overflow-y-auto p-3">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-medium text-amber-900/80">{selectedSubject}のノート</span>
                <Button 
                  size="sm" 
                  className="h-6 text-xs px-2"
                  onClick={() => setCreateNotebookDialogOpen(true)}
                >
                  <Plus className="h-3 w-3 mr-1" />
                  新規
                </Button>
              </div>
              {loadingNotebooks ? (
                <div className="text-center py-8 text-muted-foreground text-xs">読み込み中...</div>
              ) : notebooks.length === 0 ? (
                <div className="text-center py-8 border border-amber-200/60 rounded-lg">
                  <p className="text-muted-foreground mb-3 text-xs">ノートブックがありません</p>
                  <Button 
                    size="sm" 
                    className="h-6 text-xs px-2"
                    onClick={() => setCreateNotebookDialogOpen(true)}
                  >
                    <Plus className="h-3 w-3 mr-1" />
                    作成
                  </Button>
                </div>
              ) : (
                <div className="space-y-2">
                  {notebooks.map((notebook) => (
                    <div key={notebook.id} className="border border-amber-200/60 rounded-lg overflow-hidden">
                      {/* ノートブック行 */}
                      <div className="flex items-center gap-1 p-2 hover:bg-amber-50/40 transition-colors group">
                        <button
                          onClick={() => toggleNotebook(notebook.id)}
                          className="flex items-center gap-1 flex-1 text-left min-w-0"
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
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-5 w-5 p-0 shrink-0"
                          onClick={() => openCreateSectionDialog(notebook.id)}
                          title="セクションを追加"
                        >
                          <Plus className="h-3 w-3 text-amber-600" />
                        </Button>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-5 w-5 p-0 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              <MoreVertical className="h-3 w-3 text-amber-600" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => openEditNotebookDialog(notebook)}>
                              <Edit className="h-3 w-3 mr-2" />
                              編集
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => handleDeleteNotebook(notebook.id)}
                              className="text-destructive"
                            >
                              <Trash2 className="h-3 w-3 mr-2" />
                              削除
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>

                      {/* セクション一覧 */}
                      {expandedNotebooks.has(notebook.id) && (
                        <div className="border-t border-amber-100">
                          {notebook.sections && notebook.sections.length > 0 ? (
                            notebook.sections.map((section) => (
                              <div key={section.id} className="border-b border-amber-100 last:border-b-0">
                                {/* セクション行 */}
                                <div className="flex items-center gap-1 pl-5 pr-2 py-1.5 hover:bg-amber-50/30 transition-colors group/section">
                                  <button
                                    onClick={() => toggleSection(section.id)}
                                    className="flex items-center gap-1 flex-1 text-left min-w-0"
                                  >
                                    {expandedSections.has(section.id) ? (
                                      <ChevronDown className="h-2.5 w-2.5 text-amber-500 shrink-0" />
                                    ) : (
                                      <ChevronRight className="h-2.5 w-2.5 text-amber-500 shrink-0" />
                                    )}
                                    <StickyNote className="h-3 w-3 text-amber-500 shrink-0" />
                                    <span className="text-[11px] font-medium text-slate-600 truncate">{section.title}</span>
                                  </button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-4 w-4 p-0 shrink-0"
                                    onClick={() => openCreatePageDialog(section.id)}
                                    title="ページを追加"
                                  >
                                    <Plus className="h-2.5 w-2.5 text-amber-500" />
                                  </Button>
                                  <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-4 w-4 p-0 shrink-0 opacity-0 group-hover/section:opacity-100 transition-opacity"
                                      >
                                        <MoreVertical className="h-2.5 w-2.5 text-amber-500" />
                                      </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end">
                                      <DropdownMenuItem onClick={() => openEditSectionDialog(section)}>
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

                                {/* ページ一覧 */}
                                {expandedSections.has(section.id) && (
                                  <div className="pl-10 pr-2 pb-1">
                                    {section.pages && section.pages.length > 0 ? (
                                      section.pages.map((page) => {
                                        const isSelected = page.id === selectedPageId
                                        return (
                                          <div
                                            key={page.id}
                                            className={cn(
                                              "flex items-center gap-1 rounded transition-colors group/page",
                                              isSelected
                                                ? "bg-amber-200/60"
                                                : "hover:bg-amber-50/40"
                                            )}
                                          >
                                            <button
                                              onClick={() => {
                                                setSelectedPageId(page.id)
                                                try {
                                                  const params = new URLSearchParams(searchParams.toString())
                                                  params.set("tab", "notes")
                                                  params.set("pageId", String(page.id))
                                                  const encodedSubject = encodeURIComponent(selectedSubject)
                                                  router.replace(`/your-page/subjects/${encodedSubject}?${params.toString()}`)
                                                } catch (error) {
                                                  console.error("Failed to sync pageId to URL:", error)
                                                }
                                              }}
                                              className={cn(
                                                "flex-1 flex items-center gap-1.5 px-2 py-1 text-left text-[11px]",
                                                isSelected
                                                  ? "text-amber-900 font-medium"
                                                  : "text-slate-600"
                                              )}
                                            >
                                              <FileText className="h-2.5 w-2.5 text-amber-500 shrink-0" />
                                              <span className="truncate">{page.title || "無題"}</span>
                                            </button>
                                            <Button
                                              variant="ghost"
                                              size="sm"
                                              className="h-4 w-4 p-0 shrink-0 opacity-0 group-hover/page:opacity-100 transition-opacity mr-1"
                                              onClick={() => handleDeletePage(page.id)}
                                              title="削除"
                                            >
                                              <Trash2 className="h-2.5 w-2.5 text-red-500" />
                                            </Button>
                                          </div>
                                        )
                                      })
                                    ) : (
                                      <div className="text-[10px] text-muted-foreground py-1">
                                        ページがありません
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            ))
                          ) : (
                            <div className="text-[10px] text-muted-foreground text-center py-2">
                              セクションがありません
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

      {/* ノートブック作成ダイアログ */}
      <Dialog open={createNotebookDialogOpen} onOpenChange={setCreateNotebookDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>新しいノートブックを作成</DialogTitle>
            <DialogDescription>
              {selectedSubject}のノートブックを作成します
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="notebook-title">タイトル</Label>
              <Input
                id="notebook-title"
                value={newNotebook.title}
                onChange={(e) => setNewNotebook(prev => ({ ...prev, title: e.target.value }))}
                placeholder="ノートブックのタイトルを入力"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="notebook-description">説明（任意）</Label>
              <Textarea
                id="notebook-description"
                value={newNotebook.description}
                onChange={(e) => setNewNotebook(prev => ({ ...prev, description: e.target.value }))}
                placeholder="ノートブックの説明を入力（任意）"
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setCreateNotebookDialogOpen(false)}
              disabled={creatingNotebook}
            >
              キャンセル
            </Button>
            <Button onClick={handleCreateNotebook} disabled={creatingNotebook}>
              {creatingNotebook ? "作成中..." : "作成"}
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
                onChange={(e) => setNewSection(prev => ({ ...prev, title: e.target.value }))}
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
            <Button onClick={handleCreateSection} disabled={creatingSection}>
              {creatingSection ? "作成中..." : "作成"}
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
              ページのタイトルを入力してください
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="page-title">タイトル（任意）</Label>
              <Input
                id="page-title"
                value={newPage.title}
                onChange={(e) => setNewPage(prev => ({ ...prev, title: e.target.value }))}
                placeholder="ページのタイトルを入力（任意）"
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
            <Button onClick={handleCreatePage} disabled={creatingPage}>
              {creatingPage ? "作成中..." : "作成"}
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
              <Label htmlFor="edit-notebook-title">タイトル</Label>
              <Input
                id="edit-notebook-title"
                value={editingNotebookData.title}
                onChange={(e) => setEditingNotebookData(prev => ({ ...prev, title: e.target.value }))}
                placeholder="ノートブックのタイトルを入力"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-notebook-description">説明（任意）</Label>
              <Textarea
                id="edit-notebook-description"
                value={editingNotebookData.description}
                onChange={(e) => setEditingNotebookData(prev => ({ ...prev, description: e.target.value }))}
                placeholder="ノートブックの説明を入力（任意）"
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setEditNotebookDialogOpen(false)}
              disabled={updatingNotebook}
            >
              キャンセル
            </Button>
            <Button onClick={handleUpdateNotebook} disabled={updatingNotebook}>
              {updatingNotebook ? "更新中..." : "更新"}
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
                value={editingSectionTitle}
                onChange={(e) => setEditingSectionTitle(e.target.value)}
                placeholder="セクション名を入力"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setEditSectionDialogOpen(false)}
              disabled={updatingSection}
            >
              キャンセル
            </Button>
            <Button onClick={handleUpdateSection} disabled={updatingSection}>
              {updatingSection ? "更新中..." : "更新"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default withAuth(SubjectPage, { requireAuth: true })
