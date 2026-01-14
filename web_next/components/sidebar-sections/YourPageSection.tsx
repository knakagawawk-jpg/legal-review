"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { LayoutDashboard, FileText, BookOpen, StickyNote } from "lucide-react"

const yourPageNav = [
  {
    name: "ダッシュボード",
    href: "/your-page/dashboard",
    icon: LayoutDashboard,
  },
  {
    name: "過去問管理",
    href: "/your-page/past-questions",
    icon: FileText,
  },
  {
    name: "各科目ページ",
    href: "/your-page/subjects/憲法",
    icon: BookOpen,
  },
]

export function YourPageSection() {
  const pathname = usePathname()

  return (
    <div className="space-y-1 px-2">
      {yourPageNav.map((item) => {
        const isActive = pathname === item.href || (item.href !== "/your-page/dashboard" && pathname.startsWith(item.href))
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              isActive
                ? "bg-blue-100/80 text-blue-700 shadow-sm"
                : "text-slate-600 hover:bg-blue-50/60 hover:text-slate-900"
            )}
          >
            <item.icon className={cn("h-4 w-4", isActive ? "text-blue-600" : "text-slate-500")} />
            <span>{item.name}</span>
          </Link>
        )
      })}
    </div>
  )
}
