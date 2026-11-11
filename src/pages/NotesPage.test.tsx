import { act, fireEvent, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { QuestionNotes } from '../notes/model';
import { makeBank, makeDeps, renderApp } from '../test/fixtures';

const notes = (qid: number, updatedAt: number, note = '', text = 'Stem'): QuestionNotes => ({
  qid,
  updatedAt,
  highlights: [{ id: `h${qid}`, part: 'stem', start: 0, end: 4, text, note, updatedAt }],
});

describe('NotesPage', () => {
  it('chưa có ghi chú → dòng hướng dẫn', () => {
    renderApp('/notes', makeDeps());
    expect(screen.getByRole('heading', { name: 'Ghi chú của tôi' })).toBeInTheDocument();
    expect(screen.getByText('Chưa có ghi chú. Vào Thi thử, bôi đen chữ trong đề để tô.')).toBeInTheDocument();
  });

  it('câu mới cập nhật đứng trước; mỗi mục có đề, lựa chọn, đoạn tô và ghi chú', () => {
    const deps = makeDeps();
    deps.notes.save(notes(3, 100, 'ghi chú ba'));
    deps.notes.save(notes(5, 200, 'ghi chú năm'));
    const { container } = renderApp('/notes', deps);
    const items = container.querySelectorAll('article.notes-item');
    expect(items).toHaveLength(2);
    expect(items[0].id).toBe('note-5');
    expect(items[1].id).toBe('note-3');
    expect(items[0]).toHaveTextContent('Stem 5');
    expect(items[0]).toHaveTextContent('Option A of 5');
    expect(items[0]).toHaveTextContent('Option D of 5');
    expect(items[0]).toHaveTextContent('ghi chú năm');
    expect(items[0].querySelector('blockquote')).toHaveTextContent('Stem');
  });

  it('không lộ đáp án: không có opt--correct/opt--missed, nút lựa chọn bị khóa', () => {
    const deps = makeDeps();
    deps.notes.save(notes(1, 100));
    const { container } = renderApp('/notes', deps);
    expect(container.querySelector('.opt--correct, .opt--missed')).toBeNull();
    const opts = container.querySelectorAll<HTMLButtonElement>('.opt');
    expect(opts.length).toBe(4);
    opts.forEach((b) => expect(b).toBeDisabled());
  });

  it('ô tìm không dấu khớp ghi chú có dấu; không khớp thì ẩn mục', () => {
    const deps = makeDeps();
    deps.notes.save(notes(1, 100, 'ghi chú không dấu'));
    deps.notes.save(notes(2, 200, 'khác hẳn'));
    const { container } = renderApp('/notes', deps);
    fireEvent.change(screen.getByRole('searchbox', { name: 'Tìm ghi chú' }), { target: { value: 'ghi chu khong dau' } });
    const items = container.querySelectorAll('article.notes-item');
    expect(items).toHaveLength(1);
    expect(items[0].id).toBe('note-1');
    fireEvent.change(screen.getByRole('searchbox', { name: 'Tìm ghi chú' }), { target: { value: 'zzz' } });
    expect(container.querySelectorAll('article.notes-item')).toHaveLength(0);
  });

  it('đoạn không còn tìm thấy trong đề → báo rõ nhưng vẫn liệt kê', () => {
    const deps = makeDeps();
    deps.notes.save(notes(1, 100, 'vẫn còn', 'đoạn cũ không còn'));
    renderApp('/notes', deps);
    expect(screen.getByText('Không còn tìm thấy đoạn này trong đề')).toBeInTheDocument();
    expect(screen.getByText('vẫn còn')).toBeInTheDocument();
  });

  it('câu main có nhãn "Main N · Câu M"', () => {
    const deps = makeDeps({ bank: makeBank({ main: true }) });
    deps.notes.save({ qid: 10102, updatedAt: 5, highlights: [{ id: 'm', part: 'stem', start: 0, end: 4, text: 'Main', note: 'n', updatedAt: 5 }] });
    renderApp('/notes', deps);
    expect(screen.getByRole('heading', { name: 'Main 1 · Câu 2' })).toBeInTheDocument();
  });

  it('toast "Đến câu" từ việc ghi chú mở đúng popup', () => {
    const deps = makeDeps();
    deps.notes.save(notes(1, 100, 'nội dung cũ'));
    deps.aiGate.requestOpen({ page: 'notes', qid: 1, highlightId: 'h1' });
    renderApp('/notes', deps);
    expect(screen.getByRole('textbox', { name: 'Ghi chú' })).toHaveValue('nội dung cũ');
  });

  it('Layout có link "Ghi chú" tới /notes', () => {
    renderApp('/', makeDeps());
    expect(screen.getByRole('link', { name: 'Ghi chú' })).toHaveAttribute('href', '/notes');
  });

  it('cập nhật khi store đổi', () => {
    const deps = makeDeps();
    renderApp('/notes', deps);
    act(() => deps.notes.save(notes(1, 100, 'mới')));
    expect(screen.getByText('mới')).toBeInTheDocument();
  });
});
