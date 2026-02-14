'use client';

import { useState, useRef } from 'react';

export interface UsageData {
  review: number;
  reviewChat: number;
  freeChat: number;
  recent: number;
  title: number;
}

interface UsageBarProps {
  data: UsageData;
  maxAmount: number;
  onBarClick?: (event: React.MouseEvent) => void;
  isFixed?: boolean;
  activeUserId?: string;
}

const CATEGORIES = [
  { key: 'review', label: 'Review', color: 'hsl(var(--chart-1))' },
  { key: 'reviewChat', label: 'ReviewChat', color: 'hsl(var(--chart-2))' },
  { key: 'freeChat', label: 'FreeChat', color: 'hsl(var(--chart-3))' },
  { key: 'recent', label: 'Recent', color: 'hsl(var(--chart-4))' },
  { key: 'title', label: 'Title', color: 'hsl(var(--chart-5))' },
] as const;

export function UsageBar({ data, maxAmount, onBarClick, isFixed }: UsageBarProps) {
  const [isHovered, setIsHovered] = useState(false);
  const barRef = useRef<HTMLDivElement>(null);

  const total = Object.values(data).reduce((sum, val) => sum + val, 0);
  const normalizedTotal = Math.min(total, maxAmount);
  const percentage = (normalizedTotal / maxAmount) * 100;

  // 各カテゴリの幅を計算
  const segments = CATEGORIES.map((cat) => {
    const categoryKey = cat.key as keyof UsageData;
    const categoryAmount = data[categoryKey];
    const categoryPercentage = normalizedTotal > 0 ? (categoryAmount / normalizedTotal) * 100 : 0;
    return {
      ...cat,
      amount: categoryAmount,
      percentage: categoryPercentage,
    };
  }).filter(seg => seg.amount > 0);

  const shouldShowDetails = isHovered || isFixed;

  return (
    <div className="flex flex-col gap-2">
      <div
        ref={barRef}
        onClick={onBarClick}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => !isFixed && setIsHovered(false)}
        className="relative flex items-center gap-2 cursor-pointer group"
      >
        {/* メインバー */}
        <div className="flex-1 bg-muted rounded-md overflow-hidden h-8 shadow-sm hover:shadow-md transition-shadow">
          <div
            className="flex h-full rounded-md overflow-hidden transition-all"
            style={{
              width: `${percentage}%`,
            }}
          >
            {segments.map((segment, index) => (
              <div
                key={segment.key}
                className="relative h-full transition-opacity"
                style={{
                  width: `${segment.percentage}%`,
                  backgroundColor: segment.color,
                }}
              >
                {/* セグメント境界線 */}
                {index > 0 && (
                  <div className="absolute left-0 top-0 bottom-0 w-px bg-black/10" />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* パーセンテージテキスト */}
        <span className="text-sm font-medium text-muted-foreground min-w-fit">
          {percentage.toFixed(1)}%
        </span>
      </div>

      {/* マウスオーバー時または固定化時の詳細情報 */}
      {shouldShowDetails && (
        <div className="text-xs bg-accent/20 rounded-md p-3 border border-accent/40 space-y-1">
          <div className="font-semibold text-foreground mb-2">使用内訳</div>
          {segments.map((segment) => (
            <div key={segment.key} className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div
                  className="w-3 h-3 rounded-sm"
                  style={{ backgroundColor: segment.color }}
                />
                <span className="text-muted-foreground">{segment.label}</span>
              </div>
              <span className="font-semibold">
                ¥{segment.amount.toLocaleString()}
              </span>
            </div>
          ))}
          <div className="pt-2 border-t border-border/50 mt-2">
            <div className="flex justify-between">
              <span className="text-muted-foreground">合計</span>
              <span className="font-bold">
                ¥{normalizedTotal.toLocaleString()} / ¥{maxAmount.toLocaleString()}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
