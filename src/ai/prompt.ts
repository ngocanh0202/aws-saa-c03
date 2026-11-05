import { displayLabel } from '../engine/attempt';
import { htmlToText } from '../data/html-text';
import type { Question, QuestionVi } from '../data/types';
import type { ChatMessage } from './types';

export const HISTORY_LIMIT = 40;

export interface PromptExtra {
  /** Hướng dẫn tiếng Việt soạn sẵn (để Gemini đối chiếu với đáp án). */
  vi?: QuestionVi;
  /** Ghi chú review trong meta (đáp án đáng ngờ, thông tin lỗi thời…). */
  note?: string;
  /** Người học đã thấy đáp án và hướng dẫn (đã mở, hoặc bài đã nộp). */
  revealed?: boolean;
  /** false: người học tắt "Tìm trên web" (AI thử nghiệm). Mặc định bật. */
  webSearch?: boolean;
}

/** Phần hướng dẫn tiếng Việt và ghi chú, lý do từng lựa chọn đổi sang nhãn đang hiển thị. */
function guideSection(order: string[], { vi, note }: PromptExtra): string[] {
  const out: string[] = [];
  if (vi) {
    const label = (key: string) => displayLabel(order.indexOf(key));
    const reasons = vi.options
      .filter((o) => order.includes(o.key))
      .sort((a, b) => order.indexOf(a.key) - order.indexOf(b.key))
      .map((o) => `${label(o.key)}. ${o.reason}`);
    out.push('', 'Giải thích tiếng Việt soạn sẵn (dùng để đối chiếu):', vi.explanationVi, ...reasons);
    if (vi.keyHint) out.push(`Mẹo: ${vi.keyHint}`);
    if (vi.review) out.push(`Cờ review: ${vi.review.reason}`);
  }
  if (note) out.push('', `Ghi chú review: ${note}`);
  return out;
}

/** Dựng system prompt: lựa chọn theo thứ tự và nhãn đang hiển thị cho người học. */
export function buildSystemPrompt(question: Question, order: string[], extra: PromptExtra = {}): string {
  const text = (s: string) => (question.html ? htmlToText(s) : s);
  const byKey = new Map(question.options.map((o) => [o.key, o.text]));
  const options = order.map((key, i) => `${displayLabel(i)}. ${text(byKey.get(key) ?? '')}`);
  const correct = question.answer
    .map((key) => displayLabel(order.indexOf(key)))
    .sort()
    .join(', ');
  const body = [text(question.stem), question.prompt ? text(question.prompt) : ''].filter(Boolean).join('\n');
  const answerRules = extra.revealed
    ? ['- Người học đã thấy đáp án và hướng dẫn, cứ trả lời thẳng.']
    : [
        '- Người học chưa xem đáp án: không nói ra đáp án đúng, chỉ gợi ý và giải thích khái niệm.',
        '- Khi người học xin đáp án, gọi tool open_guide trước rồi mới nói đáp án.',
      ];
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
    ...guideSection(order, extra),
    '',
    'Cách trả lời:',
    ...answerRules,
    '- Khi nói đáp án, đối chiếu đáp án với giải thích tiếng Việt và ghi chú (nếu có): khớp thì nói một dòng ngắn; lệch, nghi đáp án sai hay lỗi thời thì nói rõ chỗ lệch.',
    '- Trả lời bằng tiếng Việt, giữ nguyên thuật ngữ và tên dịch vụ AWS bằng tiếng Anh.',
    '- Tập trung đúng vào câu người học hỏi, không lan man.',
    '- Người học được hỏi cả chuyện ngoài câu đang làm (kiến thức AWS, công nghệ thông tin nói chung); cứ trả lời bình thường, không từ chối.',
    extra.webSearch === false
      ? '- Không tra cứu web: khi người học muốn thông tin mới nhất hoặc nhờ tìm trên mạng, nói rõ là chỉ trả lời theo kiến thức sẵn có (có thể đã cũ), không bịa link.'
      : '- Khi người học muốn cập nhật thông tin mới nhất (tin tức, thay đổi gần đây, giá, phiên bản mới…) hoặc nhờ tìm trên mạng: nếu có tool tìm kiếm web thì dùng tool đó, rồi ghi link nguồn cho từng ý; nếu không có tool tìm kiếm thì nói rõ là không tra cứu web được và chỉ trả lời theo kiến thức sẵn có, không bịa link.',
    '- Ngắn gọn, dễ hiểu.',
    '- Nếu thông tin có thể đã lỗi thời (dịch vụ đổi tên, ngừng hỗ trợ, giá thay đổi) thì nói rõ.',
    '- Không bịa dịch vụ hay con số; không chắc thì nói không chắc.',
    '- Không dùng LaTeX hay công thức trong dấu $ (như $\\rightarrow$); viết thẳng ký tự như →, ≤, ×.',
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
export function prepareHistory(messages: ChatMessage[], max = HISTORY_LIMIT): ChatMessage[] {
  return normalizeHistory(trimHistory(messages, max));
}
