import { render, screen } from '@testing-library/react';
import { makeQuestion } from '../test/fixtures';
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
});
