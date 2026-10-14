import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/layout/Layout';
import Dashboard from './pages/Dashboard';
import Applications from './pages/Applications';
import Analytics from './pages/Analytics';
import Login from './pages/Login';
import { AuthProvider } from './context/AuthContext';
import { JobTrackProvider } from './context/JobTrackContext';
import { ProtectedRoute } from './components/auth/ProtectedRoute';

export default function App() {
  return (
    <AuthProvider>
      <JobTrackProvider>
        <BrowserRouter>
          <Routes>
            {/* Public Auth Route */}
            <Route path="/login" element={<Login />} />

            {/* Legacy auth route redirects to Google-only login */}
            <Route path="/signup" element={<Navigate to="/login" replace />} />
            <Route path="/forgot-password" element={<Navigate to="/login" replace />} />
            <Route path="/reset-password" element={<Navigate to="/login" replace />} />

            {/* Protected Workspace Routes */}
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <Layout />
                </ProtectedRoute>
              }
            >
              <Route index element={<Dashboard />} />
              <Route path="applications" element={<Applications />} />
              <Route path="analytics" element={<Analytics />} />
            </Route>

            {/* Catch-all redirect */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </JobTrackProvider>
    </AuthProvider>
  );
}
