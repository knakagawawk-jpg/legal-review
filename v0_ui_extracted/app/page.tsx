'use client';

import { useState } from 'react';
import { ChevronUp } from 'lucide-react';

export default function YourDataStudyUI() {
  const [isCardVisible, setIsCardVisible] = useState(true);
  const [isTableExpanded, setIsTableExpanded] = useState(false);

  // ダミーデータ
  const studyData = [
    { name: '数学', target: 10, actual: 8.5, status: '進行中' },
    { name: '英語', target: 10, actual: 9.2, status: '達成済' },
    { name: '物理', target: 8, actual: 6.0, status: '進行中' },
    { name: '化学', target: 8, actual: 7.8, status: '達成済' },
    { name: '国語', target: 6, actual: 2.5, status: '進行中' },
    { name: '日本史', target: 5, actual: 4.2, status: '進行中' },
  ];

  const displayedData = isTableExpanded ? studyData : studyData.slice(0, 4);

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
          {/* 目標達成率セクション - すべて1つのカード内 */}
          {isCardVisible && (
            <div className="rounded-xl border border-amber-200/40 bg-gradient-to-br from-white to-amber-50/30 shadow-md transition-all duration-300">
              <div className="py-3 px-4 border-b border-amber-100/40 flex items-center justify-between bg-gradient-to-r from-amber-50/50 to-transparent">
                <div className="text-sm font-semibold flex items-center gap-2 text-amber-900">
                  <span className="text-xl">◎</span>
                  今月の勉強時間
                </div>
                <button
                  onClick={() => setIsCardVisible(false)}
                  className="text-gray-400 hover:text-gray-600 transition-colors p-1"
                >
                  <ChevronUp className="w-5 h-5" />
                </button>
              </div>
              <div className="p-6">
                <div className="flex gap-8">
                  {/* 左側：大きな円グラフ */}
                  <div className="flex flex-col items-center justify-start flex-shrink-0">
                    <div className="relative w-40 h-40">
                      <svg className="w-full h-full" viewBox="0 0 100 100">
                        {/* 背景円 */}
                        <circle cx="50" cy="50" r="42" fill="none" stroke="#fef3c7" strokeWidth="6" />
                        {/* 進捗円 */}
                        <circle
                          cx="50"
                          cy="50"
                          r="42"
                          fill="none"
                          stroke="url(#gradientCircle)"
                          strokeWidth="6"
                          strokeDasharray={`${42 * Math.PI * (72 / 100)}, ${42 * Math.PI * 2}`}
                          strokeLinecap="round"
                          transform="rotate(-90 50 50)"
                        />
                        <defs>
                          <linearGradient id="gradientCircle" x1="0%" y1="0%" x2="100%" y2="100%">
                            <stop offset="0%" stopColor="#f59e0b" />
                            <stop offset="100%" stopColor="#d97706" />
                          </linearGradient>
                        </defs>
                      </svg>
                      <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <span className="text-3xl font-bold bg-gradient-to-br from-amber-600 to-amber-700 bg-clip-text text-transparent">72%</span>
                        <span className="text-xs text-gray-500 font-medium mt-1">達成</span>
                      </div>
                    </div>
                    <div className="mt-4 text-center">
                      <p className="text-lg font-bold text-amber-900">72 / 100</p>
                      <p className="text-xs text-gray-600 mt-0.5">時間</p>
                    </div>
                  </div>

                  {/* 右側：上下に分割 */}
                  <div className="flex-1 flex flex-col gap-3 min-w-0">
                    {/* 上部：目標達成率、短答、講評（横並び） */}
                    <div className="flex gap-1.5">
                      {/* 目標達成率 */}
                      <div style={{ flex: '2' }} className="rounded-lg px-2.5 py-1">
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center justify-between gap-1">
                            <span className="text-xs font-semibold text-blue-900">目標達成率</span>
                            <div className="flex items-center gap-1 flex-shrink-0">
                              <span className="text-xs font-bold text-blue-700">72%</span>
                              <span className="text-xs font-bold text-blue-700">18/25</span>
                            </div>
                          </div>
                          <div className="w-full bg-blue-100 rounded-full h-1.5 overflow-hidden">
                            <div
                              className="bg-gradient-to-r from-blue-400 to-blue-600 h-full rounded-full"
                              style={{ width: '72%' }}
                            />
                          </div>
                        </div>
                      </div>

                      {/* 短答実施数 */}
                      <div style={{ flex: '0.8' }} className="rounded-lg px-2.5 py-1">
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center justify-between gap-1">
                            <span className="text-xs font-semibold text-emerald-900">短答実施数</span>
                            <div className="flex items-center gap-1 flex-shrink-0">
                              <span className="text-xs font-bold text-emerald-700">72%</span>
                              <span className="text-xs font-bold text-emerald-700">18/25</span>
                            </div>
                          </div>
                          <div className="w-full bg-emerald-100 rounded-full h-1.5 overflow-hidden">
                            <div
                              className="bg-gradient-to-r from-emerald-400 to-emerald-600 h-full rounded-full"
                              style={{ width: '72%' }}
                            />
                          </div>
                        </div>
                      </div>

                      {/* 講評回数 */}
                      <div style={{ flex: '0.8' }} className="rounded-lg px-2.5 py-1">
                        <div className="flex items-center justify-between gap-1">
                          <span className="text-xs font-semibold text-rose-900">今月の講評</span>
                          <span className="text-xs font-bold text-rose-600 flex-shrink-0">3/10</span>
                        </div>
                      </div>
                    </div>

                    {/* 下部：テーブル */}
                    <div className="border-t border-amber-100/60 pt-2 mt-2">
                      <div className="text-xs font-semibold flex items-center gap-2 text-amber-900 mb-2">
                        <span>📊</span>
                        科目別勉強時間
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs">
                          <thead className="bg-amber-50/80 border-y border-amber-200/40">
                            <tr>
                              <th className="px-3 py-2 text-left font-semibold text-amber-900">科目</th>
                              <th className="px-3 py-2 text-right font-semibold text-amber-900">実績/目標</th>
                              <th className="px-3 py-2 text-center font-semibold text-amber-900">達成度</th>
                              <th className="px-3 py-2 text-center font-semibold text-amber-900">ステータス</th>
                            </tr>
                          </thead>
                          <tbody>
                            {/* テーブルは空 */}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* カード折り畳み時の復元ボタン */}
          {!isCardVisible && (
            <button
              onClick={() => setIsCardVisible(true)}
              className="w-full py-2 text-xs font-medium text-amber-700 hover:text-amber-900 bg-amber-50/60 hover:bg-amber-100/60 border border-amber-200/40 rounded-lg transition-colors"
            >
              今月の勉強時間を表示
            </button>
          )}

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
  );
}
