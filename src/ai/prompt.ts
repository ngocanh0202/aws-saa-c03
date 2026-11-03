import { displayLabel } from '../engine/attempt';
import { htmlToText } from '../data/html-text';
import type { Question } from '../data/types';
import type { ChatMessage } from './types';

export const HISTORY_LIMIT = 40;

/** Dựng system prompt: lựa chọn theo thứ tự và nhãn đang hiển thị cho người học. */
export function buildSystemPrompt(question: Question, order: string[]): string {
  const text = (s: string) => (question.html ? htmlToText(s) : s);
  const byKey = new Map(question.options.map((o) => [o.key, o.text]));
  const options = order.map((key, i) => `${displayLabel(i)}. ${text(byKey.get(key) ?? '')}`);
  const correct = question.answer
    .map((key) => displayLabel(order.indexOf(key)))
    .sort()
    .join(', ');
  const body = [text(question.stem), question.prompt ? text(question.prompt) : ''].filter(Boolean).join('\n');
  return [
    'Bạn là trợ giảng luyện thi AWS Certified Solutions Architect – Associate (SAA-C03).',
    'Người học đang làm câu hỏi sau.',
    '',
    'Đề bài:',
    body,
    '',
    'Các lựa chọn:',
    ...options,
    '',
    `Đáp án đúng: ${correct}`,
    '',
    'Cách trả lời:',
    '- Trả lời bằng tiếng Việt, giữ nguyên thuật ngữ và tên dịch vụ AWS bằng tiếng Anh.',
    '- Tập trung đúng vào câu người học hỏi, không lan man.',
    '- Ngắn gọn, dễ hiểu.',
    '- Nếu thông tin có thể đã lỗi thời (dịch vụ đổi tên, ngừng hỗ trợ, giá thay đổi) thì nói rõ.',
    '- Không bịa dịch vụ hay con số; không chắc thì nói không chắc.',
    '- Khi người học muốn tìm lại một câu đã làm, gọi tool find_answered_questions với từ khóa tiếng Anh hoặc tên dịch vụ AWS.',
    '- Tool trả về rỗng thì chỉ trả lời: "Bạn chưa làm câu nào như vậy trong đề này." Không bịa câu hỏi.',
    '- Tìm thấy thì nêu đề, các lựa chọn, người học đã chọn gì, đúng hay sai, đáp án đúng, rồi phân tích tình huống và so sánh với câu đang làm. Nhiều câu thì liệt kê ngắn để người học chọn.',
    '- Không dùng chữ cái A/B/C để chỉ lựa chọn của câu tìm được; nhắc bằng nội dung lựa chọn.',
  ].join('\n');
}

/** Chỉ gửi cho mô hình các tin gần nhất; UI vẫn hiện đủ. */
export function trimHistory(messages: ChatMessage[], max = HISTORY_LIMIT): ChatMessage[] {
  return messages.length > max ? messages.slice(messages.length - max) : messages;
}

/**
 * Firebase SDK từ chối history không xen kẽ user/model hoặc bắt đầu bằng model (lượt trước lỗi
 * để lại tin user không có trả lời, hay cắt 40 tin rơi đúng vào tin model). Bỏ các tin model đứng
 * đầu; nhiều tin cùng vai liền nhau thì chỉ giữ tin cuối; bỏ tin user cuối chưa có trả lời (tin
 * mới gửi cũng là user, sẽ thành hai tin user liền nhau).
 */
export function normalizeHistory(messages: ChatMessage[]): ChatMessage[] {
  const out: ChatMessage[] = [];
  for (const m of messages) {
    if (out.length === 0 && m.role === 'model') continue;
    if (out.length > 0 && out[out.length - 1].role === m.role) out[out.length - 1] = m;
    else out.push(m);
  }
  if (out[out.length - 1]?.role === 'user') out.pop();
  return out;
}

/** History gửi cho mô hình: cắt còn các tin gần nhất rồi chuẩn hóa. */
export function prepareHistory(messages: ChatMessage[]): ChatMessage[] {
  return normalizeHistory(trimHistory(messages));
}
