"use client"

import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export default function FmDmFirstMonthSignupPage() {
  return (
    <main className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
      <Card className="w-full max-w-xl">
        <CardHeader>
          <CardTitle>Basic Plan (for 1st Month)</CardTitle>
          <CardDescription>
            初月限定キャンペーン: <span className="line-through">3,980円</span> → 1,000円（税抜き）
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-slate-600">
            このページ経由でプラン購入に進むと、初月限定価格で Basic Plan (for 1st Month) を選択できます。
          </p>
          <div className="flex gap-2">
            <Link href="/your-page/settings?via=fm-dm">
              <Button>Manage Your Plan へ進む</Button>
            </Link>
            <Link href="/">
              <Button variant="outline">ホームへ戻る</Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </main>
  )
}
