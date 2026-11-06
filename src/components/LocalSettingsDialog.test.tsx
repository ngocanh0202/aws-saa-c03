import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { DEFAULT_LOCAL_SETTINGS } from '../ai/local-settings';
import { AppProvider } from '../app/context';
import { makeDeps } from '../test/fixtures';
import { LocalSettingsDialog } from './LocalSettingsDialog';

function setup(initial = DEFAULT_LOCAL_SETTINGS, onSave = vi.fn(async () => undefined)) {
  const onClose = vi.fn();
  render(
    <AppProvider deps={makeDeps()}>
      <LocalSettingsDialog initial={initial} onSave={onSave} onClose={onClose} />
    </AppProvider>,
  );
  return { onSave, onClose };
}

const field = (name: string) => screen.getByRole('textbox', { name });
const save = () => screen.getByRole('button', { name: 'Lưu' });

describe('LocalSettingsDialog', () => {
  it('hiện giá trị đang dùng; mỗi tham số có hướng dẫn', () => {
    setup({ ...DEFAULT_LOCAL_SETTINGS, temperature: 1.1, max_tokens: 512, stream: false });
    expect(screen.getByRole('dialog', { name: 'Cài đặt Hỏi AI' })).toBeInTheDocument();
    expect(field('temperature')).toHaveValue('1.1');
    expect(field('max_tokens')).toHaveValue('512');
    expect(screen.getByRole('checkbox', { name: 'stream' })).not.toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Tìm trên web' })).toBeChecked();
    expect(screen.getByText('top_k', { selector: '.settings__name' })).toHaveAccessibleDescription(/k chữ có khả năng cao nhất/);
  });

  it('số sai: báo lỗi ngay dưới ô và khóa nút Lưu', () => {
    setup();
    fireEvent.change(field('top_k'), { target: { value: '20.5' } });
    expect(screen.getByText('Phải là số nguyên từ 0 đến 1000.')).toBeInTheDocument();
    expect(field('top_k')).toHaveAttribute('aria-invalid', 'true');
    expect(save()).toBeDisabled();
    fireEvent.change(field('top_k'), { target: { value: '30' } });
    expect(save()).toBeEnabled();
  });

  it('Lưu gửi số đã kiểm tra (max_tokens trống = null) rồi đóng', async () => {
    const { onSave, onClose } = setup({ ...DEFAULT_LOCAL_SETTINGS, max_tokens: 100 });
    fireEvent.change(field('temperature'), { target: { value: '0,3' } });
    fireEvent.change(field('max_tokens'), { target: { value: '' } });
    fireEvent.click(screen.getByRole('checkbox', { name: 'Tìm trên web' }));
    fireEvent.click(save());
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(onSave).toHaveBeenCalledWith({ ...DEFAULT_LOCAL_SETTINGS, temperature: 0.3, max_tokens: null, webSearch: false });
  });

  it('Mặc định đưa mọi ô về giá trị ban đầu, chưa lưu', () => {
    const { onSave } = setup({ ...DEFAULT_LOCAL_SETTINGS, temperature: 1.9, stream: false, webSearch: false });
    fireEvent.change(field('min_p'), { target: { value: 'x' } });
    fireEvent.click(screen.getByRole('button', { name: 'Mặc định' }));
    expect(field('temperature')).toHaveValue('0.7');
    expect(field('min_p')).toHaveValue('0');
    expect(screen.getByRole('checkbox', { name: 'stream' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Tìm trên web' })).toBeChecked();
    expect(onSave).not.toHaveBeenCalled();
  });

  it('lưu lỗi: báo lỗi, giữ popup', async () => {
    const { onClose } = setup(DEFAULT_LOCAL_SETTINGS, vi.fn(async () => Promise.reject(new Error('denied'))));
    fireEvent.click(save());
    expect(await screen.findByRole('alert')).toHaveTextContent('Không lưu được cài đặt');
    expect(onClose).not.toHaveBeenCalled();
  });

  it('Hủy, ✕, Esc hay bấm ra ngoài thì đóng mà không lưu', () => {
    const { onSave, onClose } = setup();
    fireEvent.click(screen.getByRole('button', { name: 'Hủy' }));
    fireEvent.click(screen.getByRole('button', { name: 'Đóng cài đặt' }));
    fireEvent.keyDown(field('top_p'), { key: 'Escape' });
    fireEvent.mouseDown(screen.getByTestId('settings-backdrop'));
    expect(onClose).toHaveBeenCalledTimes(4);
    expect(onSave).not.toHaveBeenCalled();
  });
});
