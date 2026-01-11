#!/bin/bash
# Caddyfile.productionを環境変数から動的生成
# 使用方法: ./scripts/generate-caddyfile.sh

set -e

# プロジェクトルートディレクトリに移動
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_ROOT"

# 環境変数の読み込み（.envファイルから）
if [ -f .env ]; then
    export $(grep -v '^#' .env | grep -v '^$' | xargs)
fi

# デフォルト値の設定
DOMAIN="${CADDY_DOMAIN:-localhost}"
ENABLE_AUTH="${ENABLE_BASIC_AUTH:-false}"
AUTH_USER="${BASIC_AUTH_USER:-admin}"
AUTH_HASH="${BASIC_AUTH_PASS_HASH:-}"

# Caddyfile.productionを生成
cat > Caddyfile.production <<EOF
# 本番環境用Caddyfile（自動生成）
# 生成日時: $(date)
# ドメイン: ${DOMAIN}
# Basic認証: ${ENABLE_AUTH}

${DOMAIN} {
    # Next.js（新UI）にリバースプロキシ
    reverse_proxy web:3000
    
EOF

# Basic認証が有効化されている場合
if [ "${ENABLE_AUTH}" = "true" ] && [ -n "${AUTH_HASH}" ]; then
    cat >> Caddyfile.production <<EOF
    # Basic認証（環境変数から有効化）
    basicauth {
        ${AUTH_USER} ${AUTH_HASH}
    }
    
EOF
    echo "Basic認証を有効化しました: ユーザー名=${AUTH_USER}"
else
    cat >> Caddyfile.production <<EOF
    # Basic認証（無効化）
    # 有効化する場合は、.envファイルで以下を設定:
    # ENABLE_BASIC_AUTH=true
    # BASIC_AUTH_USER=admin
    # BASIC_AUTH_PASS_HASH=<ハッシュ値>
    
EOF
fi

cat >> Caddyfile.production <<EOF
    # セキュリティヘッダー
    header {
        X-Content-Type-Options "nosniff"
        X-Frame-Options "DENY"
        X-XSS-Protection "1; mode=block"
        Referrer-Policy "strict-origin-when-cross-origin"
    }
}

# HTTPSはCaddyが自動で証明書を取得・更新します
# Let's Encryptを使用し、初回アクセス時に自動で証明書が発行されます
# 証明書は caddy_data ボリュームに永続化されます
EOF

echo "✓ Caddyfile.productionを生成しました:"
echo "  - ドメイン: ${DOMAIN}"
echo "  - Basic認証: ${ENABLE_AUTH}"
if [ "${ENABLE_AUTH}" = "true" ]; then
    echo "  - ユーザー名: ${AUTH_USER}"
fi
