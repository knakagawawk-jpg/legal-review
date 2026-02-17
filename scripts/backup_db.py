#!/usr/bin/env python3
"""
DB自動バックアップスクリプト（日次・週次、OneDrive保存）

- 毎日: daily/ に日次バックアップを保存し、直近 N 日分のみ保持（古いものは削除）
- 日曜のみ: 同じ内容を weekly/ に週次スナップショットとして保存

使用方法:
    cd law-review && python scripts/backup_db.py

ローカルで実行する場合: .env の DATABASE_URL が本番用（sqlite:////data/...）のときは、
プロジェクト直下の DB を指すように指定すること（例: sqlite:///./data/dev.db）。

環境変数（.env またはシステム）:
    DATABASE_URL                  - 対象DB（例: sqlite:///./data/dev.db）
    BACKUP_ONEDRIVE_ROOT          - 保存先ルート（必須）
    DAILY_BACKUP_RETENTION_DAYS   - 日次保持日数（省略時 7）

タスクスケジューラ: 毎日 4:00 に実行するタスクを登録する。
    scripts/setup_backup_task.ps1 を参照。
"""
from __future__ import annotations

import logging
import os
import re
import shutil
import sys
from datetime import datetime
from pathlib import Path

# プロジェクトルートを基準に .env を読み込む
_PROJECT_ROOT = Path(__file__).resolve().parent.parent
if str(_PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(_PROJECT_ROOT))

_env_path = _PROJECT_ROOT / ".env"


def _load_backup_env() -> None:
    """プロジェクトルートの .env を読み、BACKUP_ONEDRIVE_ROOT 等を環境変数に設定する。"""
    try:
        from dotenv import load_dotenv
        if _env_path.exists():
            load_dotenv(str(_env_path), override=True)
    except ImportError:
        pass
    # dotenv で読めなかった場合のフォールバック: .env を直接パース（BOM/クォート対策）
    if not os.getenv("BACKUP_ONEDRIVE_ROOT", "").strip() and _env_path.exists():
        try:
            raw = _env_path.read_text(encoding="utf-8-sig").strip()
            for line in raw.splitlines():
                line = line.strip()
                if not line or line.startswith("#"):
                    continue
                if line.startswith("BACKUP_ONEDRIVE_ROOT="):
                    val = line.split("=", 1)[1].strip().split("#")[0].strip()
                    if val.startswith('"') and val.endswith('"') and len(val) >= 2:
                        val = val[1:-1].replace("\\", os.sep)
                    if val:
                        os.environ["BACKUP_ONEDRIVE_ROOT"] = val
                    break
        except Exception:
            pass


_load_backup_env()

# ログは標準出力に出す（タスクスケジューラでログファイルにリダイレクトしやすい）
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
    stream=sys.stdout,
)
logger = logging.getLogger(__name__)

# 日次ファイル名のパターン（同一DB名のものだけローテーション対象にする）
DAILY_FILENAME_PATTERN = re.compile(r"^(.+)_(\d{4}-\d{2}-\d{2})_0400\.db$")
BACKUP_HOUR_LABEL = "0400"  # 28:00 = 4:00


def get_db_path_from_url(database_url: str, project_root: Path) -> Path | None:
    """
    DATABASE_URL（SQLite）から実ファイルパスを取得する。
    相対パスの場合は project_root 基準で解決する。
    """
    url = (database_url or "").strip()
    if not url or "sqlite" not in url.lower():
        return None

    if url.startswith("sqlite:////"):
        # 絶対パス: sqlite:////data/dev.db -> /data/dev.db / sqlite:///C:/path -> C:/path
        raw = url.replace("sqlite:////", "", 1)
        if len(raw) >= 2 and raw[1] == ":":
            return Path(raw)  # Windows
        return Path(raw) if raw.startswith("/") else Path("/" + raw)  # Unix
    if url.startswith("sqlite:///./"):
        raw = url.replace("sqlite:///./", "", 1)
        return (project_root / raw).resolve()
    if url.startswith("sqlite:///"):
        raw = url.replace("sqlite:///", "", 1)
        return (project_root / raw).resolve()
    return None


def get_db_basename_without_ext(db_path: Path) -> str:
    """例: dev.db -> dev"""
    return db_path.stem


def ensure_dir(path: Path) -> None:
    path.mkdir(parents=True, exist_ok=True)


def run_backup() -> None:
    project_root = _PROJECT_ROOT
    database_url = os.getenv("DATABASE_URL", "sqlite:///./data/dev.db")
    backup_root = os.getenv("BACKUP_ONEDRIVE_ROOT", "").strip()
    retention_days = int(os.getenv("DAILY_BACKUP_RETENTION_DAYS", "7"))

    if not backup_root:
        logger.error("BACKUP_ONEDRIVE_ROOT が未設定です。.env または環境変数を設定してください。")
        sys.exit(1)

    backup_root_path = Path(backup_root)
    db_path = get_db_path_from_url(database_url, project_root)
    if not db_path or not db_path.exists():
        logger.error("対象DBファイルが見つかりません: %s", db_path or database_url)
        sys.exit(1)

    db_name = get_db_basename_without_ext(db_path)
    now = datetime.now()
    date_str = now.strftime("%Y-%m-%d")
    is_sunday = now.weekday() == 6  # Monday=0, Sunday=6

    daily_dir = backup_root_path / "daily"
    weekly_dir = backup_root_path / "weekly"
    ensure_dir(daily_dir)
    ensure_dir(weekly_dir)

    # 日次バックアップ
    daily_filename = f"{db_name}_{date_str}_{BACKUP_HOUR_LABEL}.db"
    daily_dest = daily_dir / daily_filename
    try:
        shutil.copy2(db_path, daily_dest)
        logger.info("日次バックアップ作成: %s", daily_dest)
    except OSError as e:
        logger.exception("日次バックアップの作成に失敗しました: %s", e)
        sys.exit(1)

    # 日次ローテーション: 同一 db_name の日次ファイルを古い順に並べ、保持数を超えた分を削除
    try:
        to_remove = []
        same_db_dailies: list[tuple[Path, str]] = []
        for f in daily_dir.iterdir():
            if not f.is_file():
                continue
            m = DAILY_FILENAME_PATTERN.match(f.name)
            if not m:
                continue
            name_part, date_part = m.group(1), m.group(2)
            if name_part != db_name:
                continue
            same_db_dailies.append((f, date_part))

        same_db_dailies.sort(key=lambda x: x[1])
        if len(same_db_dailies) > retention_days:
            for f, _ in same_db_dailies[: len(same_db_dailies) - retention_days]:
                to_remove.append(f)
        for f in to_remove:
            try:
                f.unlink()
                logger.info("古い日次バックアップを削除: %s", f.name)
            except OSError as e:
                logger.warning("削除に失敗しました %s: %s", f, e)
    except OSError as e:
        logger.warning("日次ローテーション中のエラー（処理は続行）: %s", e)

    # 週次: 日曜のみ weekly/ にコピー
    if is_sunday:
        weekly_filename = f"{db_name}_{date_str}_weekly.db"
        weekly_dest = weekly_dir / weekly_filename
        try:
            shutil.copy2(daily_dest, weekly_dest)
            logger.info("週次スナップショット作成: %s", weekly_dest)
        except OSError as e:
            logger.exception("週次バックアップの作成に失敗しました: %s", e)
            # 日次は成功しているので exit はしない

    logger.info("バックアップ処理を完了しました。")


if __name__ == "__main__":
    run_backup()
