# V0用プロンプト - フリーチャット機能UI

## プロジェクト概要

**Juristutor** - AI法律学習アシスタントアプリケーションのフリーチャット機能のUIを改善します。

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
- **アクセント**: Emerald/Teal系 (`from-emerald-500 to-teal-500`)

### タイポグラフィ
- **見出し**: `text-4xl font-bold`
- **サブ見出し**: `text-lg text-muted-foreground`
- **本文**: `text-sm`
- **小さいテキスト**: `text-xs`

### コンポーネントスタイル
- **カード**: `Card`, `CardContent` (shadcn/ui)
- **ボタン**: `Button` (shadcn/ui)
- **入力欄**: `Textarea` (shadcn/ui)
- **アラート**: `Alert`, `AlertDescription` (shadcn/ui)

## 機能要件

### 1. フリーチャットページ (`/free-chat/[id]`)

#### レイアウト構造
```
┌─────────────────────────────────────┐
│ ヘッダー                            │
│ 💬 フリーチャット                   │
│ スレッドタイトル（または「新しいチャット」）│
└─────────────────────────────────────┘
┌─────────────────────────────────────┐
│ チャット履歴エリア（スクロール可能）    │
│ - ユーザーメッセージ（右寄せ）        │
│ - AIメッセージ（左寄せ）             │
│ - ローディング表示                   │
└─────────────────────────────────────┘
┌─────────────────────────────────────┐
│ 入力エリア                           │
│ [Textarea] [送信ボタン]             │
│ Enterで送信、Shift+Enterで改行      │
└─────────────────────────────────────┘
```

#### 機能詳細

1. **メッセージ表示**
   - ユーザーメッセージ: 右寄せ、プライマリカラー背景
   - AIメッセージ: 左寄せ、muted背景
   - 最大幅80%、角丸、パディング適切
   - 改行を保持（`whitespace-pre-wrap`）

2. **入力機能**
   - Textarea（最小高さ100px、リサイズ不可）
   - 送信ボタン（ローディング時はスピナー表示）
   - Enterで送信、Shift+Enterで改行
   - 送信時は入力欄をクリア

3. **ローディング状態**
   - メッセージ送信中は「考えています...」とスピナー表示
   - 入力欄と送信ボタンを無効化

4. **エラー処理**
   - エラー時はAlertコンポーネントで表示
   - 破壊的スタイル（`variant="destructive"`）

5. **自動スクロール**
   - 新しいメッセージ追加時に最下部に自動スクロール
   - スムーズなアニメーション

6. **空状態**
   - メッセージがない場合のプレースホルダー
   - 「💡 自由に質問や会話を始めてください」
   - 「法律に関する質問も、一般的な質問も可能です」

### 2. サイドバー統合

#### スレッド履歴セクション
- フリーチャットページ表示時に表示
- 直近10件のスレッド履歴を表示
- 各スレッドをクリックで該当ページに遷移
- アクティブなスレッドはハイライト表示

#### スタイル
- セクションタイトル: 「履歴」（小さい、大文字）
- スレッドアイテム: ホバー効果、アクティブ状態の視覚的フィードバック
- タイトルがない場合は「新しいチャット」と表示

## データ構造

### Thread型
```typescript
interface Thread {
  id: number
  user_id: number
  type: string
  title?: string | null
  created_at: string
  last_message_at?: string | null
  is_archived: boolean
  pinned: boolean
}
```

### Message型
```typescript
interface Message {
  id: number
  thread_id: number
  role: "user" | "assistant" | "system"
  content: string
  created_at: string
  model?: string | null
  prompt_version?: string | null
  input_tokens?: number | null
  output_tokens?: number | null
  cost_yen?: number | null
  request_id?: string | null
}
```

## API仕様

### エンドポイント
- `GET /api/threads/[id]` - スレッド情報取得
- `GET /api/threads/[id]/messages` - メッセージ一覧取得
- `POST /api/threads/[id]/messages` - メッセージ送信
- `GET /api/threads?limit=10&type=free_chat` - スレッド一覧取得

## UI改善のポイント

### 現在の実装の課題
1. シンプルすぎるデザイン
2. メッセージの視認性が低い可能性
3. モバイル対応が不十分
4. タイムスタンプ表示がない
5. メッセージのコピー機能がない

### 改善提案
1. **メッセージカードの改善**
   - より明確な視覚的区別
   - アバターアイコンの追加（オプション）
   - タイムスタンプ表示
   - メッセージアクション（コピー、削除など）

2. **レスポンシブデザイン**
   - モバイルでの最適化
   - タブレット対応

3. **UX改善**
   - メッセージ送信時のアニメーション
   - スムーズなトランジション
   - キーボードショートカット

4. **視覚的フィードバック**
   - メッセージ送信成功/失敗の通知
   - タイピングインジケーター（オプション）

## デザインリファレンス

### 現在のUI特徴
- グラデーション背景
- カードベースのレイアウト
- ミニマルなデザイン
- ブルー系のカラースキーム
- 角丸の多用
- 適度なシャドウ

### 参考にすべきUIパターン
- ChatGPT風のチャットインターフェース
- モダンなメッセージングアプリ（Discord、Slackなど）
- クリーンで機能的なデザイン

## 実装時の注意点

1. **shadcn/uiコンポーネントの使用**
   - 既存のコンポーネントを最大限活用
   - カスタマイズはTailwind CSSで

2. **アクセシビリティ**
   - キーボードナビゲーション対応
   - ARIA属性の適切な使用
   - フォーカス管理

3. **パフォーマンス**
   - メッセージリストの仮想化（大量メッセージ時）
   - 画像の最適化
   - 不要な再レンダリングの防止

4. **エラーハンドリング**
   - ネットワークエラーの適切な表示
   - リトライ機能（オプション）
   - ユーザーフレンドリーなエラーメッセージ

## V0へのプロンプト例

```
Next.js 14+とshadcn/uiを使用して、フリーチャット機能のUIを改善してください。

要件:
- ChatGPT風のモダンなチャットインターフェース
- ユーザーメッセージは右寄せ、AIメッセージは左寄せ
- グラデーション背景（from-background to-muted/20）
- ブルー系のカラースキーム
- メッセージカードは角丸、適切なパディング
- 入力欄はTextarea、送信ボタンはSendアイコン
- ローディング状態の表示
- 自動スクロール機能
- 空状態のプレースホルダー
- レスポンシブデザイン

使用するコンポーネント:
- Card, CardContent (shadcn/ui)
- Button (shadcn/ui)
- Textarea (shadcn/ui)
- Alert (shadcn/ui)
- lucide-reactアイコン（Loader2, Send, AlertCircle）

デザインスタイル:
- ミニマルでクリーン
- 適度なシャドウと角丸
- スムーズなアニメーション
- モダンなUIパターン
```
