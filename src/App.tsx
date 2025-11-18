import { Routes, Route, Navigate } from 'react-router-dom';
import LoginPage from './pages/LoginPage';
import { RequireAuth } from './auth/RequireAuth';
import HomePage from './pages/HomePage';
import CompanyLayoutPage from './pages/company/CompanyLayoutPage';
import LibraryPage from './pages/company/LibraryPage';
import PublisherPage from './pages/company/PublisherPage';
import QualityPage from './pages/company/QualityPage';
import AdminPage from './pages/company/AdminPage';
import QualityPublishedPage from './pages/company/QualityPublishedPage';
import DocumentTypesPage from './pages/company/DocumentTypesPage';
import QualityArchivedPage from './pages/company/QualityArchivedPage';
import ProfilePage from './pages/company/ProfilePage';

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      <Route
        path="/"
        element={
          <RequireAuth>
            <HomePage />
          </RequireAuth>
        }
      />

      <Route
        path="/company/:slug"
        element={
          <RequireAuth>
            <CompanyLayoutPage />
          </RequireAuth>
        }
      >
        {/* index continua redirecionando pra library, como já estava */}
        <Route index element={<Navigate to="library" replace />} />
        <Route path="profile" element={<ProfilePage />} />
        <Route path="library" element={<LibraryPage />} />
        <Route path="publisher" element={<PublisherPage />} />
        <Route path="quality" element={<QualityPage />} />
        <Route path="quality-published" element={<QualityPublishedPage />} />
        <Route path="quality-archived" element={<QualityArchivedPage />} />
        <Route path="doc-types" element={<DocumentTypesPage />} />
        <Route path="admin" element={<AdminPage />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
