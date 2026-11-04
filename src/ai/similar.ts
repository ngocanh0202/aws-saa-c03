import type { ChatMessage } from './types';

/** Câu hỏi giống câu đã hỏi từ mức này trở lên thì dùng lại câu trả lời cũ, không gửi cho AI. */
export const SIMILAR_THRESHOLD = 0.85;

/** Bỏ dấu tiếng Việt, hoa thường, dấu câu, gộp khoảng trắng. */
function normalize(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

function levenshtein(a: string, b: string): number {
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[b.length];
}

/** Độ giống 0…1 (1 − khoảng cách sửa / độ dài chuỗi dài hơn), sau khi chuẩn hóa. */
export function similarity(a: string, b: string): number {
  const x = normalize(a);
  const y = normalize(b);
  const longest = Math.max(x.length, y.length);
  if (longest === 0) return 1;
  return 1 - levenshtein(x, y) / longest;
}

/** Câu trả lời của lần hỏi gần nhất giống `text` ≥ SIMILAR_THRESHOLD; không có thì null. */
export function findCachedReply(messages: ChatMessage[], text: string, threshold = SIMILAR_THRESHOLD): string | null {
  for (let i = messages.length - 2; i >= 0; i--) {
    const q = messages[i];
    const a = messages[i + 1];
    if (q.role === 'user' && a.role === 'model' && similarity(q.text, text) >= threshold) return a.text;
  }
  return null;
}
