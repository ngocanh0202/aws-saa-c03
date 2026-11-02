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
  ].join('\n');
}

/** Chỉ gửi cho mô hình các tin gần nhất; UI vẫn hiện đủ. */
export function trimHistory(messages: ChatMessage[], max = HISTORY_LIMIT): ChatMessage[] {
  return messages.length > max ? messages.slice(messages.length - max) : messages;
}
