/**
 * Dashboard constants (Subject colors, Point/Task status options)
 * Used by YourMEMO / YourTopics / data/page / history etc.
 */

/** Subject name -> Tailwind color classes (keys match FIXED_SUBJECTS, use Unicode escapes for portability) */
export const SUBJECT_COLORS: Record<string, string> = {
  "\u61ee\u6cd5": "bg-red-100 text-red-700",
  "\u884c\u653f\u6cd5": "bg-rose-100 text-rose-700",
  "\u6c11\u6cd5": "bg-blue-100 text-blue-700",
  "\u5546\u6cd5": "bg-cyan-100 text-cyan-700",
  "\u6c11\u4e8b\u8a34\u8bbc\u6cd5": "bg-sky-100 text-sky-700",
  "\u5211\u6cd5": "bg-green-100 text-green-700",
  "\u5211\u4e8b\u8a34\u8bbc\u6cd5": "bg-emerald-100 text-emerald-700",
  "\u4e00\u822c\u6559\u990a\u79d1\u76ee": "bg-gray-100 text-gray-700",
  "\u5b9f\u52d9\u57fa\u790e\uff08\u6c11\u4e8b\uff09": "bg-indigo-100 text-indigo-700",
  "\u5b9f\u52d9\u57fa\u790e\uff08\u5211\u4e8b\uff09": "bg-lime-100 text-lime-700",
  "\u52b4\u50cd\u6cd5": "bg-indigo-100 text-indigo-700",
  "\u5012\u7523\u6cd5": "bg-violet-100 text-violet-700",
  "\u79df\u7a0e\u6cd5": "bg-purple-100 text-purple-700",
  "\u7d4c\u6e08\u6cd5": "bg-fuchsia-100 text-fuchsia-700",
  "\u77e5\u7684\u8ca1\u7523\u6cd5": "bg-teal-100 text-teal-700",
  "\u74b0\u5883\u6cd5": "bg-lime-100 text-lime-700",
  "\u56fd\u969b\u95a2\u4fc2\u6cd5\uff08\u516c\u6cd5\u7cfb\uff09": "bg-pink-100 text-pink-700",
  "\u56fd\u969b\u95a2\u4fc2\u6cd5\uff08\u79c1\u6cd5\u7cfb\uff09": "bg-slate-100 text-slate-700",
}

/** Point(MEMO) status: \u8ad6\u6587/\u77ed\u7b54/\u5224\u4f8b/\u305d\u306e\u4ed6 */
export const POINT_STATUS_OPTIONS = [
  { value: 1, label: "\u8ad6\u6587", color: "bg-purple-100 text-purple-700" },
  { value: 2, label: "\u77ed\u7b54", color: "bg-orange-100 text-orange-700" },
  { value: 3, label: "\u5224\u4f8b", color: "bg-cyan-100 text-cyan-700" },
  { value: 4, label: "\u305d\u306e\u4ed6", color: "bg-gray-100 text-gray-700" },
] as const

/** Task(Topic) status: \u672a\u4e86/\u4f5c\u696d\u4e2d/\u5b8c\u4e86/\u5f8c\u3067 */
export const TASK_STATUS_OPTIONS = [
  { value: 1, label: "\u672a\u4e86", color: "bg-slate-100 text-slate-700" },
  { value: 2, label: "\u4f5c\u696d\u4e2d", color: "bg-amber-100 text-amber-700" },
  { value: 3, label: "\u5b8c\u4e86", color: "bg-blue-100 text-blue-700" },
  { value: 4, label: "\u5f8c\u3067", color: "bg-emerald-50 text-emerald-600" },
] as const

/** Alias: Task/Left use TASK_STATUS_OPTIONS */
export const STATUS_OPTIONS = TASK_STATUS_OPTIONS
