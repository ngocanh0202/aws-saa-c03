import { act, fireEvent, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import type { QuestionNotes } from '../notes/model';
import { makeBank, makeDeps, renderApp } from '../test/fixtures';

const hlNotes = (qid: number, updatedAt: number, note = '', text = 'Stem'): QuestionNotes => ({
  qid,
  updatedAt,
  highlights: [{ id: `h${qid}`, part: 'stem', start: 0, end: 4, text, note, updatedAt }],
});

function withItems(qid: number, items: { id: string; kind: 'ai' | 'manual'; title: string; content: string; at: number }[]): QuestionNotes {
  return {
    qid,
    updatedAt: Math.max(...items.map((i) => i.at)),
    highlights: [],
    items: items.map((i) => ({ id: i.id, kind: i.kind, title: i.title, content: i.content, createdAt: i.at, updatedAt: i.at })),
  };
}

const titles = (c: HTMLElement) => [...c.querySelectorAll('.notes-entry__title')].map((e) => e.textContent);

/** Ba nguồn: đoạn tô câu 3 (t=100), AI câu 5 (t=300), tự ghi câu 70 (dự phòng, t=200). */
function seeded() {
  const deps = makeDeps();
  deps.notes.save(hlNotes(3, 100, 'ghi chú ba'));
  deps.notes.save(withItems(5, [{ id: 'a1', kind: 'ai', title: 'Tại sao?', content: 'Vì **S3**', at: 300 }]));
  deps.notes.save(withItems(70, [{ id: 'm1', kind: 'manual', title: 'Nhớ Multi-AZ', content: 'Failover\ntự động', at: 200 }]));
  return deps;
}

beforeEach(() => localStorage.clear());

describe('NotesPage — danh sách', () => {
  it('chưa có ghi chú → dòng hướng dẫn', () => {
    renderApp('/notes', makeDeps());
    expect(screen.getByRole('heading', { name: 'Ghi chú của tôi' })).toBeInTheDocument();
    expect(screen.getByText(/Chưa có ghi chú/)).toBeInTheDocument();
  });

  it('đoạn tô chưa có ghi chú không được liệt kê', () => {
    const deps = makeDeps();
    deps.notes.save(hlNotes(1, 100, ''));
    renderApp('/notes', deps);
    expect(screen.getByText(/Chưa có ghi chú/)).toBeInTheDocument();
  });

  it('ba nguồn, mới nhất trước; chỉ tiêu đề + nội dung, không hiện đề và lựa chọn', () => {
    const { container } = renderApp('/notes', seeded());
    expect(titles(container)).toEqual(['Tại sao?', 'Nhớ Multi-AZ', 'Stem']);
    expect(container).toHaveTextContent('Câu trả lời AI');
    expect(container).toHaveTextContent('Tự ghi chú');
    expect(container).toHaveTextContent('Tô đề');
    expect(container).toHaveTextContent('Kho dự phòng · Câu 70');
    expect(container.querySelector('.qcard')).toBeNull();
    // Nội dung AI hiện bằng Markdown.
    expect(container.querySelector('.notes-entry--ai strong')).toHaveTextContent('S3');
  });

  it('tìm không dấu theo tiêu đề / nội dung', () => {
    const { container } = renderApp('/notes', seeded());
    fireEvent.change(screen.getByRole('searchbox', { name: 'Tìm ghi chú' }), { target: { value: 'tu dong' } });
    expect(titles(container)).toEqual(['Nhớ Multi-AZ']);
    fireEvent.change(screen.getByRole('searchbox', { name: 'Tìm ghi chú' }), { target: { value: 'zzz' } });
    expect(screen.getByText('Không có ghi chú nào khớp.')).toBeInTheDocument();
  });

  it('sắp xếp "Cũ nhất" đảo thứ tự', () => {
    const { container } = renderApp('/notes', seeded());
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'oldest' } });
    expect(titles(container)).toEqual(['Stem', 'Nhớ Multi-AZ', 'Tại sao?']);
  });

  it('cập nhật khi store đổi', () => {
    const deps = makeDeps();
    renderApp('/notes', deps);
    act(() => deps.notes.save(hlNotes(1, 100, 'mới')));
    expect(screen.getByText('mới')).toBeInTheDocument();
  });

  it('câu main có nhãn "Main N · Câu M"', () => {
    const deps = makeDeps({ bank: makeBank({ main: true }) });
    deps.notes.save(hlNotes(10102, 5, 'n', 'Main'));
    renderApp('/notes', deps);
    expect(screen.getByText('Main 1 · Câu 2')).toBeInTheDocument();
  });
});

