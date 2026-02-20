"use client"

import { useRef, useEffect, useState, useCallback } from "react"

interface TableWithAddRowProps {
  /** テーブル内容（スクロール可能） */
  children: React.ReactNode
  /** 追加行バー（テーブルとスクロールバーの間に表示、横スクロールで動かない） */
  addRowBar?: React.ReactNode
  /** 最大高さ（例: "480px"） */
  maxHeight?: string
  /** スクロール時のコールバック（親で loadMore 等に使用） */
  onScroll?: (e: React.UIEvent<HTMLDivElement>) => void
  /** 親から ref を渡す場合（縦スクロール要素を指す） */
  scrollRef?: React.RefObject<HTMLDivElement>
  className?: string
}

/**
 * テーブル＋追加行＋横スクロールバーのレイアウト。
 * 順序: テーブル → 追加行（横スクロールで動かない）→ 横スクロールバー（テーブルのみ連動）
 */
export function TableWithAddRow({
  children,
  addRowBar,
  maxHeight,
  onScroll,
  scrollRef: externalScrollRef,
  className,
}: TableWithAddRowProps) {
  const internalScrollRef = useRef<HTMLDivElement>(null)
  const horizontalScrollRef = useRef<HTMLDivElement>(null)
  const outerScrollRef = externalScrollRef ?? internalScrollRef
  const [scrollWidth, setScrollWidth] = useState(0)
  const [clientWidth, setClientWidth] = useState(0)
  const [scrollLeft, setScrollLeft] = useState(0)

  const needsHorizontalScrollbar = scrollWidth > clientWidth
  const maxScrollLeft = Math.max(0, scrollWidth - clientWidth)

  useEffect(() => {
    const el = horizontalScrollRef.current
    if (!el) return

    const updateSizes = () => {
      setScrollWidth(el.scrollWidth)
      setClientWidth(el.clientWidth)
      setScrollLeft(el.scrollLeft)
    }

    updateSizes()
    const ro = new ResizeObserver(updateSizes)
    ro.observe(el)
    return () => ro.disconnect()
  }, [children])

  const handleHorizontalScroll = () => {
    if (horizontalScrollRef.current) {
      setScrollLeft(horizontalScrollRef.current.scrollLeft)
    }
  }

  const handleOuterScroll = (e: React.UIEvent<HTMLDivElement>) => {
    onScroll?.(e)
  }

  const trackRef = useRef<HTMLDivElement>(null)
  const [isDragging, setIsDragging] = useState(false)
  const dragStartX = useRef(0)
  const dragStartScrollLeft = useRef(0)

  const scrollToThumbPosition = useCallback((clientX: number) => {
    const track = trackRef.current
    const el = horizontalScrollRef.current
    if (!track || !el || scrollWidth <= 0) return
    const rect = track.getBoundingClientRect()
    const thumbRatio = clientWidth / scrollWidth
    const thumbWidth = Math.max(20, rect.width * thumbRatio)
    const trackWidth = rect.width
    const maxThumbLeft = trackWidth - thumbWidth
    if (maxThumbLeft <= 0) return
    const thumbLeft = Math.max(0, Math.min(clientX - rect.left - thumbWidth / 2, maxThumbLeft))
    const newScrollLeft = (thumbLeft / maxThumbLeft) * maxScrollLeft
    el.scrollLeft = newScrollLeft
    setScrollLeft(newScrollLeft)
  }, [scrollWidth, clientWidth, maxScrollLeft])

  const handleThumbMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    setIsDragging(true)
    dragStartX.current = e.clientX
    dragStartScrollLeft.current = horizontalScrollRef.current?.scrollLeft ?? 0
  }, [])

  useEffect(() => {
    if (!isDragging) return
    const onMove = (e: MouseEvent) => {
      if (!horizontalScrollRef.current) return
      const delta = e.clientX - dragStartX.current
      const newScrollLeft = Math.max(0, Math.min(maxScrollLeft, dragStartScrollLeft.current + delta))
      horizontalScrollRef.current.scrollLeft = newScrollLeft
      setScrollLeft(newScrollLeft)
      dragStartX.current = e.clientX
      dragStartScrollLeft.current = newScrollLeft
    }
    const onUp = () => setIsDragging(false)
    document.addEventListener("mousemove", onMove)
    document.addEventListener("mouseup", onUp)
    return () => {
      document.removeEventListener("mousemove", onMove)
      document.removeEventListener("mouseup", onUp)
    }
  }, [isDragging, maxScrollLeft])

  const handleTrackClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target !== e.currentTarget) return
    scrollToThumbPosition(e.clientX)
  }, [scrollToThumbPosition])

  return (
    <div className={className}>
      <div className="flex flex-col min-h-0">
        {/* 外側：縦スクロール。tabIndex=-1 でフォーカスは子の入力要素へ */}
        <div
          ref={outerScrollRef}
          onScroll={handleOuterScroll}
          className="overflow-y-auto overflow-x-hidden flex-1 min-h-0"
          style={{ maxHeight: maxHeight ?? undefined }}
          tabIndex={-1}
        >
          {/* 内側：横スクロールのみ、横スクロールバー非表示。tabIndex=-1 でフォーカスは子の入力要素へ */}
          <div
            ref={horizontalScrollRef}
            onScroll={handleHorizontalScroll}
            className="table-scroll-area-hide-hbar"
            tabIndex={-1}
            style={{
              overflowX: needsHorizontalScrollbar ? "scroll" : "hidden",
              overflowY: "visible",
              scrollbarWidth: "none",
              msOverflowStyle: "none",
            }}
          >
            {children}
          </div>
          {/* 追加行バー：縦スクロール内の最下部、横スクロールで動かない */}
          {addRowBar && (
            <div className="flex-shrink-0 w-full overflow-x-hidden">
              {addRowBar}
            </div>
          )}
        </div>
        {/* 横スクロールバー：テーブルのみと連動（ドラッグで動かすバー） */}
        {needsHorizontalScrollbar && (() => {
          const thumbRatio = scrollWidth > 0 ? clientWidth / scrollWidth : 1
          const thumbWidthPercent = Math.min(100, Math.max(5, thumbRatio * 100))
          const thumbLeftPercent = maxScrollLeft > 0 ? (scrollLeft / maxScrollLeft) * (100 - thumbWidthPercent) : 0
          return (
            <div
              ref={trackRef}
              role="scrollbar"
              aria-valuenow={scrollLeft}
              aria-valuemin={0}
              aria-valuemax={maxScrollLeft}
              className="flex-shrink-0 w-full h-2 bg-muted/30 flex items-center relative cursor-pointer select-none"
              onClick={handleTrackClick}
            >
              <div
                className="absolute h-1.5 rounded bg-muted-foreground/40 hover:bg-muted-foreground/60 cursor-grab active:cursor-grabbing transition-colors"
                style={{
                  left: `${thumbLeftPercent}%`,
                  width: `${thumbWidthPercent}%`,
                  minWidth: 20,
                }}
                onMouseDown={handleThumbMouseDown}
              />
            </div>
          )
        })()}
      </div>
    </div>
  )
}
