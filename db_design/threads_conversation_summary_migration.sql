-- 講評チャット用: 会話要約カラム追加（5の倍数ターンで要約し、要約＋直前ラリー＋以降をLLMに渡す）
-- SQLite:
ALTER TABLE threads ADD COLUMN conversation_summary TEXT;
ALTER TABLE threads ADD COLUMN summary_up_to_turn INTEGER;

-- 講評チャット用: §N 言及の次回・次々回まで Specified/Related を渡すための保持
ALTER TABLE threads ADD COLUMN last_section_mention_turn INTEGER;
ALTER TABLE threads ADD COLUMN last_section_paragraph_numbers TEXT;

-- PostgreSQL:
-- ALTER TABLE threads ADD COLUMN IF NOT EXISTS conversation_summary TEXT;
-- ALTER TABLE threads ADD COLUMN IF NOT EXISTS summary_up_to_turn INTEGER;
-- ALTER TABLE threads ADD COLUMN IF NOT EXISTS last_section_mention_turn INTEGER;
-- ALTER TABLE threads ADD COLUMN IF NOT EXISTS last_section_paragraph_numbers TEXT;
