import type { Cooldown } from '../ai/cooldown';
import { AiGateBusyError, type AiGate, type AiJob, type AiJobTarget } from '../ai/gate';
import type { LocalAiSettings } from '../ai/local-settings';
import { AiBusyError } from '../ai/retry';
import { AiUserError, type AiClient } from '../ai/types';
import type { Question } from '../data/types';
import { NOTE_AI_REQUEST, buildNotePrompt } from './ai-prompt';
import { setNote } from './model';
import type { NotesStore } from './store';

export interface DraftNoteDeps {
  gate: AiGate;
  notes: NotesStore;
  client: AiClient;
  settings?: LocalAiSettings;
  cooldown: Cooldown;
  now: () => number;
}

export interface DraftNoteJob {
  question: Question;
  /** Canonical id (khóa lưu ghi chú). */
  qid: number;
  highlightId: string;
  /** Chữ của đoạn tô. */
  text: string;
  label: string;
  target: AiJobTarget;
}

const BUSY_MESSAGE = 'AI đang quá tải hoặc hết lượt, thử lại sau ít phút.';
const FAIL_MESSAGE = 'AI không soạn được ghi chú. Thử lại sau.';

/** Lỗi gần nhất theo highlightId; chỉ trong bộ nhớ, không lưu. */
const errors = new Map<string, string>();

/** Lỗi gần nhất theo highlightId (bộ nhớ), để popup hiện dòng lỗi + nút thử lại. */
export function lastNoteError(highlightId: string): string | undefined {
  return errors.get(highlightId);
}

/** Chỉ dùng trong test. */
export function resetNoteErrors(): void {
  errors.clear();
}

function errorMessage(e: unknown): string {
  if (e instanceof AiUserError) return e.userMessage;
  if (e instanceof AiBusyError) return BUSY_MESSAGE;
  return FAIL_MESSAGE;
}

/**
 * AI soạn ghi chú cho một đoạn tô. Chạy ngoài React (đóng popup hay rời trang vẫn chạy tiếp), qua
 * gate nên mỗi tab chỉ một yêu cầu AI. Xong thì nối kết quả vào ghi chú của đoạn đó và lưu thẳng;
 * bỏ kết quả nếu đoạn tô đã bị xóa hay đã đổi tài khoản. Gate bận thì ném AiGateBusyError; lỗi AI
 * thì ghi vào lastNoteError (không ném).
 */
export async function draftNote(deps: DraftNoteDeps, job: DraftNoteJob): Promise<void> {
  const { gate, notes, client, settings, cooldown, now } = deps;
  const owner = notes.owner();
  const aiJob: AiJob = { kind: 'note', label: job.label, target: job.target };
  try {
    await gate.run(aiJob, async () => {
      errors.delete(job.highlightId);
      try {
        // Adapter tự thử lại khi 429/503 (retry.onWait); mỗi lần chờ thì khóa mọi nút AI tới giờ thử lại.
        const chat = client.startChat(buildNotePrompt(job.question, job.text), [], {
          settings,
          retry: { onWait: (w) => cooldown.set(w.until) },
        });
        let reply = '';
        for await (const chunk of chat.send(NOTE_AI_REQUEST)) reply += chunk;
        reply = reply.trim();
        if (!reply) throw new Error('empty reply');
        if (notes.owner() !== owner) return;
        const cur = notes.get(job.qid);
        const h = cur?.highlights.find((x) => x.id === job.highlightId);
        if (!cur || !h) return;
        notes.save(setNote(cur, h.id, h.note ? `${h.note}\n\n${reply}` : reply, now()));
      } catch (e) {
        if (e instanceof AiBusyError && e.retryAfterMs) cooldown.set(now() + e.retryAfterMs);
        errors.set(job.highlightId, errorMessage(e));
        throw e;
      }
    });
  } catch (e) {
    if (e instanceof AiGateBusyError) throw e;
    // Lỗi AI đã ghi ở lastNoteError.
  }
}
