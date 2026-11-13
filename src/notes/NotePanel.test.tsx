import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { AppProvider } from '../app/context';
import { makeDeps, makeQuestion } from '../test/fixtures';
import type { QuestionNotes } from './model';
import { NotePanel } from './NotePanel';

const QID = 5;
const question = makeQuestion(QID);
const hl = (id: string, text: string, note: string, updatedAt: number) => ({ id, part: 'stem' as const, start: 0, end: text.length, text, note, updatedAt });
const seed: QuestionNotes = {
  qid: QID,
  updatedAt: 40,
  highlights: [hl('h1', 'Stem', 'ghi chú đoạn tô', 10), hl('h2', 'Stem 5', '', 15)],
  items: [
    { id: 'a1', kind: 'ai', title: 'Câu hỏi AI', content: 'Trả lời', createdAt: 20, updatedAt: 20 },
    { id: 'm1', kind: 'manual', title: 'Tự ghi', content: 'Multi-AZ', createdAt: 30, updatedAt: 30 },
  ],
};

function mount(notes?: QuestionNotes) {
  const deps = makeDeps();
  if (notes) deps.notes.save(notes);
  const onClose = vi.fn();
  render(
    <AppProvider deps={deps}>
      <MemoryRouter>
        <NotePanel qid={QID} label="Câu 1" question={question} onClose={onClose} />
      </MemoryRouter>
    </AppProvider>,
  );
  const panel = screen.getByRole('dialog', { name: 'Ghi chú · Câu 1' });
  return { deps, onClose, panel };
}

const titles = (panel: HTMLElement) => within(panel).queryAllByRole('heading', { level: 3 }).map((h) => h.textContent);

describe('NotePanel', () => {
  it('liệt kê đoạn tô có ghi chú và các item, mới nhất trước, không có Mở câu hỏi', () => {
    const { panel } = mount(seed);
    expect(titles(panel)).toEqual(['Tự ghi', 'Câu hỏi AI', 'Stem']);
    expect(within(panel).queryByRole('button', { name: 'Mở câu hỏi' })).toBeNull();
  });

  it('câu chưa có ghi chú', () => {
    const { panel } = mount();
    expect(within(panel).getByText('Chưa có ghi chú nào cho câu này.')).toBeInTheDocument();
  });

  it('thêm ghi chú: hiện trong danh sách, form trống lại, khung vẫn mở', () => {
    const { panel, deps, onClose } = mount();
    const form = panel.querySelector('.note-panel__add') as HTMLElement;
    fireEvent.change(within(form).getByRole('textbox', { name: 'Tiêu đề' }), { target: { value: 'Mới' } });
    fireEvent.click(within(form).getByRole('button', { name: 'Lưu' }));
    expect(titles(panel)).toEqual(['Mới']);
    expect(within(form).getByRole('textbox', { name: 'Tiêu đề' })).toHaveValue('');
    expect(onClose).not.toHaveBeenCalled();
    expect(deps.notes.get(QID)!.items![0]).toMatchObject({ kind: 'manual', title: 'Mới' });
  });

  it('sửa đoạn tô: không có ô tiêu đề, lưu thì đổi nội dung', () => {
    const { panel, deps } = mount(seed);
    const card = within(panel).getByRole('heading', { name: 'Stem' }).closest('article')!;
    fireEvent.click(within(card).getByRole('button', { name: 'Sửa' }));
    expect(within(card).queryByRole('textbox', { name: 'Tiêu đề' })).toBeNull();
    fireEvent.change(within(card).getByRole('textbox', { name: 'Nội dung' }), { target: { value: 'mới sửa' } });
    fireEvent.click(within(card).getByRole('button', { name: 'Lưu' }));
    expect(deps.notes.get(QID)!.highlights[0].note).toBe('mới sửa');
  });

  it('đang sửa: Esc (focus tự vào form) chỉ hủy sửa, khung vẫn mở', () => {
    const { panel, onClose } = mount(seed);
    const card = within(panel).getByRole('heading', { name: 'Tự ghi' }).closest('article')!;
    fireEvent.click(within(card).getByRole('button', { name: 'Sửa' }));
    expect(card.contains(document.activeElement)).toBe(true);
    fireEvent.keyDown(document.activeElement!, { key: 'Escape' });
    expect(onClose).not.toHaveBeenCalled();
    expect(within(card).getByRole('button', { name: 'Sửa' })).toBeInTheDocument();
  });

  it('xóa: Esc hủy xác nhận mà khung vẫn mở; xác nhận thì mục mất', () => {
    const { panel, onClose } = mount(seed);
    const card = () => within(panel).getByRole('heading', { name: 'Tự ghi' }).closest('article')!;
    fireEvent.click(within(card()).getByRole('button', { name: 'Xóa ghi chú' }));
    fireEvent.keyDown(within(card()).getByRole('button', { name: 'Hủy' }), { key: 'Escape' });
    expect(onClose).not.toHaveBeenCalled();
    expect(within(card()).getByRole('button', { name: 'Xóa ghi chú' })).toBeInTheDocument();
    fireEvent.click(within(card()).getByRole('button', { name: 'Xóa ghi chú' }));
    fireEvent.click(within(card()).getByRole('button', { name: 'Xóa' }));
    expect(titles(panel)).toEqual(['Câu hỏi AI', 'Stem']);
  });
});
