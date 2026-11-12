import { SIMILAR_THRESHOLD, similarity } from './similar';

/** Dấu AI viết trước các câu hỏi gợi ý ở cuối câu trả lời. */
export const FOLLOWUP_MARK = '<<GOI_Y>>';
export const FOLLOWUP_MAX = 3;
export const FOLLOWUP_LEN = 100;

/** Tách câu trả lời đầy đủ thành phần hiện cho người học và các câu hỏi gợi ý. */
export function splitFollowups(raw: string): { text: string; suggestions: string[] } {
  const at = raw.indexOf(FOLLOWUP_MARK);
  if (at === -1) return { text: raw, suggestions: [] };
  const suggestions = raw
    .slice(at + FOLLOWUP_MARK.length)
    .split('\n')
    .map((line) => line.trim().replace(/^(?:[-*•]|\d+[.)])\s*/, '').trim())
    .filter(Boolean)
    .map((s) => s.slice(0, FOLLOWUP_LEN))
    .slice(0, FOLLOWUP_MAX);
  return { text: raw.slice(0, at).trimEnd(), suggestions };
}

/** Chữ hiện ra khi đang stream: bỏ từ dấu tách trở đi, kể cả phần đầu dở dang của dấu ở cuối. */
export function visibleReply(partial: string): string {
  const at = partial.indexOf(FOLLOWUP_MARK);
  if (at !== -1) return partial.slice(0, at);
  for (let n = Math.min(FOLLOWUP_MARK.length - 1, partial.length); n > 0; n--) {
    if (partial.endsWith(FOLLOWUP_MARK.slice(0, n))) return partial.slice(0, partial.length - n);
  }
  return partial;
}

/** Gợi ý của AI còn lại sau khi bỏ câu giống gợi ý cố định, câu người học đã hỏi, và câu trùng nhau. */
export function pickFollowups(ai: string[], fixed: string[], asked: string[]): string[] {
  const out: string[] = [];
  for (const s of ai) {
    const seen = [...fixed, ...asked, ...out];
    if (!seen.some((t) => similarity(s, t) >= SIMILAR_THRESHOLD)) out.push(s);
  }
  return out;
}
