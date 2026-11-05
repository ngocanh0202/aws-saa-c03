import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { createAiMode } from '../ai/ai-mode';
import { LOCAL_CONNECT_ERROR } from '../ai/local';
import { AiBusyError } from '../ai/retry';
import { AiUserError } from '../ai/types';
import { createAttempt } from '../engine/attempt';
import { createStore } from '../storage/storage';
import { createSyncController } from '../sync/controller';
import { DEFAULT_LOCAL_SETTINGS } from '../ai/local-settings';
import { fakeAi, fakeChats, fakeLocalSettings } from '../test/fake-ai';
import { fakeAuth, fakeRemote } from '../test/fake-sync';
import { makeDeps, memoryStorage, renderApp } from '../test/fixtures';

const TOGGLE = /Chế độ AI thử nghiệm/;

function setup({ withLocal = true, withGemini = true }: { withLocal?: boolean; withGemini?: boolean } = {}) {
  const store = createStore(memoryStorage(), { now: () => 500 });
  const auth = fakeAuth();
  const remote = fakeRemote();
  const sync = createSyncController({ store, auth, remote });
  const ai = fakeAi();
  const chats = fakeChats();
  const localAi = fakeAi();
  const localChats = fakeChats();
  const aiMode = createAiMode(null);
  const localSettings = fakeLocalSettings();
  const base = makeDeps({ store, sync });
  const attempt = createAttempt({ id: 'e1', setId: 1, mode: 'practice', esl: false, seed: 7, now: base.now(), sets: base.bank.sets, questions: base.bank.questions, metas: base.bank.meta });
  store.save(attempt);
  renderApp('/exam/e1', {
    ...base,
    ...(withGemini ? { ai, chats } : {}),
    ...(withLocal ? { localAi, localChats, localSettings, aiMode } : {}),
  });
  act(() => auth.emit({ uid: 'u1', name: 'An' }));
  act(() => remote.emit('u1', new Map([[attempt.id, { attempt, updatedAt: 1 }]])));
  return { ai, chats, localAi, localChats, localSettings, aiMode, qid: attempt.questions[0].qid };
}

async function ask(dialog: HTMLElement, text = 'Tại sao?') {
  await waitFor(() => expect(within(dialog).getByRole('button', { name: 'Gửi' })).toBeEnabled());
  fireEvent.change(within(dialog).getByRole('textbox'), { target: { value: text } });
  await act(async () => {
    fireEvent.click(within(dialog).getByRole('button', { name: 'Gửi' }));
  });
}

