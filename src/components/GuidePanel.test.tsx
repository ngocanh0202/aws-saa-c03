import { render, screen, fireEvent } from '@testing-library/react';
import type { QuestionVi } from '../data/types';
import { makeMainQuestion, makeQuestion } from '../test/fixtures';
import { GuidePanel } from './GuidePanel';

describe('GuidePanel', () => {
  it('hiện ghi chú dịch vụ đã đổi tên hoặc đã ngừng nhắc tới trong câu', () => {
    const q = { ...makeQuestion(1), stem: 'Ship data with AWS Snowball Edge to Amazon Elasticsearch Service.' };
    render(<GuidePanel question={q} order={['A', 'B', 'C', 'D']} services={new Map()} />);
    expect(screen.getByText('ℹ Cập nhật dịch vụ (kiểm tra 10/2026)')).toBeInTheDocument();
    expect(screen.getByText(/Đổi tên: Amazon Elasticsearch Service đã đổi tên thành Amazon OpenSearch Service/)).toBeInTheDocument();
    expect(screen.getByText(/Đã ngừng: AWS Snowball Edge chỉ còn cho khách hàng hiện hữu/)).toBeInTheDocument();
  });

  it('không hiện mục này khi câu không nhắc dịch vụ nào trong danh sách', () => {
    render(<GuidePanel question={makeQuestion(2)} order={['A', 'B', 'C', 'D']} services={new Map()} />);
    expect(screen.queryByText(/Cập nhật dịch vụ/)).not.toBeInTheDocument();
  });

  describe('tab VI/EN cho câu main', () => {
    const order = ['A', 'B', 'C', 'D'];
    const mainVi = (extra: Partial<QuestionVi> = {}): QuestionVi => ({
      id: 10101,
      stemVi: 'Đề bài tiếng Việt',
      promptVi: 'Giải pháp nào?',
      options: order.map((key) => ({ key, textVi: `Lựa chọn ${key}`, reason: `Lý do ${key}` })),
      explanationVi: 'Giải thích VI',
      keyHint: 'Gợi ý',
      ...extra,
    });
    const renderMain = (vi?: QuestionVi, o = order) =>
      render(<GuidePanel question={makeMainQuestion(10101)} order={o} vi={vi} services={new Map()} />);

    afterEach(() => {
      vi.restoreAllMocks();
      localStorage.clear();
    });

    it('câu main có bản dịch mặc định mở tab VI', () => {
      renderMain(mainVi());
      expect(screen.getByRole('tab', { name: 'VI' })).toHaveAttribute('aria-selected', 'true');
      expect(screen.getByText('Đề bài tiếng Việt')).toBeInTheDocument();
      expect(screen.queryByText(/Main explanation/)).not.toBeInTheDocument();
    });

    it('bấm EN hiện giải thích gốc HTML', () => {
      renderMain(mainVi());
      fireEvent.click(screen.getByRole('tab', { name: 'EN' }));
      expect(screen.getByText(/Main explanation/)).toBeInTheDocument();
      expect(screen.queryByText('Đề bài tiếng Việt')).not.toBeInTheDocument();
    });

    it('nhớ tab đã chọn', () => {
      const first = renderMain(mainVi());
      fireEvent.click(screen.getByRole('tab', { name: 'EN' }));
      first.unmount();
      renderMain(mainVi());
      expect(screen.getByRole('tab', { name: 'EN' })).toHaveAttribute('aria-selected', 'true');
      expect(localStorage.getItem('saa-c03:guide-lang')).toBe('en');
    });

    it('localStorage lỗi vẫn mở tab VI', () => {
      vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
        throw new Error('blocked');
      });
      renderMain(mainVi());
      expect(screen.getByRole('tab', { name: 'VI' })).toHaveAttribute('aria-selected', 'true');
    });

    it('cảnh báo review vẫn hiện ở tab EN', () => {
      renderMain(mainVi({ review: { reason: 'Nghi sai' } }));
      fireEvent.click(screen.getByRole('tab', { name: 'EN' }));
      expect(screen.getByText(/Nghi sai/)).toBeInTheDocument();
    });

    it('đoạn JSON trong stemVi hiển thị trong pre', () => {
      const { container } = renderMain(mainVi({ stemVi: 'Chính sách:\n\n{\n  "Effect": "Allow"\n}' }));
      expect(container.querySelector('pre')?.textContent).toContain('"Effect": "Allow"');
    });

    it('lý do theo thứ tự hiển thị', () => {
      renderMain(mainVi(), ['C', 'A', 'B', 'D']);
      expect(screen.getByText('C. Lựa chọn B — Đúng')).toBeInTheDocument();
    });

    it('câu main chưa có bản dịch không có tab', () => {
      renderMain(undefined);
      expect(screen.queryByRole('tab')).toBeNull();
      expect(screen.getByText(/Main explanation/)).toBeInTheDocument();
    });

    it('câu sub không có tab', () => {
      const vi1: QuestionVi = { ...mainVi(), id: 1 };
      render(<GuidePanel question={makeQuestion(1)} order={order} vi={vi1} services={new Map()} />);
      expect(screen.queryByRole('tab')).toBeNull();
    });
  });
});
