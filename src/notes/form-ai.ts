import type { Cooldown } from '../ai/cooldown';
import { AiGateBusyError, type AiGate, type AiJob } from '../ai/gate';
import type { LocalAiSettings } from '../ai/local-settings';
import { AiBusyError } from '../ai/retry';
import { AiUserError, type AiClient } from '../ai/types';
import { createIdleWatchdog } from '../ai/watchdog';
import { htmlToText } from '../data/html-text';
import type { Question } from '../data/types';

/** Tin gửi kèm prompt (một lượt, không lịch sử). */
export const FORM_AI_REQUEST = 'Soạn nội dung cho ghi chú.';

const BUSY_MESSAGE = 'AI đang quá tải hoặc hết lượt, thử lại sau ít phút.';
const FAIL_MESSAGE = 'AI không soạn được ghi chú. Thử lại sau.';

/** Không có chữ nào để AI dựa vào thì không gửi. */
export function canDraftForm(title: string, content: string): boolean {
  return title.trim() !== '' || content.trim() !== '';
}

/**
 * Prompt cho AI hỗ trợ viết trong form ghi chú. Ghi chú của câu: kèm đề, dòng câu hỏi, lựa chọn
 * (không nhãn). Ghi chú tự do: chỉ chữ đã gõ. Tuyệt đối không đưa đáp án, giải thích, data/vi hay
 * meta.note vào đây.
 */
export function buildFormNotePrompt(input: { question?: Question; title: string; content: string }): string {
  const { question } = input;
  const lines = ['Bạn là trợ giảng luyện thi AWS Certified Solutions Architect – Associate (SAA-C03), giúp người học viết ghi chú ôn tập.'];
  if (question) {
    const text = (s: string) => (question.html ? htmlToText(s) : s).trim();
    lines.push('Ghi chú này gắn với câu hỏi dưới đây.', '', 'Đề bài:', text(question.stem));
    if (question.prompt.trim()) lines.push('', 'Câu hỏi:', text(question.prompt));
    lines.push('', 'Các lựa chọn (thứ tự không quan trọng):', ...question.options.map((o) => `- ${text(o.text)}`));
  }
  const title = input.title.trim();
  const content = input.content.trim();
  lines.push('', 'Tiêu đề ghi chú:', `"""${title}"""`);
  if (content) lines.push('', 'Nội dung hiện có (chữ AI viết sẽ được nối xuống dưới):', `"""${content}"""`);
  lines.push(
    '',
    'Yêu cầu:',
    content
      ? '- Nếu nội dung hiện có chứa câu hỏi thì trả lời câu hỏi đó bằng tiếng Việt. Nếu không thì bổ sung ý còn thiếu, không lặp lại những gì đã viết.'
      : '- Hãy viết nội dung cho tiêu đề trên bằng tiếng Việt.',
    '- Viết 1–5 câu, giữ nguyên thuật ngữ và tên dịch vụ AWS bằng tiếng Anh.',
  );
  if (question)
    lines.push(
      '- Không được nói lựa chọn nào đúng hay sai, không loại trừ lựa chọn nào.',
      '- Nếu người học hỏi đáp án hay lựa chọn nào đúng thì không trả lời điều đó, chỉ nhắc bấm nút "Xem hướng dẫn" để xem đáp án.',
    );
  lines.push('- Chỉ viết nội dung ghi chú, không chào hỏi, không tiêu đề, không dùng LaTeX.');
  return lines.join('\n');
}

export interface FormDraftDeps {
  gate: AiGate;
  client: AiClient;
  settings?: LocalAiSettings;
  cooldown: Cooldown;
  now: () => number;
}

export interface FormDraftJob {
  question?: Question;
  /** Canonical id, hoặc qid âm của ghi chú tự do. */
  qid: number;
  label: string;
  title: string;
  content: string;
}

/**
 * AI soạn chữ cho form ghi chú, qua gate (mỗi tab một yêu cầu AI). Trả chữ đã trim, không tự lưu.
 * Gate bận thì ném AiGateBusyError; lỗi khác thì ném AiUserError có câu báo cho người học.
 */
export async function draftFormNote(deps: FormDraftDeps, job: FormDraftJob): Promise<string> {
  const { gate, client, settings, cooldown, now } = deps;
  const aiJob: AiJob = { kind: 'form', label: job.label, target: { page: 'notes', qid: job.qid, highlightId: 'form' } };
  return gate.run(aiJob, async () => {
    try {
      const watchdog = createIdleWatchdog();
      const chat = client.startChat(buildFormNotePrompt(job), [], {
        settings,
        retry: {
          onWait: (w) => {
            cooldown.set(w.until);
            watchdog.touch(w.until);
          },
        },
        onThinking: () => watchdog.touch(),
      });
      let reply = '';
      for await (const chunk of watchdog.wrap(chat.send(FORM_AI_REQUEST))) reply += chunk;
      reply = reply.trim();
      if (!reply) throw new Error('empty reply');
      return reply;
    } catch (e) {
      if (e instanceof AiGateBusyError) throw e;
      if (e instanceof AiBusyError && e.retryAfterMs) cooldown.set(now() + e.retryAfterMs);
      if (e instanceof AiUserError) throw e;
      throw new AiUserError(e instanceof AiBusyError ? BUSY_MESSAGE : FAIL_MESSAGE);
    }
  });
}
