import { Link, Route, Routes } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { ExamPage } from '../pages/ExamPage';
import { ExternalListPage } from '../pages/ExternalListPage';
import { ExternalPracticePage } from '../pages/ExternalPracticePage';
import { HistoryPage } from '../pages/HistoryPage';
import { HomePage } from '../pages/HomePage';
import { QuestionViewPage } from '../pages/QuestionViewPage';
import { ResultPage } from '../pages/ResultPage';
import { ServiceDetailPage } from '../pages/ServiceDetailPage';
import { ServicesPage } from '../pages/ServicesPage';
import { SetStatsPage } from '../pages/SetStatsPage';

function NotFound() {
  return (
    <main className="page">
      <p>Không tìm thấy trang.</p>
      <Link to="/">Về trang chủ</Link>
    </main>
  );
}

export function AppRoutes() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<HomePage />} />
        <Route path="set/:id" element={<SetStatsPage />} />
        <Route path="history" element={<HistoryPage />} />
        <Route path="exam/:id" element={<ExamPage />} />
        <Route path="result/:id" element={<ResultPage />} />
        <Route path="q/:id" element={<QuestionViewPage />} />
        <Route path="services" element={<ServicesPage />} />
        <Route path="services/:id" element={<ServiceDetailPage />} />
        <Route path="external" element={<ExternalListPage />} />
        <Route path="external/:slug" element={<ExternalPracticePage />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}
