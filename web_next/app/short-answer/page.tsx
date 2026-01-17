"use client"

import { useSidebar } from "@/components/sidebar"
import { cn } from "@/lib/utils"

export default function ShortAnswerPage() {
  const { isOpen } = useSidebar()
  return (
    <div 
      className="min-h-screen bg-gradient-to-b from-background to-muted/20 flex items-center justify-center transition-all duration-300"
      style={{
        paddingLeft: isOpen ? '208px' : '0',
      }}
    >
      <div className="container mx-auto px-8 py-12 max-w-4xl text-center">
        <p className="text-lg text-muted-foreground">
          現在開発中の機能です。もう少々お待ちください。
        </p>
      </div>
    </div>
  )
}
