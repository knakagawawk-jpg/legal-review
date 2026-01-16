# V0用プロンプト - 過去問管理ページUI

## プロジェクト概要

**Juristutor** - AI法律学習アシスタントアプリケーションの過去問管理ページのUIを改善します。

## 技術スタック

- **フレームワーク**: Next.js 14+ (App Router)
- **UIライブラリ**: shadcn/ui (Radix UI + Tailwind CSS)
- **スタイリング**: Tailwind CSS
- **アイコン**: lucide-react
- **言語**: TypeScript

## デザインシステム

### カラーパレット
- **プライマリ**: Blue系 (`from-blue-500 to-cyan-500`)
- **背景**: `bg-gradient-to-b from-background to-muted/20`
- **サイドバー**: `from-blue-50/80 via-slate-50 to-white`
- **固定ヘッダー**: `bg-background border-b shadow-sm`

### タイポグラフィ
- **ページタイトル**: `text-lg font-semibold`
- **テーブル見出し**: `text-base font-semibold`
- **テーブルヘッダー**: `TableHead` (shadcn/ui)
- **テーブルセル**: `TableCell` (shadcn/ui)

### コンポーネントスタイル
- **カード**: `Card`, `CardContent` (shadcn/ui)
- **タブ**: `Tabs`, `TabsList`, `TabsTrigger`, `TabsContent` (shadcn/ui)
- **テーブル**: `Table`, `TableHeader`, `TableBody`, `TableRow`, `TableHead`, `TableCell` (shadcn/ui)
- **スクロール**: `ScrollArea`, `ScrollBar` (shadcn/ui)

## レイアウト構造

```
┌─────────────────────────────────────────────────────────────┐
│ 固定ヘッダー (sticky top-0)                                │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ [サイドバートグル] 科目別過去問一覧  [科目タブ横スクロール]│ │
│ └─────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────────┐
│ メインコンテンツ                                            │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ 司法試験                                                 │
│ │ ┌─────────────────────────────────────────────────────┐ │
│ │ │ [テーブル: 項目名, 解いた日, 評価, 何回目, メモ, 講評]│ │
│ │ └─────────────────────────────────────────────────────┘ │
│ │                                                          │
│ │ 予備試験                                                 │
│ │ ┌─────────────────────────────────────────────────────┐ │
│ │ │ [テーブル: 項目名, 解いた日, 評価, 何回目, メモ, 講評]│ │
│ │ └─────────────────────────────────────────────────────┘ │
│ │                                                          │
│ │ その他の試験                                             │
│ │ ┌─────────────────────────────────────────────────────┐ │
│ │ │ [テーブル: 項目名, 解いた日, 評価, 何回目, メモ, 講評]│ │
│ │ └─────────────────────────────────────────────────────┘ │
│ └─────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

## 機能要件

### 1. 固定ヘッダー

#### レイアウト
- **位置**: `sticky top-0 z-10`
- **背景**: `bg-background border-b shadow-sm`
- **コンテナ**: `container mx-auto px-8 py-4 max-w-6xl`

#### 左側: サイドバートグル
- `SidebarToggle`コンポーネントを配置
- サイドバーの開閉を制御

#### 中央: タイトルと科目タブ
- **タイトル**: 「科目別過去問一覧」 (`text-lg font-semibold`)
- **科目タブ**: 横スクロール可能なタブリスト
  - `ScrollArea`と`ScrollBar`を使用
  - `TabsList`は`inline-flex w-max`で横並び
  - 全科目を表示（憲法から国際関係法（私法系）まで）
  - タブクリックで科目を切り替え

### 2. メインコンテンツ

#### レイアウト
- **コンテナ**: `container mx-auto px-8 py-6 max-w-6xl`
- **カード**: `Card`コンポーネントで囲む
- **パディング**: `CardContent`に`pt-6`

#### 科目ごとのタブコンテンツ
- 各科目ごとに`TabsContent`を配置
- `space-y-6 mt-0`で縦並び、マージンなし

#### 試験タイプ別テーブル（各科目ごとに3つ）

##### 1. 司法試験
- **見出し**: 「司法試験」 (`text-base font-semibold mb-3`)
- **テーブル**: `Table`コンポーネント
- **ボーダー**: `border rounded-lg overflow-hidden`

##### 2. 予備試験
- **見出し**: 「予備試験」 (`text-base font-semibold mb-3`)
- **テーブル**: `Table`コンポーネント
- **ボーダー**: `border rounded-lg overflow-hidden`

##### 3. その他の試験
- **見出し**: 「その他の試験」 (`text-base font-semibold mb-3`)
- **テーブル**: `Table`コンポーネント
- **ボーダー**: `border rounded-lg overflow-hidden`

### 3. テーブル構造

#### カラム構成
1. **項目名** (`w-[200px]`)
   - 過去問の項目名（例: "令和5年 憲法 第1問"）
   - `font-medium`で強調

2. **解いた日** (`w-[120px]`)
   - 日付形式（例: "2024-01-10"）

3. **評価** (`w-[80px]`)
   - 評価ランク（例: "A", "B", "C"）

4. **何回目** (`w-[80px]`)
   - 挑戦回数（例: "1回目", "2回目"）

5. **メモ** (`w-[200px]`)
   - ユーザーのメモ
   - 空の場合は "-" を表示
   - `text-sm text-muted-foreground`

6. **講評リンク** (`w-[100px]`)
   - 講評ページへのリンク
   - `ExternalLink`アイコン + 「講評を見る」テキスト
   - `text-primary hover:underline`
   - `flex items-center gap-1 text-sm`

#### 空データ時の表示
- `colSpan={6}`で全カラムを結合
- 「データがありません」と表示
- `text-center text-muted-foreground py-8`

## スタイリング詳細

### 固定ヘッダー
- **配置**: `flex items-center justify-between gap-4`
- **左側**: サイドバートグル
- **中央**: `flex-1 flex flex-col gap-3`でタイトルとタブを縦並び

### 科目タブ
- **スクロール**: `ScrollArea`で横スクロール可能
- **タブリスト**: `inline-flex w-max`で横並び
- **タブサイズ**: `text-sm`
- **スクロールバー**: `ScrollBar orientation="horizontal"`

### テーブル
- **ヘッダー**: `TableHeader` + `TableRow` + `TableHead`
- **ボディ**: `TableBody` + `TableRow` + `TableCell`
- **ホバー**: `hover:bg-muted/50`（デフォルトのTableRowスタイル）
- **ボーダー**: `border rounded-lg overflow-hidden`でテーブル全体を囲む

### リンク
- **スタイル**: `text-primary hover:underline`
- **アイコン**: `ExternalLink` (lucide-react, `h-3 w-3`)
- **レイアウト**: `flex items-center gap-1`

## 状態管理

### useStateフック
```typescript
const [selectedSubject, setSelectedSubject] = useState<string>(FIXED_SUBJECTS[0] || "憲法")
```

### サイドバー連携
```typescript
const { isOpen } = useSidebar()
```

## データ構造

### サンプルデータ（今後APIから取得）
```typescript
const sampleData = {
  shihou: [
    {
      id: number
      itemName: string        // "令和5年 憲法 第1問"
      solvedDate: string      // "2024-01-10"
      evaluation: string      // "A" | "B" | "C"
      attemptCount: number    // 1, 2, 3...
      memo: string            // ユーザーのメモ
      reviewLink: string      // "/review/1"
    }
  ],
  yobi: [...],  // 予備試験データ（同じ構造）
  other: [...] // その他の試験データ（同じ構造）
}
```

## 科目リスト

### FIXED_SUBJECTS
```typescript
const FIXED_SUBJECTS = [
  "憲法",
  "行政法",
  "民法",
  "商法",
  "民事訴訟法",
  "刑法",
  "刑事訴訟法",
  "実務基礎（民事）",
  "実務基礎（刑事）",
  "倒産法",
  "租税法",
  "経済法",
  "知的財産法",
  "労働法",
  "環境法",
  "国際関係法（公法系）",
  "国際関係法（私法系）",
  "一般教養科目",
]
```

## レスポンシブデザイン

- **モバイル**: テーブルは横スクロール可能
- **タブレット以上**: `max-w-6xl`で中央揃え
- **サイドバー**: 開閉に応じてレイアウトが調整 (`ml-52`)

## アクセシビリティ

- **テーブル**: 適切な`TableHead`と`TableCell`の使用
- **リンク**: 明確なリンクテキストとアイコン
- **キーボード操作**: タブでナビゲーション可能
- **スクリーンリーダー**: 適切なセマンティックHTML

## V0へのプロンプト例

```
Next.js 14+とshadcn/uiを使用して、過去問管理ページのUIを実装してください。