describe('Chế độ AI thử nghiệm (Local AI)', () => {
  it('không có Local AI thì menu tài khoản không có nút chế độ', () => {
    setup({ withLocal: false });
    expect(screen.queryByRole('button', { name: TOGGLE })).toBeNull();
  });

  it('mặc định Gemini; bật chế độ thì nút thành "Hỏi AI"', () => {
    setup();
    const toggle = screen.getByRole('button', { name: TOGGLE });
    expect(toggle).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByRole('button', { name: 'Hỏi Gemini' })).toBeInTheDocument();
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-pressed', 'true');
    expect(screen.queryByRole('button', { name: 'Hỏi Gemini' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Hỏi AI' })).toBeInTheDocument();
  });

  it('hỏi ở chế độ thử nghiệm: dùng Local AI, lưu vào localChats, không đụng Gemini', async () => {
    const s = setup();
    s.localAi.reply = ['Trả lời local'];
    fireEvent.click(screen.getByRole('button', { name: TOGGLE }));
    fireEvent.click(screen.getByRole('button', { name: 'Hỏi AI' }));
    const dialog = screen.getByRole('dialog', { name: 'Hỏi AI · Câu 1' });
    await ask(dialog);
    expect(await within(dialog).findByText('Trả lời local')).toBeInTheDocument();
    await waitFor(() => expect(s.localChats.saved.at(-1)?.key).toBe(`u1/e1/${s.qid}`));
    expect(s.chats.saved).toEqual([]);
    expect(s.ai.calls).toEqual([]);
    expect(s.localAi.calls[0].options?.tools?.map((t) => t.name)).toEqual(['find_answered_questions', 'open_guide']);
  });

  it('build không có Gemini (thiếu reCAPTCHA) vẫn dùng được chế độ thử nghiệm', () => {
    setup({ withGemini: false });
    expect(screen.queryByRole('button', { name: 'Hỏi Gemini' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: TOGGLE }));
    expect(screen.getByRole('button', { name: 'Hỏi AI' })).toBeInTheDocument();
  });

  it('đổi chế độ khi đang mở khung chat thì khung đóng', () => {
    setup();
    fireEvent.click(screen.getByRole('button', { name: 'Hỏi Gemini' }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: TOGGLE }));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('đổi chế độ khi câu trả lời Local AI đang chạy: vẫn lưu vào localChats, không vào aiChats', async () => {
    const s = setup();
    s.localAi.hold = true;
    s.localAi.reply = ['Trả lời nền'];
    fireEvent.click(screen.getByRole('button', { name: TOGGLE }));
    fireEvent.click(screen.getByRole('button', { name: 'Hỏi AI' }));
    await ask(screen.getByRole('dialog'));
    fireEvent.click(screen.getByRole('button', { name: TOGGLE }));
    expect(screen.queryByRole('dialog')).toBeNull();
    await act(async () => s.localAi.release());
    await waitFor(() => expect(s.localChats.saved.at(-1)?.messages.at(-1)?.text).toBe('Trả lời nền'));
    expect(s.chats.saved).toEqual([]);
  });

  it('lỗi kết nối hiện đúng câu báo; model đang suy nghĩ thì hiện dòng chờ', async () => {
    const s = setup();
    fireEvent.click(screen.getByRole('button', { name: TOGGLE }));
    fireEvent.click(screen.getByRole('button', { name: 'Hỏi AI' }));
    const dialog = screen.getByRole('dialog');
    s.localAi.thinking = true;
    s.localAi.hold = true;
    await ask(dialog);
    expect(await within(dialog).findByText('AI đang suy nghĩ…')).toBeInTheDocument();
    await act(async () => s.localAi.release());
    s.localAi.thinking = false;
    s.localAi.hold = false;
    s.localAi.reply = new AiUserError(LOCAL_CONNECT_ERROR);
    await ask(dialog, 'Lần nữa');
    expect(await within(dialog).findByText(LOCAL_CONNECT_ERROR)).toBeInTheDocument();
  });

  it('Gemini hết lượt (429): khung chat gợi ý chuyển sang AI thử nghiệm, bấm thì mở luôn khung Hỏi AI', async () => {
    const s = setup();
    s.ai.busy = [new AiBusyError(429, 90_000)];
    fireEvent.click(screen.getByRole('button', { name: 'Hỏi Gemini' }));
    const dialog = screen.getByRole('dialog', { name: 'Hỏi Gemini · Câu 1' });
    expect(within(dialog).queryByRole('button', { name: /Chuyển sang AI thử nghiệm/ })).toBeNull();
    await ask(dialog);
    fireEvent.click(await within(dialog).findByRole('button', { name: /Chuyển sang AI thử nghiệm/ }));
    expect(s.aiMode.get()).toBe('local');
    expect(screen.getByRole('dialog', { name: 'Hỏi AI · Câu 1' })).toBeInTheDocument();
  });

  it('không có AI thử nghiệm thì không gợi ý chuyển', async () => {
    const s = setup({ withLocal: false });
    s.ai.busy = [new AiBusyError(429, 90_000)];
    fireEvent.click(screen.getByRole('button', { name: 'Hỏi Gemini' }));
    const dialog = screen.getByRole('dialog');
    await ask(dialog);
    await within(dialog).findByText(/Thử lại sau/);
    expect(within(dialog).queryByRole('button', { name: /Chuyển sang AI thử nghiệm/ })).toBeNull();
  });

  describe('cài đặt ⚙', () => {
    it('Gemini không có nút ⚙; Hỏi AI có, mở popup trong khung, Esc chỉ đóng popup', async () => {
      setup();
      fireEvent.click(screen.getByRole('button', { name: 'Hỏi Gemini' }));
      expect(screen.queryByRole('button', { name: 'Cài đặt Hỏi AI' })).toBeNull();
      fireEvent.click(screen.getByRole('button', { name: TOGGLE }));
      fireEvent.click(screen.getByRole('button', { name: 'Hỏi AI' }));
      const gear = screen.getByRole('button', { name: 'Cài đặt Hỏi AI' });
      await waitFor(() => expect(gear).toBeEnabled());
      fireEvent.click(gear);
      const popup = screen.getByRole('dialog', { name: 'Cài đặt Hỏi AI' });
      fireEvent.keyDown(within(popup).getByRole('textbox', { name: 'top_p' }), { key: 'Escape' });
      expect(screen.queryByRole('dialog', { name: 'Cài đặt Hỏi AI' })).toBeNull();
      expect(screen.getByRole('dialog', { name: 'Hỏi AI · Câu 1' })).toBeInTheDocument();
    });

    it('dùng cài đặt đã lưu của tài khoản; lưu mới thì lần hỏi sau dùng bản mới', async () => {
      const s = setup();
      s.localSettings.data.set('u1', { ...DEFAULT_LOCAL_SETTINGS, temperature: 0.2 });
      fireEvent.click(screen.getByRole('button', { name: TOGGLE }));
      fireEvent.click(screen.getByRole('button', { name: 'Hỏi AI' }));
      const dialog = screen.getByRole('dialog', { name: 'Hỏi AI · Câu 1' });
      await waitFor(() => expect(screen.getByRole('button', { name: 'Cài đặt Hỏi AI' })).toBeEnabled());
      await ask(dialog);
      await within(dialog).findByText('ok');
      expect(s.localAi.calls[0].options?.settings?.temperature).toBe(0.2);

      fireEvent.click(screen.getByRole('button', { name: 'Cài đặt Hỏi AI' }));
      const popup = screen.getByRole('dialog', { name: 'Cài đặt Hỏi AI' });
      fireEvent.change(within(popup).getByRole('textbox', { name: 'temperature' }), { target: { value: '1' } });
      fireEvent.click(within(popup).getByRole('checkbox', { name: 'Tìm trên web' }));
      await act(async () => {
        fireEvent.click(within(popup).getByRole('button', { name: 'Lưu' }));
      });
      expect(s.localSettings.saves.at(-1)).toEqual({ uid: 'u1', settings: { ...DEFAULT_LOCAL_SETTINGS, temperature: 1, webSearch: false } });
      await ask(dialog, 'Hỏi tiếp');
      await waitFor(() => expect(s.localAi.calls).toHaveLength(2));
      expect(s.localAi.calls[1].options?.settings?.temperature).toBe(1);
      expect(s.localAi.calls[1].systemPrompt).toContain('Không tra cứu web');
    });

    it('tải cài đặt lỗi: vẫn hỏi bằng mặc định, khóa ⚙ để không ghi đè', async () => {
      const s = setup();
      s.localSettings.loadError = new Error('offline');
      fireEvent.click(screen.getByRole('button', { name: TOGGLE }));
      fireEvent.click(screen.getByRole('button', { name: 'Hỏi AI' }));
      const dialog = screen.getByRole('dialog', { name: 'Hỏi AI · Câu 1' });
      await waitFor(() => expect(screen.getByRole('button', { name: 'Cài đặt Hỏi AI' })).toHaveAttribute('title', 'Không tải được cài đặt, đang dùng mặc định'));
      expect(screen.getByRole('button', { name: 'Cài đặt Hỏi AI' })).toBeDisabled();
      await ask(dialog);
      expect(s.localAi.calls[0].options?.settings).toEqual(DEFAULT_LOCAL_SETTINGS);
    });
  });
});
