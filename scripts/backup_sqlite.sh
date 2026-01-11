#!/bin/bash
# SQLiteデータベースのバックアップスクリプト
# 使用方法: ./scripts/backup_sqlite.sh
# cronで実行する場合: 0 2 * * * cd /opt/law-review && ./scripts/backup_sqlite.sh >> /var/log/law-review-backup.log 2>&1

set -e

# プロジェクトルートディレクトリに移動（スクリプトがどこから実行されても動作するように）
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_ROOT"

# 設定
SOURCE_DB="${DATA_DIR:-./data}/dev.db"
BACKUP_DIR="./backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="${BACKUP_DIR}/dev_${TIMESTAMP}.db"

# バックアップディレクトリが存在しない場合は作成
mkdir -p "${BACKUP_DIR}"

# ソースファイルが存在しない場合はエラー
if [ ! -f "${SOURCE_DB}" ]; then
    echo "エラー: ${SOURCE_DB} が見つかりません" >&2
    exit 1
fi

# SQLiteのバックアップ（コピーではなくsqlite3の.dumpを使用して整合性を保証）
# より安全な方法: sqlite3のバックアップコマンドを使用
if command -v sqlite3 &> /dev/null; then
    # sqlite3が利用可能な場合
    sqlite3 "${SOURCE_DB}" ".backup '${BACKUP_FILE}'"
    echo "バックアップ完了: ${BACKUP_FILE}"
else
    # sqlite3が利用できない場合は単純コピー（非推奨）
    cp "${SOURCE_DB}" "${BACKUP_FILE}"
    echo "警告: sqlite3コマンドが利用できないため、単純コピーでバックアップしました: ${BACKUP_FILE}"
fi

# 古いバックアップを削除（30日以上前のファイル）
find "${BACKUP_DIR}" -name "dev_*.db" -type f -mtime +30 -delete

# バックアップファイルの圧縮（オプション、gzipが利用可能な場合）
if command -v gzip &> /dev/null; then
    gzip -f "${BACKUP_FILE}"
    echo "圧縮完了: ${BACKUP_FILE}.gz"
fi

echo "バックアップ処理が完了しました"
