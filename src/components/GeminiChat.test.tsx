import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { ChatMessage } from '../ai/types';
import { createAttempt } from '../engine/attempt';
import { selectOption, submitAttempt } from '../engine/actions';
import { createStore } from '../storage/storage';
import { createSyncController } from '../sync/controller';
import type { SyncUser } from '../sync/types';
import { fakeAi, fakeChats } from '../test/fake-ai';
import { fakeAuth, fakeRemote } from '../test/fake-sync';
import { makeDeps, memoryStorage, renderApp } from '../test/fixtures';
import { formatDate } from '../app/format';

const USER: SyncUser = { uid: 'u1', name: 'An Nguyen' };
const GEMINI = 'Hỏi Gemini';

function setup({
  mode = 'practice',
  signedIn = true,
  withAi = true,
  history,
  loadError,
  extraChats = {},
}: { mode?: 'practice' | 'real'; signedIn?: boolean; withAi?: boolean; history?: ChatMessage[]; loadError?: Error; extraChats?: Record<string, ChatMessage[]> } = {}) {
  const store = createStore(memoryStorage(), { now: () => 500 });
  const auth = fakeAuth();
  const remote = fakeRemote();
  const sync = createSyncController({ store, auth, remote });
  const ai = fakeAi();
  const base = makeDeps({ store, sync });
  const attempt = createAttempt({ id: 'e1', setId: 1, mode, esl: false, seed: 7, now: base.now(), sets: base.bank.sets, questions: base.bank.questions, metas: base.bank.meta });
  store.save(attempt);
  const qid = attempt.questions[0].qid;
  const chats = fakeChats({ ...extraChats, ...(history ? { [`u1/e1/${qid}`]: history } : {}) });
  chats.loadError = loadError;
  const deps = withAi ? { ...base, ai, chats } : base;
  renderApp('/exam/e1', deps);
  act(() => auth.emit(signedIn ? USER : null));
  // Cloud đã có đúng lượt này nên không hỏi xung đột dữ liệu khách.
  if (signedIn) act(() => remote.emit(USER.uid, new Map([[attempt.id, { attempt, updatedAt: 1 }]])));
  return { store, auth, ai, chats, qid, key: `u1/e1/${qid}`, base };
}

async function openChat() {
  fireEvent.click(screen.getByRole('button', { name: GEMINI }));
  const dialog = screen.getByRole('dialog', { name: 'Hỏi Gemini · Câu 1' });
  await waitFor(() => expect(within(dialog).getByRole('button', { name: 'Gửi' })).toBeEnabled());
  return dialog;
}

async function ask(dialog: HTMLElement, text = 'Tại sao?') {
  fireEvent.change(within(dialog).getByRole('textbox'), { target: { value: text } });
  await act(async () => {
    fireEvent.click(within(dialog).getByRole('button', { name: 'Gửi' }));
  });
}

const guideOpened = (s: ReturnType<typeof setup>) => s.store.get('e1')!.guideOpened;

