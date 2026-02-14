'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { UserRow } from './user-row';
import { UsageData } from './usage-bar';

interface User {
  id: string;
  name: string;
  data: UsageData;
}

interface PlanSectionProps {
  planName: string;
  planColor: string;
  users: User[];
  maxAmount: number;
  fixedUserIds?: string[];
  onBarClick?: (userId: string, event: React.MouseEvent) => void;
}

export function PlanSection({
  planName,
  planColor,
  users,
  maxAmount,
  fixedUserIds = [],
  onBarClick,
}: PlanSectionProps) {
  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-4 border-b border-border/50">
        <div className="flex items-center gap-3">
          <div
            className="w-4 h-4 rounded-full"
            style={{ backgroundColor: planColor }}
          />
          <CardTitle className="text-lg">{planName}</CardTitle>
          <span className="ml-auto text-sm text-muted-foreground">
            {users.length}ユーザー
          </span>
        </div>
      </CardHeader>

      <CardContent className="p-0">
        <div className="divide-y divide-border/30">
          {users.map((user) => (
            <UserRow
              key={user.id}
              userId={user.id}
              userName={user.name}
              data={user.data}
              maxAmount={maxAmount}
              isFixed={fixedUserIds.includes(user.id)}
              onBarClick={onBarClick}
            />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
