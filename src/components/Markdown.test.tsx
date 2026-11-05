import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Markdown } from './Markdown';

describe('Markdown', () => {
  it('in đậm', () => {
    const { container } = render(<Markdown text="Dùng **S3** nhé" />);
    expect(container.querySelector('strong')?.textContent).toBe('S3');
  });

  it('ký hiệu LaTeX thường gặp thành ký tự', () => {
    const { container } = render(<Markdown text={String.raw`S3 $\rightarrow$ Glacier, $\le$ 5 GB, $x \times 2$`} />);
    expect(container.textContent).toBe('S3 → Glacier, ≤ 5 GB, x × 2');
  });

  it('LaTeX trong **đậm** cũng chuyển', () => {
    const { container } = render(<Markdown text={String.raw`**A $\Rightarrow$ B**`} />);
    expect(container.querySelector('strong')?.textContent).toBe('A ⇒ B');
  });

  it('không đụng tới số tiền có dấu $ hay lệnh lạ', () => {
    const raw = String.raw`Giá $5 và $10, $\frac{a}{b}$`;
    const { container } = render(<Markdown text={raw} />);
    expect(container.textContent).toBe(raw);
  });

  it('không chuyển trong code', () => {
    const { container } = render(<Markdown text={String.raw`${'`'}$\rightarrow$${'`'}`} />);
    expect(container.querySelector('code')?.textContent).toBe(String.raw`$\rightarrow$`);
  });

  it('danh sách', () => {
    const { container } = render(<Markdown text={'- a\n- b'} />);
    expect(container.querySelectorAll('ul li')).toHaveLength(2);
  });

  it('danh sách số', () => {
    const { container } = render(<Markdown text={'1. x\n2. y'} />);
    expect(container.querySelectorAll('ol li')).toHaveLength(2);
  });

  it('khối code', () => {
    const { container } = render(<Markdown text={'```json\n{"a": 1}\n```'} />);
    const pre = container.querySelector('pre');
    expect(pre?.textContent).toBe('{"a": 1}');
    expect(pre?.querySelector('code')).not.toBeNull();
  });

  it('không render HTML', () => {
    const { container } = render(<Markdown text="<img src=x onerror=alert(1)>" />);
    expect(container.querySelector('img')).toBeNull();
    expect(screen.getByText('<img src=x onerror=alert(1)>')).toBeTruthy();
  });

  it('chữ đang stream dở', () => {
    const { container } = render(<Markdown text="**abc" />);
    expect(container.textContent).toBe('**abc');
    const open = render(<Markdown text={'```\nfoo'} />);
    expect(open.container.querySelector('pre')?.textContent).toBe('foo');
  });

  describe('bảng', () => {
    const rows = (container: HTMLElement) =>
      [...container.querySelectorAll('tr')].map((tr) => [...tr.querySelectorAll('th,td')].map((c) => c.textContent));

    it('bảng Markdown thành <table>, ô có **đậm** và `code`', () => {
      const text = [
        'So sánh:',
        '| | EFS | EBS |',
        '|---|:---:|---|',
        '| Loại | **File system** (NFS) | Block storage |',
        '| Truy cập | `mount -t nfs4` | `/dev/xvda` |',
        '',
        'Hết.',
      ].join('\n');
      const { container } = render(<Markdown text={text} />);
      expect(rows(container)).toEqual([
        ['', 'EFS', 'EBS'],
        ['Loại', 'File system (NFS)', 'Block storage'],
        ['Truy cập', 'mount -t nfs4', '/dev/xvda'],
      ]);
      expect(container.querySelectorAll('thead th')).toHaveLength(3);
      expect(container.querySelector('td strong')?.textContent).toBe('File system');
      expect(container.querySelector('td code')?.textContent).toBe('mount -t nfs4');
      expect(container.querySelector('p')?.textContent).toBe('So sánh:');
      expect(container.querySelectorAll('p')[1]?.textContent).toBe('Hết.');
    });

    it('bảng bị dồn trên một dòng: tách hàng theo số cột của dòng phân cách', () => {
      const text =
        '| | EFS | EBS | S3 | |---|---|---|---| | Loại | File system (NFS) | Block storage | Object storage | | Scale | Tự động | Phải chọn size trước | Gần như vô hạn |';
      const { container } = render(<Markdown text={text} />);
      expect(rows(container)).toEqual([
        ['', 'EFS', 'EBS', 'S3'],
        ['Loại', 'File system (NFS)', 'Block storage', 'Object storage'],
        ['Scale', 'Tự động', 'Phải chọn size trước', 'Gần như vô hạn'],
      ]);
    });

    it('hàng thiếu ô thì thêm ô trống, thừa thì bỏ; dòng có | nhưng không có dòng phân cách vẫn là chữ', () => {
      const { container } = render(<Markdown text={'| a | b |\n|---|---|\n| 1 |\n| 2 | 3 | 4 |'} />);
      expect(rows(container)).toEqual([['a', 'b'], ['1', ''], ['2', '3']]);
      const plain = render(<Markdown text="Chọn A | B tùy trường hợp" />).container;
      expect(plain.querySelector('table')).toBeNull();
    });

    it('đang stream mới có dòng tiêu đề (chưa có dòng phân cách): hiện như chữ, chưa dựng bảng', () => {
      const { container } = render(<Markdown text="| | EFS | EBS |" />);
      expect(container.querySelector('table')).toBeNull();
      expect(container.textContent).toContain('EFS');
    });
  });
});
