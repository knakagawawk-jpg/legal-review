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
  "実務基礎（民事）",
  "実務基礎（刑事）",
  "倒産法",
  "租税法",
  "経済法",
  "知的財産法",
  "労働法",
  "環境法",
  "国際関係法（公法系）",
  "国際関係法（私法系）",
  "一般教養科目",
] as const

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