要件:
- 固定ヘッダー（sticky top-0）にサイドバートグルと科目タブを配置
- ヘッダー左側にサイドバートグル、中央に「科目別過去問一覧」タイトルと科目タブ
- 科目タブは横スクロール可能（ScrollArea使用）
- 全科目（憲法から国際関係法（私法系）まで）を表示
- メインコンテンツは各科目ごとに3つのテーブルを縦並び:
  1. 司法試験テーブル
  2. 予備試験テーブル
  3. その他の試験テーブル
- 各テーブルは6カラム: 項目名、解いた日、評価、何回目、メモ、講評リンク
- 講評リンクはExternalLinkアイコン + 「講評を見る」テキスト
- データがない場合は「データがありません」を表示
- グラデーション背景（from-background to-muted/20）
- サイドバー対応（開いている時はml-52）

使用するコンポーネント:
- Card, CardContent (shadcn/ui)
- Tabs, TabsList, TabsTrigger, TabsContent (shadcn/ui)
- Table, TableHeader, TableBody, TableRow, TableHead, TableCell (shadcn/ui)
- ScrollArea, ScrollBar (shadcn/ui)
- SidebarToggle (既存コンポーネント)
- lucide-reactアイコン（ExternalLink）

デザインスタイル:
- クリーンで機能的なテーブルデザイン
- 固定ヘッダーで常に科目選択可能
- 横スクロールで全科目にアクセス
- モダンなUIパターン
```

## 実装時の注意点

1. **shadcn/uiコンポーネントの使用**
   - 既存のコンポーネントを最大限活用
   - カスタマイズはTailwind CSSで

2. **固定ヘッダー**
   - `sticky top-0 z-10`で固定
   - スクロール時も常に表示

3. **横スクロール**
   - `ScrollArea`と`ScrollBar`で実装
   - タブが多くても全科目にアクセス可能

4. **テーブル構造**
   - 各試験タイプごとに独立したテーブル
   - 空データ時の適切な表示

5. **パフォーマンス**
   - 大量データ時の仮想化（オプション）
   - 不要な再レンダリングの防止

6. **アクセシビリティ**
   - 適切なテーブルマークアップ
   - キーボードナビゲーション対応
