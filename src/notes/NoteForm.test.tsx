import { act, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { AppProvider } from '../app/context';
import type { AppDeps } from '../app/context';
import { createStore } from '../storage/storage';
import { createSyncController } from '../sync/controller';
import type { SyncUser } from '../sync/types';
import { fakeAi, fakeChats } from '../test/fake-ai';
import { fakeAuth, fakeRemote } from '../test/fake-sync';
import { makeDeps, makeQuestion, memoryStorage } from '../test/fixtures';
import { NoteForm } from './NoteForm';
import { NoteSheet } from './NoteSheet';

const USER: SyncUser = { uid: 'u1', name: 'An Nguyen' };
const AI = 'AI hỗ trợ viết ghi chú';
const question = makeQuestion(5);
const tick = () => act(() => new Promise<void>((r) => setTimeout(r, 0)));

function deps({ withAi = true }: { withAi?: boolean } = {}) {
  const store = createStore(memoryStorage(), { now: () => 500 });
  const auth = fakeAuth();
  const sync = createSyncController({ store, auth, remote: fakeRemote() });
  const ai = fakeAi();
  const d: AppDeps = withAi ? { ...makeDeps({ store, sync }), ai, chats: fakeChats() } : makeDeps({ store, sync });
  return { d, ai, auth };
}

function mount(ui: React.ReactNode, opts?: { withAi?: boolean }) {
  const s = deps(opts);
  render(
    <AppProvider deps={s.d}>
      <MemoryRouter>{ui}</MemoryRouter>
    </AppProvider>,
  );
  act(() => s.auth.emit(USER));
  return s;
}

const box = (name: string) => screen.getByRole('textbox', { name });

describe('NoteForm', () => {
  it('nút AI khóa khi hai ô trống, mở khi có tiêu đề', () => {
    mount(<NoteForm qid={5} label="Câu 1" question={question} onSave={() => true} />);
    expect(screen.getByRole('button', { name: AI })).toBeDisabled();
    fireEvent.change(box('Tiêu đề'), { target: { value: 'VPC' } });
    expect(screen.getByRole('button', { name: AI })).toBeEnabled();
  });

  it('kết quả AI nối vào nội dung hiện tại, không đè chữ gõ thêm', async () => {
    const s = mount(<NoteForm qid={5} label="Câu 1" question={question} initial={{ title: 'T', content: 'cũ' }} onSave={() => true} />);
    s.ai.hold = true;
    s.ai.reply = ['AI viết'];
    fireEvent.click(screen.getByRole('button', { name: AI }));
    await tick();
    expect(screen.getByText('AI đang soạn…')).toBeInTheDocument();
    fireEvent.change(box('Nội dung'), { target: { value: 'cũ thêm' } });
    await act(async () => {
      s.ai.release();
      await new Promise((r) => setTimeout(r, 0));
    });
    await tick();
    expect(box('Nội dung')).toHaveValue('cũ thêm\n\nAI viết');
    expect(s.ai.calls[0].systemPrompt).toContain('Stem 5');
  });

  it('gate đang bận (chat chạy) thì nút AI khóa', async () => {
    const s = mount(<NoteForm qid={5} label="Câu 1" initial={{ title: 'T', content: '' }} onSave={() => true} />);
    let done!: () => void;
    act(() => {
      void s.d.aiGate.run({ kind: 'chat', label: 'x', target: { page: 'attempt', attemptId: 'e', qid: 1 } }, () => new Promise<void>((r) => (done = r)));
    });
    expect(screen.getByRole('button', { name: AI })).toBeDisabled();
    await act(async () => done());
  });

  it('không có AI thì không có nút AI', () => {
    mount(<NoteForm qid={5} label="Câu 1" onSave={() => true} />, { withAi: false });
    expect(screen.queryByRole('button', { name: AI })).toBeNull();
  });

  it('onSave trả false thì báo quá dài', () => {
    mount(<NoteForm qid={5} label="Câu 1" onSave={() => false} />);
    fireEvent.change(box('Tiêu đề'), { target: { value: 'x' } });
    fireEvent.click(screen.getByRole('button', { name: 'Lưu' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Ghi chú của câu này đã quá dài, hãy xóa bớt.');
  });

  it('resetOnSave xóa trống sau khi lưu', () => {
    const onSave = vi.fn(() => true);
    mount(<NoteForm qid={5} label="Câu 1" onSave={onSave} resetOnSave />);
    fireEvent.change(box('Tiêu đề'), { target: { value: 'x' } });
    fireEvent.change(box('Nội dung'), { target: { value: 'y' } });
    fireEvent.click(screen.getByRole('button', { name: 'Lưu' }));
    expect(onSave).toHaveBeenCalledWith({ title: 'x', content: 'y' });
    expect(box('Tiêu đề')).toHaveValue('');
    expect(box('Nội dung')).toHaveValue('');
  });
});

describe('NoteSheet', () => {
  it('Esc đóng khung', () => {
    const onClose = vi.fn();
    mount(
      <NoteSheet title="Ghi chú" ariaLabel="Ghi chú · Câu 1" onClose={onClose}>
        <p>x</p>
      </NoteSheet>,
    );
    expect(screen.getByRole('dialog', { name: 'Ghi chú · Câu 1' })).toBeInTheDocument();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('Esc trong form có onCancel chỉ hủy form, không đóng khung', () => {
    const onClose = vi.fn();
    const onCancel = vi.fn();
    mount(
      <NoteSheet title="Ghi chú" ariaLabel="Ghi chú · Câu 1" onClose={onClose}>
        <NoteForm qid={5} label="Câu 1" initial={{ title: 'T', content: 'c' }} onSave={() => true} onCancel={onCancel} />
      </NoteSheet>,
    );
    fireEvent.keyDown(box('Nội dung'), { key: 'Escape' });
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onClose).not.toHaveBeenCalled();
  });
});
