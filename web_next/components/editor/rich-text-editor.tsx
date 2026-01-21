"use client"

import { useEffect, useRef } from "react"
import { useEditor, EditorContent } from "@tiptap/react"
import StarterKit from "@tiptap/starter-kit"
import Underline from "@tiptap/extension-underline"
import { TextStyle } from "@tiptap/extension-text-style"
import Placeholder from "@tiptap/extension-placeholder"
import { Table } from "@tiptap/extension-table"
import { TableRow } from "@tiptap/extension-table-row"
import { TableCell } from "@tiptap/extension-table-cell"
import { TableHeader } from "@tiptap/extension-table-header"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Bold, Underline as UnderlineIcon, Table as TableIcon } from "lucide-react"
import { cn } from "@/lib/utils"

// カスタムフォントサイズ拡張
const FontSize = TextStyle.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      fontSize: {
        default: null,
        parseHTML: (element) => element.style.fontSize || null,
        renderHTML: (attributes) => {
          if (!attributes.fontSize) {
            return {}
          }
          return {
            style: `font-size: ${attributes.fontSize}`,
          }
        },
      },
    }
  },
  addCommands() {
    return {
      ...this.parent?.(),
      setFontSize: (fontSize: string) => ({ commands }) => {
        return commands.setMark(this.name, { fontSize })
      },
      unsetFontSize: () => ({ commands }) => {
        return commands.unsetMark(this.name)
      },
    }
  },
})

interface RichTextEditorProps {
  content: string
  onChange: (content: string) => void
  placeholder?: string
  className?: string
}

export function RichTextEditor({
  content,
  onChange,
  placeholder = "内容を入力...",
  className,
}: RichTextEditorProps) {
  // 外部からのcontent変更を追跡するためのフラグ
  const isExternalUpdate = useRef(false)
  const prevContentRef = useRef(content)

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: false,
      }),
      Underline,
      FontSize,
      Placeholder.configure({
        placeholder,
      }),
      Table.configure({
        resizable: true,
      }),
      TableRow,
      TableHeader,
      TableCell,
    ],
    content,
    onUpdate: ({ editor }) => {
      // 外部からの更新中は onChange を呼ばない（無限ループ防止）
      if (!isExternalUpdate.current) {
        onChange(editor.getHTML())
      }
    },
    editorProps: {
      attributes: {
        class: cn(
          "focus:outline-none text-sm leading-relaxed",
          className
        ),
      },
    },
  })

  // content プロパティが外部から変更された時にエディタを更新
  useEffect(() => {
    if (editor && content !== prevContentRef.current) {
      // エディタの現在の内容と異なる場合のみ更新
      const currentContent = editor.getHTML()
      if (currentContent !== content) {
        isExternalUpdate.current = true
        editor.commands.setContent(content || '')
        isExternalUpdate.current = false
      }
      prevContentRef.current = content
    }
  }, [content, editor])

  if (!editor) {
    return null
  }

  const insertTable = () => {
    editor
      .chain()
      .focus()
      .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
      .run()
  }

  return (
    <div className="border border-amber-200/60 rounded-md flex flex-col h-full bg-white">
      {/* ツールバー */}
      <div className="flex items-center gap-1 p-2 border-b border-amber-200/60 bg-amber-50/30 flex-wrap shrink-0">
        {/* 太字 */}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className={cn(
            "h-8 w-8 p-0",
            editor.isActive("bold") && "bg-muted"
          )}
          onClick={() => editor.chain().focus().toggleBold().run()}
          disabled={!editor.can().chain().focus().toggleBold().run()}
        >
          <Bold className="h-4 w-4" />
        </Button>

        {/* アンダーライン */}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className={cn(
            "h-8 w-8 p-0",
            editor.isActive("underline") && "bg-muted"
          )}
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          disabled={!editor.can().chain().focus().toggleUnderline().run()}
        >
          <UnderlineIcon className="h-4 w-4" />
        </Button>

        <Separator orientation="vertical" className="h-6 mx-1" />

        {/* 文字サイズ */}
        <Select
          value={
            (() => {
              const fontSize = editor.getAttributes("textStyle").fontSize
              if (fontSize === "0.875rem") return "small"
              if (fontSize === "1rem") return "medium"
              if (fontSize === "1.25rem") return "large"
              return "medium"
            })()
          }
          onValueChange={(value) => {
            if (value === "small") {
              editor.chain().focus().setFontSize("0.875rem").run()
            } else if (value === "medium") {
              editor.chain().focus().setFontSize("1rem").run()
            } else if (value === "large") {
              editor.chain().focus().setFontSize("1.25rem").run()
            } else {
              editor.chain().focus().unsetFontSize().run()
            }
          }}
        >
          <SelectTrigger className="h-8 w-[100px] text-xs">
            <SelectValue placeholder="サイズ" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="small">小</SelectItem>
            <SelectItem value="medium">中</SelectItem>
            <SelectItem value="large">大</SelectItem>
          </SelectContent>
        </Select>

        <Separator orientation="vertical" className="h-6 mx-1" />

        {/* テーブル挿入 */}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0"
          onClick={insertTable}
          title="テーブルを挿入"
        >
          <TableIcon className="h-4 w-4" />
        </Button>
      </div>

      {/* エディタ */}
      <EditorContent 
        editor={editor} 
        className="flex-1 overflow-y-auto min-h-[200px] bg-white [&>.tiptap]:min-h-full" 
      />
    </div>
  )
}
