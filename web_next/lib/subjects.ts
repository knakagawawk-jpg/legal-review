/**
 * 科目の固定リスト（順番も固定）
 * FastAPIのconfig/constants.pyのFIXED_SUBJECTSと一致させる
 */
export const FIXED_SUBJECTS = [
  "憲法",
  "行政法",
  "民法",
  "商法",
  "民事訴訟法",
  "刑法",
  "刑事訴訟法",
  "一般教養科目",
  "実務基礎（民事）",
  "実務基礎（刑事）",
  "労働法",
  "倒産法",
  "租税法",
  "経済法",
  "知的財産法",
  "環境法",
  "国際関係法（公法系）",
  "国際関係法（私法系）",
] as const

/**
 * 科目ID → 科目名のマッピング（1-18）
 * バックエンドのconfig/subjects.pyのSUBJECT_MAPと一致させる
 */
export const SUBJECT_MAP: Record<number, string> = {
  1: "憲法",
  2: "行政法",
  3: "民法",
  4: "商法",
  5: "民事訴訟法",
  6: "刑法",
  7: "刑事訴訟法",
  8: "一般教養科目",
  9: "実務基礎（民事）",
  10: "実務基礎（刑事）",
  11: "労働法",
  12: "倒産法",
  13: "租税法",
  14: "経済法",
  15: "知的財産法",
  16: "環境法",
  17: "国際関係法（公法系）",
  18: "国際関係法（私法系）",
} as const

/**
 * 科目名 → 科目IDの逆マッピング
 */
export const SUBJECT_NAME_TO_ID: Record<string, number> = Object.fromEntries(
  Object.entries(SUBJECT_MAP).map(([id, name]) => [name, parseInt(id)])
) as Record<string, number>

/**
 * 科目IDから科目名を取得
 */
export function getSubjectName(subjectId: number | null | undefined): string {
  if (subjectId === null || subjectId === undefined) return "不明"
  return SUBJECT_MAP[subjectId] || "不明"
}

/**
 * 科目名から科目IDを取得
 */
export function getSubjectId(subjectName: string): number | null {
  return SUBJECT_NAME_TO_ID[subjectName] || null
}

/**
 * 科目IDが有効かチェック（1-18）
 */
export function isValidSubjectId(subjectId: number): boolean {
  return 1 <= subjectId && subjectId <= 18
}

/**
 * 科目リストを固定順序で並べ替える
 * @param subjects APIから取得した科目リスト
 * @returns 固定順序で並べ替えられた科目リスト
 */
export function sortSubjectsByFixedOrder(subjects: string[]): string[] {
  // FIXED_SUBJECTSの順序に従って並べ替え
  const sorted: string[] = []
  const subjectSet = new Set(subjects)
  
  // FIXED_SUBJECTSに含まれる科目を順序通りに追加
  for (const subject of FIXED_SUBJECTS) {
    if (subjectSet.has(subject)) {
      sorted.push(subject)
      subjectSet.delete(subject)
    }
  }
  
  // FIXED_SUBJECTSにない科目も追加（後方互換性）
  const additional = Array.from(subjectSet).sort()
  sorted.push(...additional)
  
  return sorted
}