describe('NotesPage — gộp tự do', () => {
  const groupButton = (name: string) => within(screen.getByRole('group', { name: 'Gộp theo' })).getByRole('button', { name: new RegExp(name) });
  const summaries = (c: HTMLElement) => [...c.querySelectorAll(':scope .notes-page > .notes-group > summary')].map((s) => s.textContent);

  it('gộp theo câu hỏi mà không cần gộp theo đề', () => {
    const { container } = renderApp('/notes', seeded());
    fireEvent.click(groupButton('Câu hỏi'));
    expect(groupButton('Câu hỏi')).toHaveAttribute('aria-pressed', 'true');
    expect(summaries(container)).toEqual(['Đề 1 · Câu 5 (1)', 'Kho dự phòng · Câu 70 (1)', 'Đề 1 · Câu 3 (1)']);
  });

  it('bật nguồn rồi đề: nhóm nguồn chứa nhóm đề; nút hiện số tầng; nhớ sau khi tải lại', () => {
    const deps = seeded();
    const first = renderApp('/notes', deps);
    fireEvent.click(groupButton('Nguồn'));
    fireEvent.click(groupButton('Đề'));
    expect(within(groupButton('Nguồn')).getByLabelText('tầng 1')).toBeInTheDocument();
    expect(within(groupButton('Đề')).getByLabelText('tầng 2')).toBeInTheDocument();
    expect(summaries(first.container)).toEqual(['Câu trả lời AI (1)', 'Tự ghi chú (1)', 'Tô đề (1)']);
    const inner = first.container.querySelector('.notes-page > .notes-group .notes-group > summary');
    expect(inner).toHaveTextContent('Đề 1 (1)');
    first.unmount();
    const second = renderApp('/notes', deps);
    expect(summaries(second.container)).toEqual(['Câu trả lời AI (1)', 'Tự ghi chú (1)', 'Tô đề (1)']);
  });

  it('tắt hết thì không gộp', () => {
    const { container } = renderApp('/notes', seeded());
    fireEvent.click(groupButton('Đề'));
    fireEvent.click(groupButton('Đề'));
    expect(container.querySelector('.notes-group')).toBeNull();
    expect(titles(container)).toHaveLength(3);
  });
});

