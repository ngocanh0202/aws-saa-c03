import { htmlToText } from '../data/html-text';
import type { Question } from '../data/types';

/** Câu AI phải trả lời nguyên văn khi đoạn tô vô nghĩa ("the a", nửa chữ…). */
export const NOTE_AI_UNCLEAR = 'Không rõ bạn muốn ghi chú gì ở đoạn này.';

/** Tin gửi kèm prompt (một lượt, không lịch sử). */
export const NOTE_AI_REQUEST = 'Soạn ghi chú cho đoạn đã tô.';

/**
 * Prompt cho AI soạn ghi chú. Chỉ có đề, dòng câu hỏi, các lựa chọn (không nhãn, vì thứ tự bị xáo)
 * và đoạn tô. Tuyệt đối không đưa đáp án, giải thích gốc, data/vi hay meta.note vào đây.
 */
export function buildNotePrompt(question: Question, highlight: string, note = ''): string {
  const text = (s: string) => (question.html ? htmlToText(s) : s).trim();
  const lines = [
    'Bạn là trợ giảng luyện thi AWS Certified Solutions Architect – Associate (SAA-C03), giúp người học ghi chú khi đọc đề.',
    'Người học đã tô một đoạn trong đề bài dưới đây và muốn có một ghi chú ngắn cho đoạn đó.',
    '',
    'Đề bài:',
    text(question.stem),
  ];
  if (question.prompt.trim()) lines.push('', 'Câu hỏi:', text(question.prompt));
  lines.push('', 'Các lựa chọn (thứ tự không quan trọng):', ...question.options.map((o) => `- ${text(o.text)}`));
  lines.push(
    '',
    'Đoạn đã tô:',
    `"""${highlight.trim()}"""`,
  );
  const existing = note.trim();
  if (existing) lines.push('', 'Ghi chú hiện có của người học cho đoạn này (chữ AI viết sẽ được nối xuống dưới):', `"""${existing}"""`);
  lines.push(
    '',
    'Yêu cầu:',
    existing
      ? '- Nếu ghi chú hiện có chứa câu hỏi thì trả lời câu hỏi đó bằng tiếng Việt (1–4 câu), xoay quanh đoạn đã tô. Nếu chỉ là nội dung người học tự viết thì bổ sung 1–3 câu ý còn thiếu (đoạn đã tô nghĩa là gì, gợi ý đề đang yêu cầu điều gì), không lặp lại những gì đã viết.'
      : '- Viết 1–3 câu bằng tiếng Việt: đoạn đã tô nghĩa là gì, và nó gợi ý đề đang yêu cầu điều gì (ví dụ "least operational overhead" thì ưu tiên dịch vụ managed, ít phải tự vận hành).',
    '- Giữ nguyên thuật ngữ và tên dịch vụ AWS bằng tiếng Anh.',
    '- Không được nói lựa chọn nào đúng hay sai, không loại trừ lựa chọn nào, không gọi tên dịch vụ nằm trong các lựa chọn như là câu trả lời.',
    '- Nếu ghi chú hỏi đáp án hay lựa chọn nào đúng thì không trả lời điều đó, chỉ nhắc người học bấm nút "Xem hướng dẫn" để xem đáp án.',
    `- Nếu đoạn đã tô không có nghĩa (vài chữ rời rạc như "the a", nửa chữ…) thì chỉ trả lời đúng một câu: ${NOTE_AI_UNCLEAR}`,
    '- Chỉ viết nội dung ghi chú, không chào hỏi, không tiêu đề, không dùng LaTeX.',
  );
  return lines.join('\n');
}
