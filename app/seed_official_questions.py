#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
official_questions を ProblemMetadata/ProblemDetails から初期生成（SQLite向け）

前提（ユーザー要件）:
- 公式問題は (種別, 年度, 科目ID) で一意（activeは1つ）
- 問題番号/設問番号は使わない

既存DBには problem_metadata / problem_details が入っているため、
そこから official_questions (version=1, status='active') を作成する。
司法試験の場合は problem_details.scoring_notes を採点実感として保存する。

冪等:
- official_questions が 0件のときのみ seed を試みる
"""

import sys
import logging
from pathlib import Path

from sqlalchemy.exc import IntegrityError

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)

BASE_DIR = Path("/app") if Path("/app").exists() else Path(__file__).parent.parent
sys.path.insert(0, str(BASE_DIR))

try:
    from app.db import SessionLocal
    from app.models import OfficialQuestion, ShihouGradingImpression, ProblemMetadata, ProblemDetails
    from config.subjects import get_subject_id
except ImportError:
    import os
    os.chdir(str(BASE_DIR))
    from app.db import SessionLocal
    from app.models import OfficialQuestion, ShihouGradingImpression, ProblemMetadata, ProblemDetails
    from config.subjects import get_subject_id


def seed_official_questions_if_empty() -> int:
    db = SessionLocal()
    try:
        # 部分的に既に投入されている可能性があるため、「空ならスキップ」ではなく
        # 「不足分のみ投入」する（冪等・並行実行にも耐える）
        existing_active_keys = set(
            db.query(OfficialQuestion.shiken_type, OfficialQuestion.nendo, OfficialQuestion.subject_id)
            .filter(OfficialQuestion.status == "active")
            .all()
        )

        meta_rows = db.query(ProblemMetadata).all()
        if not meta_rows:
            logger.info("problem_metadata is empty. Nothing to seed.")
            return 0

        shiken_type_map = {"司法試験": "shihou", "予備試験": "yobi"}
        created = 0

        for meta in meta_rows:
            shiken_type = shiken_type_map.get(meta.exam_type)
            if not shiken_type:
                continue

            # problem_metadata.subject は DB 過去データで文字列が混在し得るため正規化する
            raw_subject = getattr(meta, "subject", None)
            subject_id: int | None
            if raw_subject is None:
                logger.warning(f"Skip meta id={meta.id}: subject is NULL")
                continue
            if isinstance(raw_subject, int):
                subject_id = raw_subject
            else:
                # "商 法" のような揺れも get_subject_id 側で吸収される想定
                subject_id = get_subject_id(str(raw_subject))
            if not subject_id or not (1 <= int(subject_id) <= 18):
                logger.warning(f"Skip meta id={meta.id}: invalid subject={raw_subject!r}")
                continue
            nendo = meta.year

            # すでに active があるならスキップ（oldはここでは作らない）
            if (shiken_type, nendo, int(subject_id)) in existing_active_keys:
                continue

            # details: 本プロジェクトでは基本1件想定。複数ある場合は最小question_numberを採用
            detail = (
                db.query(ProblemDetails)
                .filter(ProblemDetails.problem_metadata_id == meta.id)
                .order_by(ProblemDetails.question_number)
                .first()
            )
            if not detail:
                continue

            # 並行してWeb側が fallback 生成する可能性があるため、
            # 1件ごとに SAVEPOINT（begin_nested）で安全に投入する
            try:
                with db.begin_nested():
                    oq = OfficialQuestion(
                        shiken_type=shiken_type,
                        nendo=nendo,
                        subject_id=int(subject_id),
                        version=1,
                        status="active",
                        text=detail.question_text,
                        syutudaisyusi=detail.purpose,
                    )
                    db.add(oq)
                    db.flush()  # oq.id を確定

                    if shiken_type == "shihou" and detail.scoring_notes:
                        db.add(
                            ShihouGradingImpression(
                                question_id=oq.id,
                                grading_impression_text=detail.scoring_notes,
                            )
                        )

                # nested成功 → activeキーに追加
                existing_active_keys.add((shiken_type, nendo, int(subject_id)))
                created += 1
            except IntegrityError:
                # 既に同じ active が作られていた等（ユニーク制約）。スキップ。
                db.rollback()
                existing_active_keys.add((shiken_type, nendo, int(subject_id)))
                continue

        db.commit()
        logger.info(f"✓ Seeded official_questions: {created}")
        return created
    except Exception as e:
        db.rollback()
        logger.error(f"Seed official_questions failed: {str(e)}", exc_info=True)
        raise
    finally:
        db.close()


if __name__ == "__main__":
    seed_official_questions_if_empty()

