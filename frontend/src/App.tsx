import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { useAuthStore } from './store/authStore';
import LoginPage from './components/auth/LoginPage';
import ProtectedRoute from './components/auth/ProtectedRoute';
import Layout from './components/shared/Layout';
import DashboardPage from './pages/DashboardPage';
import ProgramsPage from './pages/ProgramsPage';
import ProjectsPage from './pages/ProjectsPage';
import ProjectDetailPage from './pages/ProjectDetailPage';
import TeamPage from './pages/TeamPage';
import SchedulePage from './pages/SchedulePage';
import UsersPage from './pages/UsersPage';
import AiConfigPage from './pages/AiConfigPage';
import AdminSettingsPage from './pages/AdminSettingsPage';
import OAuthCallbackPage from './pages/OAuthCallbackPage';

export default function App() {
  const { isAuthenticated } = useAuthStore();

  return (
    <BrowserRouter>
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 3000,
          style: { background: '#1e3a5f', color: '#fff', fontSize: '14px' },
          success: { iconTheme: { primary: '#22c55e', secondary: '#fff' } },
          error: { iconTheme: { primary: '#ef4444', secondary: '#fff' } },
        }}
      />
      <Routes>
        {/* Public: login is the entry point */}
        <Route path="/" element={isAuthenticated ? <Navigate to="/dashboard" replace /> : <LoginPage />} />
        <Route path="/login" element={isAuthenticated ? <Navigate to="/dashboard" replace /> : <LoginPage />} />
        <Route path="/auth/callback" element={<OAuthCallbackPage />} />

        {/* Protected app */}
        <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/programs" element={<ProgramsPage />} />
          <Route path="/projects" element={<ProjectsPage />} />
          <Route path="/projects/:id" element={<ProjectDetailPage />} />
          <Route path="/schedule" element={<SchedulePage />} />
          <Route path="/team" element={<TeamPage />} />
          <Route path="/users" element={<ProtectedRoute roles={['admin']}><UsersPage /></ProtectedRoute>} />
          <Route path="/ai-config" element={<ProtectedRoute roles={['admin']}><AiConfigPage /></ProtectedRoute>} />
          <Route path="/admin/settings" element={<ProtectedRoute roles={['admin']}><AdminSettingsPage /></ProtectedRoute>} />
        </Route>
        <Route path="*" element={<Navigate to={isAuthenticated ? '/dashboard' : '/'} replace />} />
      </Routes>
    </BrowserRouter>
  );
}
