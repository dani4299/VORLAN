import React, { Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { isAuthenticated } from './lib/api';
import { ToastProvider } from './context/ToastContext';
import { LoginPage } from './pages/auth/LoginPage';
import { SignupPage } from './pages/auth/SignupPage';
import { DashboardShell } from './components/layout/DashboardShell';

// The living style guide only exists in dev builds - it never ships to an installed copy.
const DesignSystemPage = import.meta.env.DEV ? React.lazy(() => import('./pages/design/DesignSystemPage')) : null;

const ProtectedRoute = ({ children }) => {
  if (!isAuthenticated()) return <Navigate to="/login" replace />;
  return children;
};

export default function App() {
  return (
    <ToastProvider>
      <Routes>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
        {DesignSystemPage && (
          <Route path="/design-system" element={<Suspense fallback={null}><DesignSystemPage /></Suspense>} />
        )}
        <Route path="/dashboard/*" element={
          <ProtectedRoute>
            <DashboardShell />
          </ProtectedRoute>
        } />
      </Routes>
    </ToastProvider>
  );
}
