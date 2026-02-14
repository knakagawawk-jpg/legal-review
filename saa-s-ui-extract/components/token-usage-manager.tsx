'use client';

import { useState, useEffect, useRef } from 'react';
import { PlanSection } from './plan-section';
import { UsageData } from './usage-bar';

interface User {
  id: string;
  name: string;
  data: UsageData;
}

interface PlanData {
  name: string;
  color: string;
  maxAmount: number;
  users: User[];
}

// モックデータ
const MOCK_PLANS: Record<string, PlanData> = {
  A: {
    name: 'Plan A',
    color: 'hsl(220, 70%, 50%)',
    maxAmount: 100000,
    users: [
      {
        id: 'user-a1',
        name: 'Alice Johnson',
        data: {
          review: 45000,
          reviewChat: 25000,
          freeChat: 15000,
          recent: 8000,
          title: 5000,
        },
      },
      {
        id: 'user-a2',
        name: 'Bob Smith',
        data: {
          review: 20000,
          reviewChat: 15000,
          freeChat: 30000,
          recent: 12000,
          title: 8000,
        },
      },
      {
        id: 'user-a3',
        name: 'Carol White',
        data: {
          review: 60000,
          reviewChat: 20000,
          freeChat: 10000,
          recent: 5000,
          title: 3000,
        },
      },
      {
        id: 'user-a4',
        name: 'David Lee',
        data: {
          review: 8000,
          reviewChat: 5000,
          freeChat: 3000,
          recent: 2000,
          title: 1000,
        },
      },
    ],
  },
  B: {
    name: 'Plan B',
    color: 'hsl(160, 60%, 45%)',
    maxAmount: 50000,
    users: [
      {
        id: 'user-b1',
        name: 'Eve Brown',
        data: {
          review: 15000,
          reviewChat: 10000,
          freeChat: 8000,
          recent: 4000,
          title: 2000,
        },
      },
      {
        id: 'user-b2',
        name: 'Frank Green',
        data: {
          review: 22000,
          reviewChat: 12000,
          freeChat: 5000,
          recent: 3000,
          title: 1000,
        },
      },
      {
        id: 'user-b3',
        name: 'Grace Kim',
        data: {
          review: 5000,
          reviewChat: 3000,
          freeChat: 2000,
          recent: 1000,
          title: 500,
        },
      },
    ],
  },
  C: {
    name: 'Plan C',
    color: 'hsl(30, 80%, 55%)',
    maxAmount: 25000,
    users: [
      {
        id: 'user-c1',
        name: 'Henry Wilson',
        data: {
          review: 8000,
          reviewChat: 5000,
          freeChat: 4000,
          recent: 2000,
          title: 1000,
        },
      },
      {
        id: 'user-c2',
        name: 'Iris Taylor',
        data: {
          review: 10000,
          reviewChat: 6000,
          freeChat: 3000,
          recent: 1500,
          title: 1000,
        },
      },
    ],
  },
};

export function TokenUsageManager() {
  const [fixedUserIds, setFixedUserIds] = useState<string[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);

  // 表示外クリックで固定化を解除
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setFixedUserIds([]);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleBarClick = (userId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setFixedUserIds((prev) =>
      prev.includes(userId)
        ? prev.filter((id) => id !== userId)
        : [...prev, userId]
    );
  };

  return (
    <div
      ref={containerRef}
      className="min-h-screen bg-background p-8"
    >
      <div className="max-w-7xl mx-auto space-y-8">
        {/* ヘッダー */}
        <div className="space-y-2">
          <h1 className="text-4xl font-bold text-foreground">
            トークン使用管理ダッシュボード
          </h1>
          <p className="text-muted-foreground">
            Plan毎のユーザーのトークン使用状況を確認できます。バーをクリックして詳細情報を固定化します。
          </p>
        </div>

        {/* プラン別セクション */}
        <div className="space-y-8">
          {Object.entries(MOCK_PLANS).map(([key, plan]) => (
            <PlanSection
              key={key}
              planName={plan.name}
              planColor={plan.color}
              users={plan.users}
              maxAmount={plan.maxAmount}
              fixedUserIds={fixedUserIds}
              onBarClick={handleBarClick}
            />
          ))}
        </div>

        {/* 使用カテゴリ凡例 */}
        <div className="mt-12 pt-8 border-t border-border/50">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-sm" style={{ backgroundColor: 'hsl(var(--chart-1))' }} />
              <span className="text-sm text-muted-foreground">Review</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-sm" style={{ backgroundColor: 'hsl(var(--chart-2))' }} />
              <span className="text-sm text-muted-foreground">ReviewChat</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-sm" style={{ backgroundColor: 'hsl(var(--chart-3))' }} />
              <span className="text-sm text-muted-foreground">FreeChat</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-sm" style={{ backgroundColor: 'hsl(var(--chart-4))' }} />
              <span className="text-sm text-muted-foreground">Recent</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-sm" style={{ backgroundColor: 'hsl(var(--chart-5))' }} />
              <span className="text-sm text-muted-foreground">Title</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
