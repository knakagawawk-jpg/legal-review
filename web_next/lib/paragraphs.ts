/**
 * 答案の段落分割（バックエンドの add_paragraph_markers と同じルール）
 * 改行ごとに区切る。空行はデータ・表示とも保持するが、段落番号は空行をカウントしない。
 * DB保存は $$[1], $$[2], ... 付き（非空行の先頭のみ）。表示時は parseMarkedAnswerText でパース。
 */

export interface Paragraph {
  number: number
  content: string
}

/**
 * DBに保存された答案をパースする。
 * 形式1: $$[1] 行内容\n$$[2] 行内容\n（バックエンドの add_paragraph_markers の出力）
 * 形式2: $$[1]\n内容\n$$[2]\n内容\n
 * content には $$[N] を含めず、左マーク用の番号のみ number に格納する。
 */
export function parseMarkedAnswerText(answerText: string): Paragraph[] | null {
  if (!answerText || !answerText.includes("$$[")) {
    return null
  }
  const lines = answerText.split("\n")
  const result: Paragraph[] = []
  let hasMarker = false
  for (const line of lines) {
    const sameLineMatch = line.match(/^\$\$\[(\d+)\]\s*(.*)$/)
    if (sameLineMatch) {
      hasMarker = true
      result.push({
        number: parseInt(sameLineMatch[1], 10),
        content: sameLineMatch[2],
      })
    } else if (line.trim() === "") {
      result.push({ number: 0, content: "" })
    } else if (hasMarker) {
      // マーク付きの後にマークなし行が来た場合はフォールバック扱い
      return null
    } else {
      return null
    }
  }
  return hasMarker && result.length > 0 ? result : null
}

/** 段落マーク（$$[N] または $$[N]\n）を除去してプレーンな答案テキストにする（コピー用）。空行はそのまま保持。 */
export function stripParagraphMarkers(answerText: string): string {
  if (!answerText) return answerText
  // 行頭の $$[N] または $$[N] の直後のスペースを除去
  return answerText.replace(/^\$\$\[\d+\]\s*/gm, "")
}

/** マークなし答案用。1行1要素。空行は number: 0 で返す（表示で空きとして使う）。content に $$[N] が含まれる場合は除去して表示用に。 */
export function splitAnswerIntoParagraphs(answerText: string): Paragraph[] {
  if (answerText == null) {
    return []
  }
  const lines = answerText.split("\n")
  let num = 0
  return lines.map((line) => {
    // フォールバック時も、$$[N] が含まれていれば本文から除去（左マーク用の§のみ表示）
    const content = line.replace(/^\$\$\[\d+\]\s*/, "")
    return {
      number: content.trim() ? ++num : 0,
      content,
    }
  })
}

/** 答案テキストから段落リストを取得。$$[N] 付きならパース、そうでなければ分割ルールで分割 */
export function getParagraphsFromAnswerText(answerText: string): Paragraph[] {
  const parsed = parseMarkedAnswerText(answerText)
  if (parsed && parsed.length > 0) return parsed
  return splitAnswerIntoParagraphs(answerText)
}