describe('NotesPage — sửa, xóa', () => {
  const entry = (c: HTMLElement, title: string) =>
    [...c.querySelectorAll<HTMLElement>('.notes-entry')].find((e) => e.querySelector('.notes-entry__title')?.textContent === title)!;

  it('sửa ghi chú tự ghi: đổi tiêu đề và nội dung', () => {
    const deps = seeded();
    const { container } = renderApp('/notes', deps);
    const e = entry(container, 'Nhớ Multi-AZ');
    fireEvent.click(within(e).getByRole('button', { name: 'Sửa' }));
    fireEvent.change(within(e).getByRole('textbox', { name: 'Tiêu đề' }), { target: { value: 'Tiêu đề mới' } });
    fireEvent.change(within(e).getByRole('textbox', { name: 'Nội dung' }), { target: { value: 'Nội dung mới' } });
    fireEvent.click(within(e).getByRole('button', { name: 'Lưu' }));
    expect(deps.notes.get(70)!.items![0]).toMatchObject({ title: 'Tiêu đề mới', content: 'Nội dung mới' });
    expect(titles(container)[0]).toBe('Tiêu đề mới');
  });

  it('sửa đoạn tô: chỉ có ô nội dung, chữ đoạn tô giữ nguyên', () => {
    const deps = seeded();
    const { container } = renderApp('/notes', deps);
    const e = entry(container, 'Stem');
    fireEvent.click(within(e).getByRole('button', { name: 'Sửa' }));
    expect(within(e).queryByRole('textbox', { name: 'Tiêu đề' })).toBeNull();
    fireEvent.change(within(e).getByRole('textbox', { name: 'Nội dung' }), { target: { value: 'đã sửa' } });
    fireEvent.click(within(e).getByRole('button', { name: 'Lưu' }));
    expect(deps.notes.get(3)!.highlights[0]).toMatchObject({ text: 'Stem', note: 'đã sửa' });
  });

  it('xóa cần xác nhận; xóa đoạn tô thì xóa luôn highlight', () => {
    const deps = seeded();
    const { container } = renderApp('/notes', deps);
    const e = entry(container, 'Stem');
    fireEvent.click(within(e).getByRole('button', { name: 'Xóa ghi chú' }));
    fireEvent.click(within(e).getByRole('button', { name: 'Xóa' }));
    expect(deps.notes.get(3)!.highlights).toEqual([]);
    expect(titles(container)).toEqual(['Tại sao?', 'Nhớ Multi-AZ']);
  });

  it('xóa ghi chú AI', () => {
    const deps = seeded();
    const { container } = renderApp('/notes', deps);
    const e = entry(container, 'Tại sao?');
    fireEvent.click(within(e).getByRole('button', { name: 'Xóa ghi chú' }));
    fireEvent.click(within(e).getByRole('button', { name: 'Xóa' }));
    expect(deps.notes.get(5)!.items).toEqual([]);
  });
});

describe('NotesPage — khung xem câu hỏi', () => {
  it('"Mở câu hỏi": hiện đề, đáp án đúng và hướng dẫn; đóng được', () => {
    const { container } = renderApp('/notes', seeded());
    const e = [...container.querySelectorAll<HTMLElement>('.notes-entry')].find((x) => x.textContent?.includes('Stem'))!;
    fireEvent.click(within(e).getByRole('button', { name: 'Mở câu hỏi' }));
    const dialog = screen.getByRole('dialog', { name: 'Câu hỏi · Đề 1 · Câu 3' });
    expect(dialog).toHaveTextContent('Stem 3');
    expect(dialog.querySelectorAll('.opt--correct-chosen')).toHaveLength(1);
    expect(within(dialog).getByRole('complementary', { name: 'Hướng dẫn' })).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Đóng' }));
    expect(screen.queryByRole('dialog', { name: /Câu hỏi/ })).toBeNull();
  });

  it('toast "Đến câu" từ AI soạn ghi chú: mở khung câu đó và popup đoạn tô', () => {
    const deps = makeDeps();
    deps.notes.save(hlNotes(1, 100, 'nội dung cũ'));
    deps.aiGate.requestOpen({ page: 'notes', qid: 1, highlightId: 'h1' });
    renderApp('/notes', deps);
    expect(screen.getByRole('dialog', { name: 'Câu hỏi · Đề 1 · Câu 1' })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Ghi chú' })).toHaveValue('nội dung cũ');
  });

  it('Layout có link "Ghi chú" tới /notes', () => {
    renderApp('/', makeDeps());
    expect(screen.getByRole('link', { name: 'Ghi chú' })).toHaveAttribute('href', '/notes');
  });
});

describe('NotesPage — Esc trong khung xem câu', () => {
  it('Esc khi popup đoạn tô đang mở chỉ đóng popup, khung vẫn mở', () => {
    const deps = makeDeps();
    deps.notes.save(hlNotes(1, 100, 'nội dung'));
    deps.aiGate.requestOpen({ page: 'notes', qid: 1, highlightId: 'h1' });
    renderApp('/notes', deps);
    expect(screen.getByRole('textbox', { name: 'Ghi chú' })).toBeInTheDocument();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('textbox', { name: 'Ghi chú' })).toBeNull();
    expect(screen.getByRole('dialog', { name: 'Câu hỏi · Đề 1 · Câu 1' })).toBeInTheDocument();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog', { name: /Câu hỏi/ })).toBeNull();
  });
});
