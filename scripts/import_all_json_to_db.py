#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
data/jsonディレクトリ内のすべてのJSONファイルをデータベースに一括インポート

使用方法:
    python import_all_json_to_db.py
    python import_all_json_to_db.py --dry-run  # 実行前の確認のみ
"""

import json
import sys
import argparse
from pathlib import Path

# プロジェクトルートをパスに追加
BASE_DIR = Path(__file__).parent.parent
sys.path.insert(0, str(BASE_DIR))

from app.db import SessionLocal
from app.models import OfficialQuestion
from config.subjects import get_subject_id, get_subject_name

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

def import_json_file(json_file: Path, db, dry_run: bool = False, update_existing: bool = False):
    """単一のJSONファイルをデータベースに登録"""
    try:
        # JSONファイルを読み込み
        with open(json_file, "r", encoding="utf-8") as f:
            data = json.load(f)
        
        year_str = data.get("year", "")
        exam_type = data.get("exam_type", "")
        subject_raw = data.get("subject", "")
        text = data.get("text", "")
        source_pdf = data.get("source_pdf", "")
        purpose = data.get("purpose", "")
        scoring_notes = data.get("scoring_notes", "")  # 採点実感（司法試験の場合）
        
        # 年度を整数に変換
        try:
            year = year_to_int(year_str)
        except ValueError as e:
            return {"status": "error", "message": str(e)}
        
        # 試験種別を正規化（"予備" -> "yobi", "司法" -> "shihou"）
        if exam_type == "予備":
            shiken_type = "yobi"
        elif exam_type == "司法":
            shiken_type = "shihou"
        else:
            return {"status": "error", "message": f"試験種別が不正です: {exam_type}"}
        
        # 短答式問題はスキップ（別のテーブルで管理）
        if "短答" in str(subject_raw) or "短答" in json_file.name:
            return {"status": "skipped", "message": "短答式問題は別のスクリプトでインポートしてください"}

        # 科目はID（1-18）で保存する（subject_rawが科目名の想定）
        subject_id = None
        if isinstance(subject_raw, int):
            subject_id = subject_raw
        elif isinstance(subject_raw, str):
            s = "".join(subject_raw.split())
            subject_id = int(s) if s.isdigit() else get_subject_id(s)
        # フォールバック: subject_nameがある場合
        if subject_id is None and isinstance(data.get("subject_name"), str):
            s2 = "".join(str(data.get("subject_name")).split())
            subject_id = int(s2) if s2.isdigit() else get_subject_id(s2)
        if subject_id is None or not (1 <= int(subject_id) <= 18):
            return {"status": "error", "message": f"科目の形式が不正です: subject={subject_raw!r}, subject_name={data.get('subject_name')!r} ({json_file})"}
        
        # 既存のOfficialQuestionをチェック（activeなもの）
        existing_oq = db.query(OfficialQuestion).filter(
            OfficialQuestion.shiken_type == shiken_type,
            OfficialQuestion.nendo == year,
            OfficialQuestion.subject_id == subject_id,
            OfficialQuestion.status == "active"
        ).first()
        
        if dry_run:
            if existing_oq:
                if update_existing:
                    return {"status": "update", "message": "更新予定"}
                else:
                    return {"status": "exists", "message": "既に登録済み"}
            else:
                return {"status": "new", "message": "新規登録予定"}
        
        if existing_oq:
            if update_existing:
                # 既存レコードを更新
                existing_oq.text = text
                existing_oq.syutudaisyusi = purpose if purpose else None
                existing_oq.grading_impression_text = scoring_notes if (shiken_type == "shihou" and scoring_notes) else None
                db.commit()
                
                exam_type_display = "司法試験" if shiken_type == "shihou" else "予備試験"
                return {
                    "status": "updated",
                    "message": f"{exam_type_display} {year}年 {get_subject_name(subject_id)}",
                    "official_question_id": existing_oq.id
                }
            else:
                return {"status": "skipped", "message": "既に登録済み"}
        
        # OfficialQuestionを作成
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
        db.add(oq)
        db.commit()
        
        exam_type_display = "司法試験" if shiken_type == "shihou" else "予備試験"
        return {
            "status": "imported",
            "message": f"{exam_type_display} {year}年 {get_subject_name(subject_id)}",
            "official_question_id": oq.id
        }
        
    except Exception as e:
        if not dry_run:
            db.rollback()
        return {"status": "error", "message": str(e)}

def find_all_json_files(json_base_dir: Path):
    """再帰的にすべてのJSONファイルを検索"""
    json_files = []
    for json_file in json_base_dir.rglob("*.json"):
        # 短答式問題は除外（別のスクリプトで処理）
        if "短答" not in json_file.name:
            json_files.append(json_file)
    return sorted(json_files)

def main():
    parser = argparse.ArgumentParser(description="JSONファイルをデータベースに一括インポート")
    parser.add_argument("--dry-run", action="store_true", help="実行前の確認のみ（実際には登録しない）")
    parser.add_argument("--update", action="store_true", help="既存データを更新する（デフォルト: スキップ）")
    parser.add_argument("--json-dir", type=str, default=None, help="JSONディレクトリのパス（デフォルト: data/json）")
    parser.add_argument("--years", type=str, nargs="+", default=None, help="更新する年度を指定（例: H30 R5 R6）")
    args = parser.parse_args()
    
    # JSONディレクトリのパスを決定
    if args.json_dir:
        json_base_dir = Path(args.json_dir)
        if not json_base_dir.is_absolute():
            json_base_dir = BASE_DIR / json_base_dir
    else:
        json_base_dir = BASE_DIR / "data" / "json"
    
    if not json_base_dir.exists():
        print(f"エラー: ディレクトリが見つかりません: {json_base_dir}")
        sys.exit(1)
    
    print(f"JSONディレクトリ: {json_base_dir}")
    if args.dry_run:
        print("【DRY RUNモード】実際には登録しません")
    if args.update:
        print("【更新モード】既存データを更新します")
    print("=" * 80)
    
    # すべてのJSONファイルを検索
    json_files = find_all_json_files(json_base_dir)
    
    # 年度フィルタリング
    if args.years:
        target_years = set()
        for year_str in args.years:
            try:
                target_years.add(year_to_int(year_str))
            except ValueError:
                print(f"警告: 無効な年度形式: {year_str}")
        
        if target_years:
            filtered_files = []
            for json_file in json_files:
                try:
                    with open(json_file, "r", encoding="utf-8") as f:
                        data = json.load(f)
                    year = year_to_int(data.get("year", ""))
                    if year in target_years:
                        filtered_files.append(json_file)
                except:
                    pass
            json_files = filtered_files
            print(f"指定年度でフィルタリング: {args.years} -> {target_years}")
    
    print(f"見つかったJSONファイル: {len(json_files)}件")
    print("-" * 80)
    
    if not json_files:
        print("JSONファイルが見つかりませんでした。")
        return
    
    db = SessionLocal()
    
    try:
        imported_count = 0
        updated_count = 0
        skipped_count = 0
        error_count = 0
        exists_count = 0
        
        for json_file in json_files:
            relative_path = json_file.relative_to(BASE_DIR)
            result = import_json_file(json_file, db, dry_run=args.dry_run, update_existing=args.update)
            
            status = result["status"]
            message = result["message"]
            
            if status == "imported":
                print(f"✓ 登録: {relative_path}")
                print(f"  {message}")
                print(f"  OfficialQuestion ID: {result.get('official_question_id')}")
                imported_count += 1
            elif status == "updated":
                print(f"↻ 更新: {relative_path}")
                print(f"  {message}")
                print(f"  OfficialQuestion ID: {result.get('official_question_id')}")
                updated_count += 1
            elif status == "skipped":
                print(f"- スキップ: {relative_path} ({message})")
                skipped_count += 1
            elif status == "exists":
                print(f"○ 既存: {relative_path} ({message})")
                exists_count += 1
            elif status == "update":
                print(f"↻ 更新予定: {relative_path} ({message})")
                updated_count += 1
            elif status == "new":
                print(f"+ 新規: {relative_path} ({message})")
                imported_count += 1
            elif status == "error":
                print(f"✗ エラー: {relative_path}")
                print(f"  {message}")
                error_count += 1
        
        print("\n" + "=" * 80)
        print("処理完了:")
        if args.dry_run:
            print(f"  新規登録予定: {imported_count}件")
            if args.update:
                print(f"  更新予定: {updated_count}件")
            print(f"  既存: {exists_count}件")
        else:
            print(f"  登録: {imported_count}件")
            if args.update:
                print(f"  更新: {updated_count}件")
            print(f"  スキップ: {skipped_count}件")
        print(f"  エラー: {error_count}件")
        
    finally:
        db.close()

if __name__ == "__main__":
    main()
