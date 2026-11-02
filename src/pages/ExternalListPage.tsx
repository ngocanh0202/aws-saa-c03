import { Link } from 'react-router-dom';
import { useApp } from '../app/context';

export function externalHref(file: string): string {
  return `external/${file}`;
}

export function ExternalListPage() {
  const { bank } = useApp();
  return (
    <main className="page">
      <h1>External</h1>
      <p className="hint">
        Câu hỏi chép từ các file HTML trong thư mục <code>external/</code>. Đề và lựa chọn giữ nguyên tiếng Anh, hướng dẫn
        tiếng Việt dịch từ giải thích trong file gốc. Phần này chỉ để luyện tập, không tính vào thống kê đề thi.
      </p>
      {bank.externals.length === 0 && <p>Chưa có file nào.</p>}
      <ul className="ext-list">
        {bank.externals.map((book) => (
          <li key={book.slug} className="card">
            <h2>{book.title}</h2>
            <p className="hint">
              {book.file} · {book.questions.length} câu · {book.vi.size}/{book.questions.length} câu có hướng dẫn tiếng Việt
            </p>
            <div className="ext-list__actions">
              <Link className="btn-primary btn-link" to={`/external/${book.slug}`}>
                Luyện tập
              </Link>
              <a className="btn-link" href={externalHref(book.file)} target="_blank" rel="noreferrer">
                Mở file HTML gốc ↗
              </a>
            </div>
          </li>
        ))}
      </ul>
    </main>
  );
}
