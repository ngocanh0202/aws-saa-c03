import { useEffect, useState, useSyncExternalStore } from 'react';
import { useApp } from '../app/context';
import { memoryCooldownFor } from '../ai/cooldown';
import { useAiGate, type AiJobTarget } from '../ai/gate';
import type { LocalAiSettings } from '../ai/local-settings';
import { useActiveAi } from '../components/GeminiChat';
import { IconAi, IconRetry } from '../components/icons';
import type { Question } from '../data/types';
import { draftNote, lastNoteError } from './note-ai';

export interface NoteAiButtonProps {
  question: Question;
  /** Canonical id. */
  qid: number;
  highlightId: string;
  text: string;
  label: string;
  target: AiJobTarget;
}

/**
 * Nút "AI soạn ghi chú" trong popup ghi chú. Hiện theo đúng điều kiện của nút chat AI (đã đăng nhập
 * và có AI của chế độ đang chọn); khóa khi có yêu cầu AI khác đang chạy hoặc AI đang hết lượt.
 * Lần soạn trước của đoạn này lỗi thì hiện dòng lỗi và nút thử lại.
 */
export function NoteAiButton(props: NoteAiButtonProps) {
  const active = useActiveAi();
  if (!active) return null;
  return <Ready key={`${active.uid}:${active.brand}`} {...props} active={active} />;
}

function Ready({ active, question, qid, highlightId, text, label, target }: NoteAiButtonProps & { active: NonNullable<ReturnType<typeof useActiveAi>> }) {
  const { aiGate, notes, aiCooldown, now } = useApp();
  const job = useAiGate();
  const { client, brand, uid, settingsStore } = active;
  // Như khung chat: khóa sau 429/503 dùng chung cho Gemini; AI thử nghiệm có bản riêng.
  const cooldown = brand === 'Gemini' ? (aiCooldown ?? memoryCooldownFor(aiGate)) : memoryCooldownFor(client);
  const until = useSyncExternalStore(cooldown.subscribe, cooldown.until);
  // Hết giờ khóa thì vẽ lại (cooldown không tự báo khi hết hạn).
  const [, tick] = useState(0);
  useEffect(() => {
    if (until === null) return;
    const t = setTimeout(() => tick((x) => x + 1), Math.max(0, until - Date.now()) + 50);
    return () => clearTimeout(t);
  }, [until]);

  // Tham số ⚙ của AI thử nghiệm; chưa tải xong hay tải lỗi thì để adapter dùng mặc định.
  const [settings, setSettings] = useState<LocalAiSettings | undefined>();
  useEffect(() => {
    if (!settingsStore) return;
    let live = true;
    settingsStore.load(uid).then(
      (s) => live && setSettings(s),
      () => undefined,
    );
    return () => {
      live = false;
    };
  }, [settingsStore, uid]);

  const disabled = job !== null || until !== null;
  const error = job === null ? lastNoteError(highlightId) : undefined;
  const start = () => {
    if (disabled) return;
    draftNote(
      { gate: aiGate, notes, client, settings: settingsStore ? settings : undefined, cooldown, now },
      { question, qid, highlightId, text, label, target },
    ).catch(() => {
      // Gate bận (chỉ xảy ra khi đua): bỏ qua, nút đã khóa.
    });
  };
  const title = until !== null ? 'AI đang hết lượt, thử lại sau ít phút' : 'AI soạn ghi chú';

  return (
    <>
      {error && (
        <p className="hl-pop__error" role="alert">
          {error}
        </p>
      )}
      {error ? (
        <button type="button" className="hl-btn" aria-label="Thử lại AI soạn" title="Thử lại AI soạn" disabled={disabled} onClick={start}>
          <IconRetry />
        </button>
      ) : (
        <button type="button" className="hl-btn" aria-label="AI soạn ghi chú" title={title} disabled={disabled} onClick={start}>
          <IconAi />
        </button>
      )}
    </>
  );
}
