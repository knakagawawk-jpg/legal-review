# V0用プロンプト - YourPageダッシュボードUI

## プロジェクト概要

**Juristutor** - AI法律学習アシスタントアプリケーションのYourPageダッシュボード機能のUIを改善します。

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
- **カード背景**: `bg-muted` (折りたたみ詳細用)

### タイポグラフィ
- **メインタイトル**: `text-4xl font-bold`
- **サブタイトル**: `text-lg text-muted-foreground`
- **カードタイトル**: `CardTitle` (shadcn/ui)
- **説明文**: `CardDescription` (shadcn/ui)
- **タイマー時間**: `text-lg font-semibold`
- **小さいテキスト**: `text-xs text-muted-foreground`

### コンポーネントスタイル
- **カード**: `Card`, `CardHeader`, `CardContent`, `CardDescription` (shadcn/ui)
- **入力欄**: `Textarea` (shadcn/ui)
- **スイッチ**: `Switch` (shadcn/ui)
- **ラベル**: `Label` (shadcn/ui)
- **折りたたみ**: `Collapsible`, `CollapsibleTrigger`, `CollapsibleContent` (shadcn/ui)

## レイアウト構造

```
┌─────────────────────────────────────────────────────┐
│ ヘッダー                                            │
│ 📚 Your Page                    [タイマー] [サイドバー]│
│ ダッシュボード                                      │
│                                                     │
│ タイマー詳細（折りたたみ可能）                      │
│ ┌─────────────────────────┐                        │
│ │ 00:00:00                │                        │
│ │ タイマーは見た目のみです │                        │
│ └─────────────────────────┘                        │
└─────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────┐
│ 📌 今日の目標                                        │
│ [Textarea: 今日達成したい目標を入力してください]    │
└─────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────┐
│ 📖 Today's メモ                                      │
│ 重点メモ: [Textarea]                                │
│ 勉強した項目: [Textarea]                            │
└─────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────┐
│ 🔄 昨日の復習問題                                    │
│ [復習問題の表示は今後実装予定です]                  │
└─────────────────────────────────────────────────────┘
```

## 機能要件

### 1. ヘッダー部分

#### 左側
- **タイトル**: 「📚 Your Page」 (`text-4xl font-bold`)
- **サブタイトル**: 「ダッシュボード」 (`text-lg text-muted-foreground`)

#### 右側
- **タイマーコントロール**（右上に配置）
  - 時計アイコン (`Clock` from lucide-react)
  - 「タイマー」ラベル (`text-sm font-medium`)
  - スイッチ (`Switch` component)
  - 状態表示:
    - **On時**: 「0時間0分」 (`text-lg font-semibold`) + 「勉強中...」 (`text-xs text-muted-foreground`)
    - **Off時**: 「停止中」 (`text-xs text-muted-foreground`)
  - 「詳細」ボタン（折りたたみ用、ChevronDownアイコン付き）

- **サイドバートグル** (`SidebarToggle` component)

### 2. タイマー詳細（折りたたみ可能）

- **トリガー**: 「詳細」ボタンをクリック
- **表示内容**:
  - 大きなタイマー表示: 「00:00:00」 (`text-3xl font-bold`)
  - 説明文: 「タイマーは見た目のみです」 (`text-sm text-muted-foreground`)
- **スタイル**: 
  - カード形式 (`Card`, `CardContent`)
  - 幅300px (`w-[300px]`)
  - 中央揃え (`text-center`)
  - 背景: `bg-muted rounded-lg`
- **アニメーション**: ChevronDownアイコンが回転（`rotate-180`）

### 3. メインコンテンツ（縦並び）

#### 3.1 今日の目標カード
- **アイコン**: `Target` (lucide-react, `h-5 w-5 text-primary`)
- **タイトル**: 「今日の目標」
- **説明**: 「今日達成したい目標を入力してください」
- **入力欄**: `Textarea` (最小高さ100px)
- **プレースホルダー**: 「例: 民法の時効について理解を深める」

#### 3.2 Today's メモカード
- **アイコン**: `BookOpen` (lucide-react, `h-5 w-5 text-primary`)
- **タイトル**: 「Today's メモ」
- **説明**: 「今日の重点メモと勉強した項目」
- **入力欄1**: 「重点メモ」
  - `Label`: 「重点メモ」 (`text-sm font-medium`)
  - `Textarea` (最小高さ80px)
  - プレースホルダー: 「今日の重点メモを入力...」
- **入力欄2**: 「勉強した項目」
  - `Label`: 「勉強した項目」 (`text-sm font-medium`)
  - `Textarea` (最小高さ80px)
  - プレースホルダー: 「今日勉強した項目を入力...」

