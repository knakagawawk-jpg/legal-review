'use client';

import { UsageBar, UsageData } from './usage-bar';

interface UserRowProps {
  userId: string;
  userName: string;
  data: UsageData;
  maxAmount: number;
  isFixed?: boolean;
  onBarClick?: (userId: string, event: React.MouseEvent) => void;
}

export function UserRow({
  userId,
  userName,
  data,
  maxAmount,
  isFixed,
  onBarClick,
}: UserRowProps) {
  return (
    <div className="grid grid-cols-[200px_1fr] gap-6 items-start py-4 px-4 border-b border-border/50 hover:bg-accent/5 transition-colors last:border-b-0">
      {/* ユーザー名 */}
      <div className="font-medium text-foreground truncate">
        {userName}
      </div>

      {/* 使用量バー */}
      <UsageBar
        data={data}
        maxAmount={maxAmount}
        isFixed={isFixed}
        onBarClick={(e) => onBarClick?.(userId, e)}
      />
    </div>
  );
}
