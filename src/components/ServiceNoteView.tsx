import type { ServiceNote } from '../data/types';

/** Nội dung ghi chú một service: dùng cho trang /services/:id và popup mở từ chip service. */
export function ServiceNoteView({ note }: { note?: ServiceNote }) {
  return (
    <>
      {!note ? (
        <p className="guide__pending">Ghi chú chi tiết đang cập nhật.</p>
      ) : (
        <article className="service-note">
          <span className="tag">{note.tier === 'core' ? 'Core' : 'Minor'}</span>
          <p>{note.overview}</p>

          {note.concepts && (
            <section>
              <h2>Khái niệm chính</h2>
              <dl className="service-note__concepts">
                {note.concepts.map((concept) => (
                  <div key={concept.term}>
                    <dt>{concept.term}</dt>
                    <dd>{concept.desc}</dd>
                  </div>
                ))}
              </dl>
            </section>
          )}

          {note.howItWorks && (
            <section>
              <h2>Cách hoạt động</h2>
              <p>{note.howItWorks}</p>
            </section>
          )}

          {note.useCases && (
            <section>
              <h2>Khi nào dùng</h2>
              <ul>{note.useCases.map((item) => <li key={item}>{item}</li>)}</ul>
            </section>
          )}

          {note.pricing && (
            <section>
              <h2>Chi phí</h2>
              <p>{note.pricing}</p>
            </section>
          )}

          <section>
            <h2>Dấu hiệu trong đề thi</h2>
            <ul>{note.examSignals.map((item) => <li key={item}>{item}</li>)}</ul>
          </section>

          <section>
            <h2>So sánh với service khác</h2>
            <ul>
              {note.compareWith.map((item) => <li key={item.service}><strong>{item.service}:</strong> {item.diff}</li>)}
            </ul>
          </section>

          {note.facts && (
            <section>
              <h2>Điểm cần nhớ</h2>
              <ul>{note.facts.map((item) => <li key={item}>{item}</li>)}</ul>
            </section>
          )}

          {note.practice && (
            <section className="service-note__practice">
              <h2>Thực hành an toàn</h2>
              <ol>{note.practice.steps.map((step) => <li key={step}>{step}</li>)}</ol>
              <p><strong>Free Tier/chi phí:</strong> {note.practice.freeTier}</p>
              <h3>Dọn dẹp</h3>
              <ul>{note.practice.cleanup.map((step) => <li key={step}>{step}</li>)}</ul>
            </section>
          )}
        </article>
      )}
    </>
  );
}