#### 3.3 昨日の復習問題カード
- **アイコン**: `RotateCcw` (lucide-react, `h-5 w-5 text-primary`)
- **タイトル**: 「昨日の復習問題」
- **説明**: 「復習が必要な問題を表示」
- **内容**: プレースホルダーテキスト「復習問題の表示は今後実装予定です」
  - 中央揃え (`text-center`)
  - パディング: `p-8`
  - テキスト: `text-sm text-muted-foreground`

## スタイリング詳細

### レイアウト
- **コンテナ**: `container mx-auto px-8 py-12 max-w-4xl`
- **カード間隔**: `space-y-6` (縦並び)
- **サイドバー対応**: `ml-52` (サイドバーが開いている時)

### タイマー部分
- **配置**: `flex flex-col items-end gap-2`
- **スイッチ行**: `flex items-center gap-2`
- **詳細ボタン**: `text-xs text-muted-foreground hover:text-foreground flex items-center gap-1`

### カードスタイル
- **標準カード**: shadcn/uiの`Card`コンポーネント
- **ヘッダー**: `CardHeader` + アイコンとタイトルを横並び (`flex items-center gap-2`)
- **コンテンツ**: `CardContent` + 適切なパディング

## 状態管理

### useStateフック
```typescript
const [todayGoal, setTodayGoal] = useState("")
const [focusMemo, setFocusMemo] = useState("")
const [studyItems, setStudyItems] = useState("")
const [timerEnabled, setTimerEnabled] = useState(false)
const [timerDetailsOpen, setTimerDetailsOpen] = useState(false)
```

### サイドバー連携
```typescript
const { isOpen } = useSidebar()
```

## インタラクション

### タイマー
- **スイッチ切り替え**: `onCheckedChange`で`timerEnabled`を更新
- **詳細表示**: `Collapsible`コンポーネントで折りたたみ制御
- **状態表示**: `timerEnabled`に応じて表示内容を変更

### 入力欄
- **リアルタイム更新**: `onChange`で各stateを更新
- **プレースホルダー**: 適切なガイダンスを表示

## レスポンシブデザイン

- **モバイル**: カードは全幅表示
- **タブレット以上**: `max-w-4xl`で中央揃え
- **サイドバー**: 開閉に応じてレイアウトが調整 (`ml-52`)

## アクセシビリティ

- **ラベル**: `Label`コンポーネントで適切なラベル付け
- **スイッチ**: `id`と`htmlFor`で関連付け
- **キーボード操作**: すべてのインタラクティブ要素がキーボードで操作可能
- **フォーカス管理**: 適切なフォーカス順序

## V0へのプロンプト例

```
Next.js 14+とshadcn/uiを使用して、YourPageダッシュボードのUIを実装してください。

要件:
- ヘッダーに「📚 Your Page」タイトルと右上にタイマーコントロール
- タイマーは時計アイコン + 「タイマー」ラベル + スイッチ
- スイッチOn時は「0時間0分」と「勉強中...」を表示
- スイッチOff時は「停止中」を表示
- 「詳細」ボタンで折りたたみ可能なタイマー詳細を表示（00:00:00形式）
- メインコンテンツは縦並びの3つのカード:
  1. 今日の目標（Textarea）
  2. Today's メモ（重点メモと勉強した項目の2つのTextarea）
  3. 昨日の復習問題（プレースホルダー）
- グラデーション背景（from-background to-muted/20）
- サイドバー対応（開いている時はml-52）

使用するコンポーネント:
- Card, CardHeader, CardContent, CardDescription (shadcn/ui)
- Textarea (shadcn/ui)
- Switch (shadcn/ui)
- Label (shadcn/ui)
- Collapsible, CollapsibleTrigger, CollapsibleContent (shadcn/ui)
- lucide-reactアイコン（Target, BookOpen, RotateCcw, Clock, ChevronDown）

デザインスタイル:
- ミニマルでクリーン
- 適度なスペーシング（space-y-6）
- 角丸とシャドウ
- スムーズなアニメーション（折りたたみ時）
- モダンなUIパターン
```

## 実装時の注意点

1. **shadcn/uiコンポーネントの使用**
   - 既存のコンポーネントを最大限活用
   - カスタマイズはTailwind CSSで

2. **状態管理**
   - 各入力欄は独立したstateで管理
   - タイマーの状態と詳細表示の状態を分離

3. **レスポンシブ対応**
   - モバイルではタイマーも縦並びに調整
   - カードは全幅表示

4. **アクセシビリティ**
   - 適切なラベル付け
   - キーボード操作対応
   - フォーカス管理

5. **パフォーマンス**
   - 不要な再レンダリングの防止
   - 状態更新の最適化
