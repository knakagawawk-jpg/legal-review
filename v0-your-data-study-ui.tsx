// V0用：Your Data 勉強管理タブの見た目（目標達成率カード含む）。コピーしてV0に貼り付けてください。

export function YourDataStudyUI() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-amber-50/80 to-orange-50/30">
      <header className="sticky top-0 z-10 bg-white/95 backdrop-blur-sm border-b border-amber-200/60 shadow-sm">
        <div className="container mx-auto px-4 sm:px-8 lg:px-12 py-3 max-w-7xl">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <h1 className="text-base font-semibold text-amber-900">Your Data</h1>
            </div>
            <div className="flex items-center gap-2">
              <div className="inline-flex w-max h-8 bg-amber-100/60 p-0.5 rounded-md">
                <button className="text-xs px-2.5 py-1 bg-white text-amber-800 shadow-sm rounded flex items-center gap-1.5">
                  勉強管理
                </button>
                <button className="text-xs px-2.5 py-1 text-amber-800/70 rounded flex items-center gap-1.5">
                  過去問管理
                </button>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 sm:px-8 lg:px-12 py-4 max-w-7xl">
        <div className="space-y-4">
          {/* 講評回数 */}
          <div className="flex justify-end mb-2">
            <div className="text-sm text-muted-foreground">
              講評回数：
              <span className="font-semibold text-amber-700">3</span>
              <span> / </span>
              <span className="font-semibold">10</span>
              回
            </div>
          </div>

          {/* 目標達成率 */}
          <div className="rounded-lg border border-amber-200/60 bg-white shadow-sm">
            <div className="py-1.5 px-3 border-b border-border/40">
              <div className="text-xs font-medium flex items-center gap-1.5 text-amber-900/80">
                <span className="text-amber-500">◎</span>
                目標達成率
              </div>
            </div>
            <div className="px-3 pb-3 pt-2">
              <div className="text-sm text-muted-foreground">（表示エリア）</div>
            </div>
          </div>

          {/* Your MEMO */}
          <div className="rounded-lg border border-amber-200/60 bg-white shadow-sm">
            <div className="py-1.5 px-3 border-b border-border/40">
              <div className="flex items-center justify-between">
                <div className="text-xs font-medium flex items-center gap-1.5 text-amber-900/80">
                  <span className="text-amber-400">💡</span>
                  Your MEMO
                </div>
                <div className="flex items-center gap-1">
                  <button className="h-7 text-xs gap-1 px-2 border rounded-md">追加</button>
                  <button className="h-7 text-xs px-2">拡大</button>
                  <button className="h-7 w-7 text-xs p-0">▼</button>
                </div>
              </div>
            </div>
            <div className="px-3 pb-2">
              <div className="text-xs text-muted-foreground py-4">MEMO一覧エリア</div>
            </div>
          </div>

          {/* Your Topics */}
          <div className="rounded-lg border border-amber-200/60 bg-white shadow-sm">
            <div className="py-1.5 px-3 border-b border-border/40">
              <div className="flex items-center justify-between">
                <div className="text-xs font-medium flex items-center gap-1.5 text-amber-900/80">
                  <span className="text-amber-400">📋</span>
                  Your Topics
                </div>
                <div className="flex items-center gap-1">
                  <button className="h-7 text-xs gap-1 px-2 border rounded-md">追加</button>
                  <button className="h-7 text-xs px-2">拡大</button>
                  <button className="h-7 w-7 text-xs p-0">▼</button>
                </div>
              </div>
            </div>
            <div className="px-3 pb-2">
              <div className="text-xs text-muted-foreground py-4">Topics一覧エリア</div>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
