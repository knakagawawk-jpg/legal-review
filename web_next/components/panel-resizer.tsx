"use client"

import type React from "react"

import { useCallback, useEffect, useRef, useState } from "react"
import { cn } from "@/lib/utils"

interface PanelResizerProps {
  onResize: (width: number) => void
  currentWidth: number
  minWidth?: number
  maxWidth?: number
}

const STORAGE_KEY = "review_panel_ratio"

export function PanelResizer({ onResize, currentWidth, minWidth = 20, maxWidth = 80 }: PanelResizerProps) {
  const [isDragging, setIsDragging] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  // Load saved width on mount
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) {
      const savedWidth = Number.parseFloat(saved)
      if (savedWidth >= minWidth && savedWidth <= maxWidth) {
        onResize(savedWidth)
      }
    }
  }, [minWidth, maxWidth, onResize])

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isDragging) return

      const container = containerRef.current?.parentElement?.parentElement
      if (!container) return

      const containerRect = container.getBoundingClientRect()
      const newWidth = ((e.clientX - containerRect.left) / containerRect.width) * 100

      const clampedWidth = Math.max(minWidth, Math.min(maxWidth, newWidth))
      onResize(clampedWidth)
    },
    [isDragging, minWidth, maxWidth, onResize],
  )

  const handleMouseUp = useCallback(() => {
    if (isDragging) {
      setIsDragging(false)
      localStorage.setItem(STORAGE_KEY, currentWidth.toString())
    }
  }, [isDragging, currentWidth])

  // Touch events
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    setIsDragging(true)
  }, [])

  const handleTouchMove = useCallback(
    (e: TouchEvent) => {
      if (!isDragging) return

      const container = containerRef.current?.parentElement?.parentElement
      if (!container) return

      const touch = e.touches[0]
      const containerRect = container.getBoundingClientRect()
      const newWidth = ((touch.clientX - containerRect.left) / containerRect.width) * 100

      const clampedWidth = Math.max(minWidth, Math.min(maxWidth, newWidth))
      onResize(clampedWidth)
    },
    [isDragging, minWidth, maxWidth, onResize],
  )

  const handleTouchEnd = useCallback(() => {
    if (isDragging) {
      setIsDragging(false)
      localStorage.setItem(STORAGE_KEY, currentWidth.toString())
    }
  }, [isDragging, currentWidth])

  useEffect(() => {
    if (isDragging) {
      document.addEventListener("mousemove", handleMouseMove)
      document.addEventListener("mouseup", handleMouseUp)
      document.addEventListener("touchmove", handleTouchMove)
      document.addEventListener("touchend", handleTouchEnd)
      document.body.style.cursor = "col-resize"
      document.body.style.userSelect = "none"
    }

    return () => {
      document.removeEventListener("mousemove", handleMouseMove)
      document.removeEventListener("mouseup", handleMouseUp)
      document.removeEventListener("touchmove", handleTouchMove)
      document.removeEventListener("touchend", handleTouchEnd)
      document.body.style.cursor = ""
      document.body.style.userSelect = ""
    }
  }, [isDragging, handleMouseMove, handleMouseUp, handleTouchMove, handleTouchEnd])

  return (
    <div
      ref={containerRef}
      className={cn(
        "hidden lg:flex w-1.5 flex-shrink-0 cursor-col-resize items-center justify-center group transition-colors",
        isDragging ? "bg-primary" : "bg-border hover:bg-primary/50",
      )}
      onMouseDown={handleMouseDown}
      onTouchStart={handleTouchStart}
    >
      <div
        className={cn(
          "w-0.5 h-12 rounded-full transition-colors",
          isDragging ? "bg-primary-foreground" : "bg-muted-foreground/30 group-hover:bg-primary-foreground/50",
        )}
      />
    </div>
  )
}
