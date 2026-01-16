# .env.example への追加項目

`.env.example` ファイルに以下を追加してください：

```bash
# Next.js用（FastAPIへの内部接続URL）
BACKEND_INTERNAL_URL=http://backend:8000

# Next.js用（講評生成のタイムアウト、ミリ秒、デフォルト: 240000 = 240秒）
REVIEW_TIMEOUT_MS=240000
```

**既存の .env.example に追加する位置:**
- `BACKEND_INTERNAL_URL` は FastAPI関連の設定の後に追加
- `REVIEW_TIMEOUT_MS` は Next.js関連の設定の後に追加
