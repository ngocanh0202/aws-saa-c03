import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { AppProvider } from '../app/context';
import { makeDeps, makeQuestion } from '../test/fixtures';
import { createFreeNote, type QuestionNotes } from './model';
import { NotePanel } from './NotePanel';
import { SPLIT_KEY, loadSplit } from './split-size';

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

function mount(notes?: QuestionNotes, ...more: QuestionNotes[]) {
  const deps = makeDeps();
  for (const n of [notes, ...more]) if (n) deps.notes.save(n);
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

  it('Ghi chú mới mở popup form; lưu thì popup đóng, mục hiện trong danh sách, khung vẫn mở', () => {
    const { panel, deps, onClose } = mount();
    expect(within(panel).queryByRole('textbox', { name: 'Tiêu đề' })).toBeNull();
    fireEvent.click(within(panel).getByRole('button', { name: 'Ghi chú mới' }));
    const pop = screen.getByRole('dialog', { name: 'Ghi chú mới · Câu 1' });
    expect(pop).toHaveAttribute('aria-modal', 'true');
    fireEvent.change(within(pop).getByRole('textbox', { name: 'Tiêu đề' }), { target: { value: 'Mới' } });
    fireEvent.click(within(pop).getByRole('button', { name: 'Lưu' }));
    expect(screen.queryByRole('dialog', { name: 'Ghi chú mới · Câu 1' })).toBeNull();
    expect(titles(panel)).toEqual(['Mới']);
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

describe('NotePanel — khung nổi như chat', () => {
  it('không modal; Mở rộng thì thành cột 30% bên phải (vẫn không modal), Thu nhỏ thì về góc', () => {
    const { panel } = mount(seed);
    expect(panel).not.toHaveAttribute('aria-modal');
    expect(panel).toHaveClass('note-sheet--dock');
    fireEvent.click(within(panel).getByRole('button', { name: 'Mở rộng' }));
    const big = screen.getByRole('dialog', { name: 'Ghi chú · Câu 1' });
    expect(big).toHaveClass('note-sheet--split');
    expect(big).not.toHaveAttribute('aria-modal');
    expect(document.querySelector('.note-sheet__backdrop')).toBeNull();
    fireEvent.click(within(big).getByRole('button', { name: 'Thu nhỏ' }));
    expect(screen.getByRole('dialog', { name: 'Ghi chú · Câu 1' })).toHaveClass('note-sheet--dock');
  });
});

describe('NotePanel — đổi cỡ giữ chữ đang gõ', () => {
  it('Mở rộng rồi Thu nhỏ không mất chữ đang sửa', () => {
    const { panel } = mount(seed);
    const card = () => document.querySelector('.notes-entry--manual') as HTMLElement;
    fireEvent.click(within(card()).getByRole('button', { name: 'Sửa' }));
    fireEvent.change(within(card()).getByRole('textbox', { name: 'Tiêu đề' }), { target: { value: 'đang gõ' } });
    fireEvent.click(within(panel).getByRole('button', { name: 'Mở rộng' }));
    expect(within(card()).getByRole('textbox', { name: 'Tiêu đề' })).toHaveValue('đang gõ');
    fireEvent.click(screen.getByRole('button', { name: 'Thu nhỏ' }));
    expect(within(card()).getByRole('textbox', { name: 'Tiêu đề' })).toHaveValue('đang gõ');
  });
});

describe('NotePanel — popup chồng lên khung', () => {
  it('Esc trong popup Ghi chú mới chỉ đóng popup, khung vẫn mở', () => {
    const { panel, onClose } = mount();
    fireEvent.click(within(panel).getByRole('button', { name: 'Ghi chú mới' }));
    fireEvent.keyDown(document.body, { key: 'Escape' });
    expect(screen.queryByRole('dialog', { name: 'Ghi chú mới · Câu 1' })).toBeNull();
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.keyDown(document.body, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe('NotePanel — kéo thanh không bị trễ vì animation', () => {
  it('đang kéo thì :root có data-note-drag (CSS tắt transition), thả ra thì bỏ', () => {
    const { panel } = mount(seed);
    fireEvent.click(within(panel).getByRole('button', { name: 'Mở rộng' }));
    const grip = screen.getByRole('separator', { name: 'Kéo để đổi độ rộng cột ghi chú' });
    fireEvent.pointerDown(grip, { pointerId: 1, button: 0, clientX: 700 });
    expect(document.documentElement).toHaveAttribute('data-note-drag');
    fireEvent.pointerUp(grip, { pointerId: 1, clientX: 700 });
    expect(document.documentElement).not.toHaveAttribute('data-note-drag');
  });
});

describe('NotePanel — nới rộng cột khi phóng to', () => {
  it('thanh kéo đổi tỉ lệ (phím mũi tên), kẹp trong 20%–60%, nhớ cho lần sau', () => {
    localStorage.removeItem(SPLIT_KEY);
    const { panel } = mount(seed);
    expect(within(panel).queryByRole('separator', { name: 'Kéo để đổi độ rộng cột ghi chú' })).toBeNull();
    fireEvent.click(within(panel).getByRole('button', { name: 'Mở rộng' }));
    const grip = screen.getByRole('separator', { name: 'Kéo để đổi độ rộng cột ghi chú' });
    expect(grip).toHaveAttribute('aria-valuenow', '30');
    expect(document.documentElement.style.getPropertyValue('--note-split')).toBe('30vw');
    fireEvent.keyDown(grip, { key: 'ArrowLeft' });
    expect(grip).toHaveAttribute('aria-valuenow', '32');
    expect(document.documentElement.style.getPropertyValue('--note-split')).toBe('32vw');
    for (let i = 0; i < 40; i++) fireEvent.keyDown(grip, { key: 'ArrowLeft' });
    expect(grip).toHaveAttribute('aria-valuenow', '60');
    for (let i = 0; i < 40; i++) fireEvent.keyDown(grip, { key: 'ArrowRight' });
    expect(grip).toHaveAttribute('aria-valuenow', '20');
    expect(loadSplit(localStorage)).toBe(0.2);
    fireEvent.click(within(screen.getByRole('dialog', { name: 'Ghi chú · Câu 1' })).getByRole('button', { name: 'Thu nhỏ' }));
    expect(document.documentElement.style.getPropertyValue('--note-split')).toBe('');
  });
});

describe('NotePanel — tra mọi ghi chú', () => {
  const other: QuestionNotes = {
    qid: 3,
    updatedAt: 50,
    highlights: [],
    items: [{ id: 'o1', kind: 'manual', title: 'Glacier Instant Retrieval', content: 'truy xuất ms', createdAt: 50, updatedAt: 50 }],
  };
  const free = createFreeNote(-7, { title: 'Ôn VPC', content: 'subnet' }, 'f1', 60);

  it('mặc định Câu này; Tất cả thì thấy ghi chú câu khác kèm nhãn và ghi chú chung', () => {
    const { panel } = mount(seed, other, free);
    expect(within(panel).getByRole('button', { name: 'Câu này' })).toHaveAttribute('aria-pressed', 'true');
    expect(titles(panel)).toEqual(['Tự ghi', 'Câu hỏi AI', 'Stem']);
    fireEvent.click(within(panel).getByRole('button', { name: 'Tất cả' }));
    expect(titles(panel)).toEqual(['Ôn VPC', 'Glacier Instant Retrieval', 'Tự ghi', 'Câu hỏi AI', 'Stem']);
    const card = within(panel).getByRole('heading', { name: 'Glacier Instant Retrieval' }).closest('article')!;
    expect(card).toHaveTextContent('Đề 1 · Câu 3');
    expect(within(panel).getByRole('heading', { name: 'Ôn VPC' }).closest('article')!).toHaveTextContent('Ghi chú chung');
    expect(within(panel).queryByRole('button', { name: 'Mở câu hỏi' })).toBeNull();
  });

  it('tìm không dấu trong tiêu đề, nội dung và nhãn', () => {
    const { panel } = mount(seed, other, free);
    fireEvent.click(within(panel).getByRole('button', { name: 'Tất cả' }));
    fireEvent.change(within(panel).getByRole('searchbox', { name: 'Tìm ghi chú' }), { target: { value: 'truy xuat' } });
    expect(titles(panel)).toEqual(['Glacier Instant Retrieval']);
    fireEvent.change(within(panel).getByRole('searchbox', { name: 'Tìm ghi chú' }), { target: { value: 'khong co' } });
    expect(within(panel).getByText('Không có ghi chú nào khớp.')).toBeInTheDocument();
  });

  it('ở Tất cả, Ghi chú mới tạo ghi chú chung', () => {
    const { panel, deps } = mount(seed);
    fireEvent.click(within(panel).getByRole('button', { name: 'Tất cả' }));
    fireEvent.click(within(panel).getByRole('button', { name: 'Ghi chú mới' }));
    const form = screen.getByRole('dialog', { name: 'Ghi chú mới · Ghi chú chung' });
    fireEvent.change(within(form).getByRole('textbox', { name: 'Tiêu đề' }), { target: { value: 'Chung' } });
    fireEvent.click(within(form).getByRole('button', { name: 'Lưu' }));
    const saved = deps.notes.list().find((n) => n.qid < 0)!;
    expect(saved.items![0]).toMatchObject({ kind: 'manual', title: 'Chung' });
    expect(deps.notes.get(QID)!.items).toHaveLength(2);
  });
});
