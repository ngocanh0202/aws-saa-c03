import { fireEvent, screen } from '@testing-library/react';
import { makeDeps, renderApp } from '../test/fixtures';

describe('Service pages', () => {
  it('liệt kê service theo danh mục, có tìm kiếm', () => {
    renderApp('/services', makeDeps());
    expect(screen.getByRole('heading', { name: 'Storage' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Amazon S3' })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Tìm service'), { target: { value: 'dynamo' } });
    expect(screen.getByText('Không tìm thấy service nào.')).toBeInTheDocument();
  });

  it('trang chi tiết: trạng thái đang cập nhật và câu hỏi liên quan', () => {
    renderApp('/services/s3', makeDeps());
    expect(screen.getByRole('heading', { name: 'Amazon S3' })).toBeInTheDocument();
    expect(screen.getByText('Ghi chú chi tiết đang cập nhật.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('link', { name: 'Câu 1' }));
    expect(screen.getByRole('heading', { name: 'Câu 1' })).toBeInTheDocument();
    expect(screen.getByLabelText('Hướng dẫn')).toBeInTheDocument();
    expect(screen.getByText('Option A of 1').closest('button')).toHaveClass('opt--missed');
  });

  it('service hoặc câu không tồn tại', () => {
    renderApp('/services/khong-co', makeDeps());
    expect(screen.getByText(/Không có service/)).toBeInTheDocument();
  });
});
