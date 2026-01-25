#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
データベース初期化スクリプト
- JSONファイルを再帰的に探索してOfficialQuestionテーブルにインポート
"""

import json
import sys
import logging
from pathlib import Path

# ロギング設定
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# プロジェクトルートをパスに追加（Docker/ローカル両対応）
BASE_DIR = Path("/app") if Path("/app").exists() else Path(__file__).parent.parent
sys.path.insert(0, str(BASE_DIR))

from app.db import SessionLocal, engine, Base
from app.models import OfficialQuestion, Submission, Review, User
from config.subjects import get_subject_id
from sqlalchemy import text

def year_to_int(year_str: str) -> int:
    """年度文字列を整数に変換
    
    例: "R7" -> 2025, "H30" -> 2018
    """
    if year_str.startswith("R"):
        # 令和: R1 = 2019, R2 = 2020, ...
        reiwa_num = int(year_str[1:])
        return 2018 + reiwa_num
    elif year_str.startswith("H"):
        # 平成: H1 = 1989, H30 = 2018
        heisei_num = int(year_str[1:])
        return 1988 + heisei_num
    else:
        # 数値として解釈を試みる
        try:
            return int(year_str)
        except:
            raise ValueError(f"年度の形式が不正です: {year_str}")

def import_all_json_files():
    """JSONディレクトリを再帰的に探索してインポート"""
    db = SessionLocal()
    # Docker: /data/json（volume mount）
    # ローカル: <repo>/data/json
    json_base_dir = Path("/data/json") if Path("/data/json").exists() else (BASE_DIR / "data" / "json")
    
    try:
        if not json_base_dir.exists():
            logger.warning(f"JSON directory not found: {json_base_dir}")
            return
        
        # 再帰的にJSONファイルを探索
        json_files = list(json_base_dir.rglob("*.json"))
        
        if not json_files:
            logger.info("No JSON files found")
            return
        
        logger.info(f"Found {len(json_files)} JSON files")
        logger.info("-" * 60)
        
        imported_count = 0
        skipped_count = 0
        error_count = 0
        batch_size = 50  # バッチサイズ
        
        # 既存データを一度に取得（パフォーマンス改善）
        # 初期化時のみなので全件取得でも問題ない
        existing_problems = {
            (oq.shiken_type, oq.nendo, oq.subject_id)
            for oq in db.query(OfficialQuestion).filter(OfficialQuestion.status == "active").all()
        }
        
        problems_to_add = []
        
        for json_file in json_files:
            try:
                with open(json_file, "r", encoding="utf-8") as f:
                    data = json.load(f)
                
                year_str = data.get("year", "")
                exam_type = data.get("exam_type", "")
                subject_raw = data.get("subject", "")
                subject_str = str(subject_raw).strip()
                text = data.get("text", "")
                purpose = data.get("purpose", "")
                source_pdf = data.get("source_pdf", "")
                
                try:
                    year = year_to_int(year_str)
                except ValueError as e:
                    logger.error(f"Error parsing year in {json_file.name}: {e}")
                    error_count += 1
                    continue
                
                # 試験種別を正規化（"予備" -> "yobi", "司法" -> "shihou"）
                if exam_type == "予備":
                    shiken_type = "yobi"
                elif exam_type == "司法":
                    shiken_type = "shihou"
                else:
                    logger.error(f"Invalid exam_type in {json_file.name}: {exam_type}")
                    error_count += 1
                    continue
                
                # 科目をID（1-18）に変換して保持
                subject_id = get_subject_id(subject_str) if not subject_str.isdigit() else int(subject_str)
                if not subject_id or not (1 <= subject_id <= 18):
                    logger.error(f"Invalid subject in {json_file.name}: {subject_str}")
                    error_count += 1
                    continue

                # 短答式問題はスキップ（別のスクリプトで処理）
                if "短答" in subject_str or "短答" in json_file.name:
                    skipped_count += 1
                    continue

                # 既存の問題をチェック（activeなOfficialQuestion）
                key = (shiken_type, year, subject_id)
                if key in existing_problems:
                    skipped_count += 1
                    continue
                
                # 採点実感を取得
                scoring_notes = data.get("scoring_notes", "")
                
                # OfficialQuestionを作成（バッチコミット用）
                oq = OfficialQuestion(
                    shiken_type=shiken_type,
                    nendo=year,
                    subject_id=subject_id,
                    version=1,
                    status="active",
                    text=text,
                    syutudaisyusi=purpose if purpose else None,
                    grading_impression_text=scoring_notes if (shiken_type == "shihou" and scoring_notes) else None,
                )
                problems_to_add.append(oq)
                existing_problems.add(key)  # 重複を防ぐ
                
                # バッチサイズに達したらコミット
                if len(problems_to_add) >= batch_size:
                    db.bulk_save_objects(problems_to_add)
                    db.commit()
                    logger.info(f"Imported batch: {len(problems_to_add)} problems")
                    imported_count += len(problems_to_add)
                    problems_to_add = []
                
            except Exception as e:
                logger.error(f"Error processing {json_file.name}: {str(e)}")
                error_count += 1
        
        # 残りをコミット
        if problems_to_add:
            for oq in problems_to_add:
                db.add(oq)
            db.commit()
            imported_count += len(problems_to_add)
            logger.info(f"Imported final batch: {len(problems_to_add)} official questions")
        
        logger.info("-" * 60)
        logger.info(f"Import complete: imported={imported_count}, skipped={skipped_count}, errors={error_count}")
        
    except Exception as e:
        db.rollback()
        logger.error(f"Fatal error during import: {str(e)}", exc_info=True)
        raise
    finally:
        db.close()

def check_needs_import():
    """OfficialQuestionテーブルが空かチェック"""
    db = SessionLocal()
    try:
        count = db.query(OfficialQuestion).filter(OfficialQuestion.status == "active").count()
        return count == 0
    except Exception as e:
        logger.error(f"Error checking database: {str(e)}")
        # テーブルが存在しない場合はインポートが必要
        return True
    finally:
        db.close()

def create_dashboard_items_trigger():
    """dashboard_itemsテーブルのupdated_at自動更新トリガーを作成"""
    db = SessionLocal()
    try:
        # SQLiteのトリガーを作成
        trigger_sql = """
        CREATE TRIGGER IF NOT EXISTS trg_dashboard_items_updated_at
        AFTER UPDATE ON dashboard_items
        FOR EACH ROW
        WHEN NEW.updated_at = OLD.updated_at
        BEGIN
            UPDATE dashboard_items
            SET updated_at = datetime('now')
            WHERE id = NEW.id;
        END;
        """
        db.execute(text(trigger_sql))
        db.commit()
        logger.info("✓ Dashboard items trigger created")
    except Exception as e:
        logger.warning(f"Failed to create dashboard items trigger (may already exist): {str(e)}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    try:
        # データベーステーブルを作成
        logger.info("Creating database tables...")
        Base.metadata.create_all(bind=engine)
        logger.info("✓ Database tables created")
        
        # Dashboard items triggerを作成
        create_dashboard_items_trigger()
        
        # OfficialQuestionテーブルが空かチェック
        if check_needs_import():
            logger.info("Database is empty. Starting import...")
            import_all_json_files()
        else:
            logger.info("Database already has data. Skipping import.")
            
    except Exception as e:
        logger.error(f"Database initialization failed: {str(e)}", exc_info=True)
        sys.exit(1)
