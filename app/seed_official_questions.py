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
except ImportError:
    import os
    os.chdir(str(BASE_DIR))
    from app.db import SessionLocal
    from app.models import OfficialQuestion, ShihouGradingImpression, ProblemMetadata, ProblemDetails


def seed_official_questions_if_empty() -> int:
    db = SessionLocal()
    try:
        existing = db.query(OfficialQuestion).count()
        if existing > 0:
            logger.info("official_questions already populated. Skipping seed.")
            return 0

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

            subject_id = meta.subject
            nendo = meta.year

            # details: 本プロジェクトでは基本1件想定。複数ある場合は最小question_numberを採用
            detail = (
                db.query(ProblemDetails)
                .filter(ProblemDetails.problem_metadata_id == meta.id)
                .order_by(ProblemDetails.question_number)
                .first()
            )
            if not detail:
                continue

            oq = OfficialQuestion(
                shiken_type=shiken_type,
                nendo=nendo,
                subject_id=int(subject_id) if subject_id is not None else 1,
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

            created += 1

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

