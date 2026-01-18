# 法律答案講評システム

法律答案の自動講評を生成するシステムです。LLM（Claude）を使用して答案を分析し、構造化された講評を提供します。

## 機能

- **講評生成**: 論文式答案に対して自動講評を生成
- **講評チャット**: 生成された講評について LLM に質問可能
- **短答式試験**: 短答式問題を解いて正誤を確認
- **フリーチャット**: LLM との自由な対話
- **ノート機能**: 学習ノートの作成・管理
- **ユーザーダッシュボード**: 過去の答案履歴や成績分析

## 技術スタック

- **バックエンド**: FastAPI (Python)
- **フロントエンド**: Next.js 14 (React, TypeScript)
- **データベース**: SQLite
- **LLM**: Anthropic Claude API
- **認証**: Google OAuth 2.0
- **リバースプロキシ**: Caddy

## プロジェクト構造

```
law-review/
├── app/                      # バックエンド（FastAPI）
│   ├── main.py              # APIエンドポイント定義
│   ├── models.py            # データベースモデル
│   ├── schemas.py           # Pydanticスキーマ
│   ├── llm_service.py       # LLM呼び出しサービス
│   ├── auth.py              # 認証処理
│   └── db.py                # データベース接続設定
│
├── web_next/                # フロントエンド（Next.js）
│   ├── app/                 # Next.js App Router
│   │   ├── api/            # API Route Handlers (BFF)
│   │   ├── review/         # 講評生成ページ
│   │   ├── short-answer/  # 短答式試験ページ
│   │   ├── free-chat/      # フリーチャットページ
│   │   └── your-page/      # ユーザーページ
│   ├── components/         # Reactコンポーネント
│   ├── lib/                # ユーティリティ・APIクライアント
│   └── types/              # TypeScript型定義
│
├── config/                  # 設定ファイル
│   ├── settings.py         # アプリケーション設定
│   └── constants.py       # 定数定義
│
├── data/                    # データディレクトリ
│   ├── json/               # JSONデータ（年度別・科目別）
│   └── sample_problems.*   # サンプルデータ
│
├── docs/                    # ドキュメント
│   ├── AUTH_SETUP.md       # 認証設定ガイド
│   ├── DEPLOY.md           # デプロイ手順
│   └── ...                 # その他のドキュメント
│
├── scripts/                 # 管理用スクリプト
│   ├── *.py                # Pythonスクリプト（データ処理など）
│   ├── *.ps1               # PowerShellスクリプト（サーバー起動など）
│   └── *.sh                # Shellスクリプト
│
├── db_design/              # データベース設計
│   └── *.sql              # SQLスキーマファイル
│
├── prompts/                 # LLMプロンプト
│   ├── main/               # メインプロンプト
│   └── subjects/           # 科目別プロンプト
│
├── utils/                   # ユーティリティ関数
│   └── formatters.py      # 年度変換などのフォーマッター
│
├── archive/                 # アーカイブ（古いファイル）
│
├── docker-compose.yml      # Docker Compose設定
├── Dockerfile.*            # Dockerイメージ定義
├── Caddyfile*              # リバースプロキシ設定
└── requirements.txt         # Python依存関係
```


