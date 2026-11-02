import { render, screen } from '@testing-library/react';
import { makeQuestion } from '../test/fixtures';
import { QuestionCard } from './QuestionCard';

describe('QuestionCard', () => {
  const q = makeQuestion(9, ['A', 'B', 'C', 'D', 'E'], ['A', 'C']);

  it('đánh nhãn theo thứ tự đã xáo, không lộ nhãn gốc khi không yêu cầu', () => {
    render(<QuestionCard question={q} order={['C', 'A', 'B', 'D', 'E']} selected={[]} reveal={false} />);
    expect(screen.getByText('Option C of 9').closest('button')).toHaveTextContent(/^A\./);
    expect(screen.queryByText(/gốc:/)).not.toBeInTheDocument();
  });

  it('khi mở đáp án: chọn đúng xanh, chọn sai đỏ, bỏ sót viền xanh', () => {
    render(<QuestionCard question={q} order={['A', 'B', 'C', 'D', 'E']} selected={['A', 'B']} reveal />);
    expect(screen.getByText('Option A of 9').closest('button')).toHaveClass('opt--correct-chosen');
    expect(screen.getByText('Option B of 9').closest('button')).toHaveClass('opt--wrong-chosen');
    expect(screen.getByText('Option C of 9').closest('button')).toHaveClass('opt--missed');
    expect(screen.getByText('Đáp án đúng')).toBeInTheDocument();
  });

  it('câu nhiều đáp án dùng role checkbox', () => {
    render(<QuestionCard question={q} order={['A', 'B', 'C', 'D', 'E']} selected={['B']} reveal={false} onSelect={() => {}} />);
    expect(screen.getAllByRole('checkbox')).toHaveLength(5);
    expect(screen.getByRole('checkbox', { checked: true })).toHaveTextContent('Option B of 9');
  });
});