describe('Hỏi Gemini ở Thi thử', () => {
  it('ẩn khi chưa đăng nhập', () => {
    setup({ signedIn: false });
    expect(screen.queryByRole('button', { name: GEMINI })).toBeNull();
  });

  it('ẩn khi không có ai', () => {
    setup({ withAi: false });
    expect(screen.queryByRole('button', { name: GEMINI })).toBeNull();
  });

  it('ẩn ở Thi thật', () => {
    setup({ mode: 'real' });
    expect(screen.queryByRole('button', { name: GEMINI })).toBeNull();
  });

  it('hiện ở Thi thử khi đã đăng nhập', () => {
    setup();
    expect(screen.getByRole('button', { name: GEMINI })).toBeInTheDocument();
  });

  it('gửi câu hỏi: prompt có đề + đáp án, câu trả lời stream hiện ra', async () => {
    const s = setup();
    s.ai.reply = ['Vì ', 'S3'];
    const dialog = await openChat();
    expect(within(dialog).getByText(new RegExp(`Stem ${s.qid}`))).toBeInTheDocument();
    await ask(dialog);
    await waitFor(() => expect(within(dialog).getByText('Vì S3')).toBeInTheDocument());
    expect(s.ai.calls[0].systemPrompt).toContain('Đáp án đúng:');
    expect(s.ai.calls[0].systemPrompt).toContain(`Stem ${s.qid}`);
    expect(s.ai.calls[0].sent).toEqual(['Tại sao?']);
  });

  it('trả lời xong không tự gắn nhãn và không mở hướng dẫn', async () => {
    const s = setup();
    s.ai.reply = ['Vì ', 'S3'];
    const dialog = await openChat();
    await ask(dialog);
    await waitFor(() => expect(within(dialog).getByText('Vì S3')).toBeInTheDocument());
    expect(guideOpened(s)).not.toContain(s.qid);
    expect(screen.queryByRole('complementary', { name: 'Hướng dẫn' })).toBeNull();
    expect(s.ai.calls[0].systemPrompt).toContain('open_guide');
  });

  it('Gemini gọi open_guide (người học xin đáp án): gắn nhãn và mở hướng dẫn', async () => {
    const s = setup();
    s.ai.toolCalls = [{ name: 'open_guide', args: {} }];
    const dialog = await openChat();
    await ask(dialog, 'Cho tôi đáp án');
    await waitFor(() => expect(guideOpened(s)).toContain(s.qid));
    expect(screen.getByRole('complementary', { name: 'Hướng dẫn' })).toBeInTheDocument();
    expect(s.ai.calls[0].toolResults).toContainEqual({ opened: true });
  });

  it('người học tự bấm hướng dẫn giữa chừng: lần gửi sau mở phiên mới báo đã thấy đáp án', async () => {
    const s = setup();
    const dialog = await openChat();
    await ask(dialog);
    await waitFor(() => expect(s.chats.saved).toHaveLength(1));
    expect(s.ai.calls[0].systemPrompt).not.toContain('đã thấy đáp án');
    fireEvent.click(screen.getByRole('button', { name: 'Xem hướng dẫn' }));
    await waitFor(() => expect(within(dialog).getByRole('button', { name: 'Gửi' })).toBeEnabled());
    await ask(dialog, 'Giải thích thêm');
    await waitFor(() => expect(s.ai.calls).toHaveLength(2));
    expect(s.ai.calls[1].systemPrompt).toContain('đã thấy đáp án');
    expect(s.ai.calls[1].history.map((m) => m.text)).toEqual(['Tại sao?', 'ok']);
  });

  it('lưu lịch sử lỗi thì báo trong popup', async () => {
    const s = setup();
    s.chats.save = async () => {
      throw new Error('too long');
    };
    s.ai.reply = ['Vì ', 'S3'];
    const dialog = await openChat();
    await ask(dialog);
    await waitFor(() => expect(within(dialog).getByText('Không lưu được lịch sử trò chuyện.')).toBeInTheDocument());
    expect(within(dialog).getByText('Vì S3')).toBeInTheDocument();
  });

  it('lỗi trước chữ đầu tiên không gắn nhãn', async () => {
    const s = setup();
    s.ai.reply = new Error('blocked');
    const dialog = await openChat();
    await ask(dialog);
    await waitFor(() => expect(within(dialog).getByText('Gemini chưa trả lời được, thử gửi lại nhé.')).toBeInTheDocument());
    expect(guideOpened(s)).not.toContain(s.qid);
    expect(s.chats.saved).toEqual([]);
  });

  it('lỗi giữa chừng giữ chữ đã nhận', async () => {
    const s = setup();
    s.ai.reply = ['Một ', 'hai'];
    s.ai.failAfter = 1;
    const dialog = await openChat();
    await ask(dialog);
    await waitFor(() => expect(within(dialog).getByText('Gemini chưa trả lời được, thử gửi lại nhé.')).toBeInTheDocument());
    expect(within(dialog).getByText('Một')).toBeInTheDocument();
    expect(s.chats.saved).toEqual([]);
  });

  it('lưu lịch sử sau mỗi lượt', async () => {
    const s = setup();
    s.ai.reply = ['Vì ', 'S3'];
    const dialog = await openChat();
    await ask(dialog);
    await waitFor(() => expect(s.chats.saved).toHaveLength(1));
    expect(s.chats.saved[0]).toEqual({
      key: s.key,
      messages: [
        { role: 'user', text: 'Tại sao?' },
        { role: 'model', text: 'Vì S3' },
      ],
    });
  });

  it('mở lại thấy lịch sử cũ và gửi kèm cho model', async () => {
    const old: ChatMessage[] = [
      { role: 'user', text: 'Câu hỏi cũ' },
      { role: 'model', text: 'Trả lời cũ' },
    ];
    const s = setup({ history: old });
    const dialog = await openChat();
    expect(within(dialog).getByText('Câu hỏi cũ')).toBeInTheDocument();
    expect(within(dialog).getByText('Trả lời cũ')).toBeInTheDocument();
    await ask(dialog);
    await waitFor(() => expect(s.chats.saved).toHaveLength(1));
    expect(s.ai.calls[0].history).toHaveLength(2);
    expect(s.chats.saved[0].messages).toHaveLength(4);
  });

  it('lịch sử cũ không xen kẽ (lượt lỗi trước đó) vẫn chat được, không bị khóa', async () => {
    const s = setup({
      history: [
        { role: 'user', text: 'Hỏi lần 1' },
        { role: 'user', text: 'Hỏi lần 2' },
        { role: 'model', text: 'Trả lời' },
      ],
    });
    s.ai.strictHistory = true;
    s.ai.reply = ['Vì ', 'S3'];
    const dialog = await openChat();
    await ask(dialog);
    await waitFor(() => expect(within(dialog).getByText('Vì S3')).toBeInTheDocument());
    expect(within(dialog).getByRole('button', { name: 'Gửi' })).toBeEnabled();
  });

  it('startChat ném lỗi: báo lỗi và mở khóa ô nhập', async () => {
    const s = setup();
    s.ai.startError = new Error("Content with role 'user' can't follow 'user'");
    const dialog = await openChat();
    await ask(dialog);
    await waitFor(() => expect(within(dialog).getByText('Gemini chưa trả lời được, thử gửi lại nhé.')).toBeInTheDocument());
    expect(within(dialog).getByRole('button', { name: 'Gửi' })).toBeEnabled();
  });

  it('lỗi tải lịch sử vẫn chat được', async () => {
    const s = setup({ loadError: new Error('denied') });
    s.ai.reply = ['Vì ', 'S3'];
    const dialog = await openChat();
    expect(within(dialog).getByText('Không tải được lịch sử trò chuyện.')).toBeInTheDocument();
    await ask(dialog);
    await waitFor(() => expect(within(dialog).getByText('Vì S3')).toBeInTheDocument());
  });

  it('bỏ qua tin nhắn rỗng', async () => {
    const s = setup();
    const dialog = await openChat();
    await ask(dialog, '   ');
    expect(s.ai.calls).toEqual([]);
  });

  it('không gửi khi đang trả lời', async () => {
    const s = setup();
    s.ai.hold = true;
    const dialog = await openChat();
    await ask(dialog);
    expect(within(dialog).getByRole('button', { name: 'Gửi' })).toBeDisabled();
    expect(within(dialog).getByRole('textbox')).toBeDisabled();
    await act(async () => s.ai.release());
    await waitFor(() => expect(within(dialog).getByRole('button', { name: 'Gửi' })).toBeEnabled());
  });

  it('đăng xuất thì đóng popup', async () => {
    const s = setup();
    s.ai.hold = true;
    const dialog = await openChat();
    await ask(dialog);
    act(() => s.auth.emit(null));
    expect(screen.queryByRole('dialog', { name: 'Hỏi Gemini · Câu 1' })).toBeNull();
    // Câu trả lời đến sau khi đã đóng: không lỗi, không lưu.
    await act(async () => s.ai.release());
    expect(s.chats.saved).toEqual([]);
  });

  it('mở ra là khung chat nhỏ ở góc, trang vẫn cuộn và dùng được; nút mở chat ẩn đi', async () => {
    setup();
    const dialog = await openChat();
    expect(dialog).toHaveClass('gemini-dock');
    expect(dialog).not.toHaveAttribute('aria-modal');
    expect(document.body.style.overflow).toBe('');
    expect(screen.queryByRole('button', { name: GEMINI })).toBeNull();
  });

  it('nút Mở rộng chuyển sang toàn màn hình, Thu nhỏ quay về khung chat, tin nhắn giữ nguyên', async () => {
    setup();
    const dialog = await openChat();
    await ask(dialog);
    fireEvent.click(within(dialog).getByRole('button', { name: 'Mở rộng' }));
    expect(dialog).toHaveClass('service-modal');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(document.body.style.overflow).toBe('hidden');
    expect(within(dialog).getByText('Tại sao?')).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Thu nhỏ' }));
    expect(dialog).toHaveClass('gemini-dock');
    expect(document.body.style.overflow).toBe('');
    expect(within(dialog).getByText('Tại sao?')).toBeInTheDocument();
  });

  it('lượt gửi lỗi thì lần gửi sau mở phiên chat mới từ lịch sử chữ', async () => {
    const s = setup();
    s.ai.reply = new Error('tool round failed');
    const dialog = await openChat();
    await ask(dialog);
    await waitFor(() => expect(within(dialog).getByRole('alert')).toBeInTheDocument());
    s.ai.reply = ['Được rồi'];
    await waitFor(() => expect(within(dialog).getByRole('button', { name: 'Gửi' })).toBeEnabled());
    await ask(dialog, 'Thử lại');
    await waitFor(() => expect(within(dialog).getByText('Được rồi')).toBeInTheDocument());
    expect(s.ai.calls).toHaveLength(2);
  });

  it('đang trả lời thì không chuyển sang danh sách trò chuyện cũ', async () => {
    const s = setup();
    s.ai.hold = true;
    const dialog = await openChat();
    await ask(dialog);
    expect(within(dialog).getByRole('button', { name: 'Trò chuyện cũ' })).toBeDisabled();
    await act(async () => s.ai.release());
    await waitFor(() => expect(within(dialog).getByRole('button', { name: 'Trò chuyện cũ' })).toBeEnabled());
  });

  it('sang câu khác khi Gemini đang trả lời: câu trả lời vẫn chạy ở nền và được lưu', async () => {
    const s = setup();
    s.ai.hold = true;
    s.ai.reply = ['Vì ', 'S3'];
    const dialog = await openChat();
    await ask(dialog);
    fireEvent.click(screen.getByRole('button', { name: 'Câu sau' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    await act(async () => s.ai.release());
    await waitFor(() =>
      expect(s.chats.saved.at(-1)).toEqual({ key: s.key, messages: [{ role: 'user', text: 'Tại sao?' }, { role: 'model', text: 'Vì S3' }] }),
    );
  });

  it('đóng khung khi Gemini đang trả lời: vẫn lưu', async () => {
    const s = setup();
    s.ai.hold = true;
    const dialog = await openChat();
    await ask(dialog);
    fireEvent.keyDown(window, { key: 'Escape' });
    await act(async () => s.ai.release());
    await waitFor(() => expect(s.chats.saved.at(-1)?.key).toBe(s.key));
  });

  it('quay lại câu cũ khi Gemini còn đang trả lời: thấy câu hỏi đang chờ rồi câu trả lời', async () => {
    const s = setup();
    s.ai.hold = true;
    s.ai.reply = ['Trả lời ở nền'];
    const dialog = await openChat();
    await ask(dialog, 'Hỏi rồi đi');
    fireEvent.click(screen.getByRole('button', { name: 'Câu sau' }));
    fireEvent.click(screen.getByRole('button', { name: 'Câu trước' }));
    fireEvent.click(screen.getByRole('button', { name: GEMINI }));
    const again = screen.getByRole('dialog', { name: 'Hỏi Gemini · Câu 1' });
    expect(await within(again).findByText('Hỏi rồi đi')).toBeInTheDocument();
    expect(within(again).getByText('Gemini đang trả lời…')).toBeInTheDocument();
    expect(within(again).getByRole('button', { name: 'Gửi' })).toBeDisabled();
    await act(async () => s.ai.release());
    expect(await within(again).findByText('Trả lời ở nền')).toBeInTheDocument();
    await waitFor(() => expect(within(again).getByRole('button', { name: 'Gửi' })).toBeEnabled());
  });

  it('startChat nhận tool find_answered_questions', async () => {
    const s = setup();
    const dialog = await openChat();
    await ask(dialog);
    expect(s.ai.calls[0].options?.tools?.map((t) => t.name)).toEqual(['find_answered_questions', 'open_guide']);
  });

  it('Gemini gọi tool tìm câu: hiện dòng chờ, kết quả gửi lại cho mô hình, câu tìm được gắn nhãn', async () => {
    const s = setup();
    const other = s.store.get('e1')!.questions[1].qid;
    s.store.save(selectOption(s.store.get('e1')!, other, 'A', 1));
    s.ai.toolCalls = [{ name: 'find_answered_questions', args: { query: `Stem ${other}` } }];
    s.ai.hold = true;
    const dialog = await openChat();
    await ask(dialog);
    await waitFor(() => expect(within(dialog).getByText('Gemini đang tìm trong các câu bạn đã làm…')).toBeInTheDocument());
    await act(async () => s.ai.release());
    await waitFor(() => expect(within(dialog).queryByText('Gemini đang tìm trong các câu bạn đã làm…')).toBeNull());
    const result = s.ai.calls[0].toolResults[0] as { results: { qid: number }[] };
    expect(result.results.map((r) => r.qid)).toContain(other);
    expect(guideOpened(s)).toContain(other);
  });

  it('Esc đóng popup (kể cả khi đang mở rộng) và trả lại cuộn trang', async () => {
    setup();
    const dialog = await openChat();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Mở rộng' }));
    expect(document.body.style.overflow).toBe('hidden');
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.body.style.overflow).toBe('');
    expect(screen.getByRole('button', { name: GEMINI })).toBeInTheDocument();
  });
});

describe('Trò chuyện cũ', () => {
  /** Lượt Thi thử cũ e0 cùng đề (cùng seed nên cùng câu), có chat ở câu thứ 3. */
  function withOld({ submitted = false, extra = {} }: { submitted?: boolean; extra?: Record<string, ChatMessage[]> } = {}) {
    const probe = makeDeps();
    const e0 = createAttempt({ id: 'e0', setId: 1, mode: 'practice', esl: false, seed: 7, now: 100, sets: probe.bank.sets, questions: probe.bank.questions, metas: probe.bank.meta });
    const oldQid = e0.questions[2].qid;
    const s = setup({ extraChats: { [`u1/e0/${oldQid}`]: [{ role: 'user', text: 'Câu cũ hỏi gì?' }, { role: 'model', text: 'Trả lời cũ' }], ...extra } });
    s.store.save(submitted ? submitAttempt(e0, 200) : e0);
    return { ...s, oldQid };
  }

  /** all = bỏ chọn "Chỉ câu này" để thấy mọi cuộc trò chuyện. */
  async function openList({ all = true }: { all?: boolean } = {}) {
    const dialog = await openChat();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Trò chuyện cũ' }));
    if (all) fireEvent.click(within(dialog).getByRole('checkbox', { name: 'Chỉ câu này' }));
    return dialog;
  }

  const OLD = (text: string): ChatMessage[] => [{ role: 'user', text: 'hỏi' }, { role: 'model', text }];

  it('mặc định chỉ hiện cuộc trò chuyện cùng câu, cùng đề; câu đang làm đứng đầu', async () => {
    const probe = withOld();
    const s = probe;
    // Thêm: cùng câu ở lượt e0 (cùng đề) và cùng câu ở lượt f2 (đề khác).
    await s.chats.save('u1', 'e0', s.qid, OLD('Cùng câu cùng đề'));
    s.store.save({ ...s.store.get('e0')!, id: 'f2', setId: 2 });
    await s.chats.save('u1', 'f2', s.qid, OLD('Cùng câu đề khác'));
    const dialog = await openList({ all: false });
    expect(within(dialog).getByRole('checkbox', { name: 'Chỉ câu này' })).toBeChecked();
    expect(await within(dialog).findByText(/Cùng câu cùng đề/)).toBeInTheDocument();
    const items = within(dialog).getAllByRole('button', { name: /Đề \d · Câu/ });
    expect(items[0]).toHaveTextContent('(câu đang làm)');
    expect(within(dialog).queryByText(/Cùng câu đề khác/)).toBeNull();
    expect(within(dialog).queryByText(/Trả lời cũ/)).toBeNull();
  });

  it('chưa có cuộc trò chuyện nào về câu này thì báo', async () => {
    withOld();
    const dialog = await openList({ all: false });
    expect(await within(dialog).findByText('Chưa có cuộc trò chuyện nào về câu này.')).toBeInTheDocument();
  });

  it('bỏ lọc: nhóm theo bộ đề', async () => {
    const s = withOld();
    s.store.save({ ...s.store.get('e0')!, id: 'f2', setId: 2 });
    await s.chats.save('u1', 'f2', s.qid, OLD('Ở đề 2'));
    const dialog = await openList();
    expect(await within(dialog).findByRole('heading', { name: 'Đề 1' })).toBeInTheDocument();
    expect(within(dialog).getByRole('heading', { name: 'Đề 2' })).toBeInTheDocument();
    expect(within(dialog).getByText(/Trả lời cũ/)).toBeInTheDocument();
    expect(within(dialog).getByText(/Ở đề 2/)).toBeInTheDocument();
  });

  it('tìm không dấu, bỏ qua lọc', async () => {
    withOld();
    const dialog = await openList({ all: false });
    await within(dialog).findByText('Chưa có cuộc trò chuyện nào về câu này.');
    fireEvent.change(within(dialog).getByRole('searchbox', { name: 'Tìm cuộc trò chuyện' }), { target: { value: 'de 1 cau 3' } });
    expect(within(dialog).getByRole('button', { name: /Đề 1 · Câu 3/ })).toBeInTheDocument();
    expect(within(dialog).getByRole('checkbox', { name: 'Chỉ câu này' })).toBeChecked();
  });

  it('tìm theo ngày giờ và báo khi không có kết quả', async () => {
    const s = withOld();
    const dialog = await openList();
    await within(dialog).findByText(/Trả lời cũ/);
    const list = await s.chats.list('u1');
    const date = formatDate(list[0].updatedAt).slice(0, 5);
    const box = within(dialog).getByRole('searchbox', { name: 'Tìm cuộc trò chuyện' });
    fireEvent.change(box, { target: { value: date } });
    expect(within(dialog).getByText(/Trả lời cũ/)).toBeInTheDocument();
    fireEvent.change(box, { target: { value: 'zzz' } });
    expect(within(dialog).getByText('Không tìm thấy cuộc trò chuyện nào.')).toBeInTheDocument();
  });

  it('đổi tên: Enter lưu, hiện tên mới kèm tên mặc định; tìm được theo tên mới', async () => {
    const s = withOld();
    const dialog = await openList();
    fireEvent.click(await within(dialog).findByRole('button', { name: 'Đổi tên' }));
    const input = within(dialog).getByRole('textbox', { name: 'Tên cuộc trò chuyện' });
    fireEvent.change(input, { target: { value: '  Multipart upload  ' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    const item = await within(dialog).findByRole('button', { name: /Multipart upload/ });
    expect(item).toHaveTextContent('Đề 1 · Câu 3');
    expect(s.chats.titles.get(`u1/e0/${s.oldQid}`)).toBe('Multipart upload');
    fireEvent.change(within(dialog).getByRole('searchbox', { name: 'Tìm cuộc trò chuyện' }), { target: { value: 'multipart' } });
    expect(within(dialog).getByRole('button', { name: /Multipart upload/ })).toBeInTheDocument();
  });

  it('đổi tên: Esc hủy (không đóng khung), để trống thì bỏ tên', async () => {
    const s = withOld();
    s.chats.titles.set(`u1/e0/${s.oldQid}`, 'Tên cũ');
    const dialog = await openList();
    fireEvent.click(await within(dialog).findByRole('button', { name: 'Đổi tên' }));
    let input = within(dialog).getByRole('textbox', { name: 'Tên cuộc trò chuyện' });
    fireEvent.change(input, { target: { value: 'Không lưu' } });
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: /Tên cũ/ })).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Đổi tên' }));
    input = within(dialog).getByRole('textbox', { name: 'Tên cuộc trò chuyện' });
    fireEvent.change(input, { target: { value: '   ' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    await waitFor(() => expect(s.chats.titles.has(`u1/e0/${s.oldQid}`)).toBe(false));
    expect(within(dialog).queryByText(/Tên cũ/)).toBeNull();
  });

  it('đổi tên lỗi thì báo và giữ tên cũ', async () => {
    const s = withOld();
    s.chats.titles.set(`u1/e0/${s.oldQid}`, 'Tên cũ');
    s.chats.renameError = new Error('offline');
    const dialog = await openList();
    fireEvent.click(await within(dialog).findByRole('button', { name: 'Đổi tên' }));
    const input = within(dialog).getByRole('textbox', { name: 'Tên cuộc trò chuyện' });
    fireEvent.change(input, { target: { value: 'Mới' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(await within(dialog).findByText('Không đổi được tên.')).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: /Tên cũ/ })).toBeInTheDocument();
  });

  it('câu đang làm chưa có lịch sử thì không đổi tên được', async () => {
    withOld();
    const dialog = await openList({ all: false });
    await within(dialog).findByText('Chưa có cuộc trò chuyện nào về câu này.');
    expect(within(dialog).queryByRole('button', { name: 'Đổi tên' })).toBeNull();
  });

  it('mở cuộc trò chuyện cũ: hiện tin cũ, có dải quay lại; quay lại thì về câu đang làm', async () => {
    withOld();
    const dialog = await openList();
    fireEvent.click(await within(dialog).findByRole('button', { name: /Đề 1 · Câu 3/ }));
    expect(await within(dialog).findByText('Trả lời cũ')).toBeInTheDocument();
    expect(within(dialog).getByRole('heading', { name: 'Hỏi Gemini · Đề 1 · Câu 3' })).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole('button', { name: '← Quay lại Đề 1 · Câu 1' }));
    expect(within(dialog).getByRole('heading', { name: 'Hỏi Gemini · Câu 1' })).toBeInTheDocument();
    expect(within(dialog).queryByText('Trả lời cũ')).toBeNull();
  });

  it('hỏi tiếp ở cuộc trò chuyện cũ: lưu vào đúng (attempt, qid) cũ, không đánh dấu câu đang làm', async () => {
    const s = withOld();
    const dialog = await openList();
    fireEvent.click(await within(dialog).findByRole('button', { name: /Đề 1 · Câu 3/ }));
    await waitFor(() => expect(within(dialog).getByRole('button', { name: 'Gửi' })).toBeEnabled());
    s.ai.toolCalls = [{ name: 'open_guide', args: {} }];
    await ask(dialog);
    await waitFor(() => expect(s.chats.saved.at(-1)?.key).toBe(`u1/e0/${s.oldQid}`));
    expect(s.ai.calls[0].history.map((m) => m.text)).toEqual(['Câu cũ hỏi gì?', 'Trả lời cũ']);
    expect(guideOpened(s)).not.toContain(s.qid);
    expect(s.store.get('e0')!.guideOpened).toContain(s.oldQid);
  });

  it('lượt cũ đã nộp: hỏi tiếp không sửa lượt đó', async () => {
    const s = withOld({ submitted: true });
    const dialog = await openList();
    fireEvent.click(await within(dialog).findByRole('button', { name: /Đề 1 · Câu 3/ }));
    await waitFor(() => expect(within(dialog).getByRole('button', { name: 'Gửi' })).toBeEnabled());
    await ask(dialog);
    await waitFor(() => expect(s.chats.saved.at(-1)?.key).toBe(`u1/e0/${s.oldQid}`));
    expect(s.store.get('e0')!.guideOpened).toEqual([]);
    expect(s.ai.calls[0].options?.tools?.map((t) => t.name)).toEqual(['find_answered_questions']);
    expect(s.ai.calls[0].systemPrompt).toContain('đã thấy đáp án');
  });

  it('ẩn cuộc trò chuyện của lượt đã xóa', async () => {
    withOld({ extra: { 'u1/gone/1': [{ role: 'user', text: 'mất rồi' }, { role: 'model', text: 'Chat của lượt đã xóa' }] } });
    const dialog = await openList();
    await within(dialog).findByRole('button', { name: /Đề 1 · Câu 3/ });
    expect(within(dialog).queryByText(/Chat của lượt đã xóa/)).toBeNull();
  });

  it('chưa có cuộc trò chuyện khác thì báo, không crash (kể cả lỗi tải danh sách)', async () => {
    const s = setup();
    s.chats.listError = new Error('offline');
    const dialog = await openList({ all: false });
    expect(await within(dialog).findByText('Chưa có cuộc trò chuyện nào về câu này.')).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: /câu đang làm/ })).toBeInTheDocument();
  });

  it('đăng xuất khi đang ở danh sách thì đóng khung', async () => {
    const s = withOld();
    await openList();
    act(() => s.auth.emit(null));
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
