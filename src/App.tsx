import './App.css';

import { lazy, Suspense } from 'react';
import { BrowserRouter, Navigate, Outlet, Route, Routes } from 'react-router-dom';

import { useAuth } from './features/authentication/hooks/useAuth';
import { AuthProvider } from './features/authentication/stores/AuthContext';
import { LedgerProvider } from './features/ledger/stores/LedgerContext';

// Route-level code splitting -- each page becomes its own chunk instead of
// all six being bundled into the initial load regardless of which one (if
// any) the visitor actually needs. Dashboard in particular pulls in the
// bulk of the app's ledger UI plus jszip (for the receipts-ZIP download),
// so splitting it out matters most.
const LoginPage = lazy(() =>
  import('./pages/LoginPage').then((m) => ({ default: m.LoginPage })),
);
const UploadDocumentPage = lazy(() =>
  import('./pages/UploadDocumentPage').then((m) => ({ default: m.UploadDocumentPage })),
);
const OrganizationsPage = lazy(() =>
  import('./pages/OrganizationsPage').then((m) => ({ default: m.OrganizationsPage })),
);
const CreateOrganization = lazy(() =>
  import('./pages/CreateOrganization').then((m) => ({ default: m.CreateOrganization })),
);
const Dashboard = lazy(() =>
  import('./pages/Dashboard').then((m) => ({ default: m.Dashboard })),
);
const AuditLogPage = lazy(() =>
  import('./pages/AuditLogPage').then((m) => ({ default: m.AuditLogPage })),
);

const ProtectedLayout = () => {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;
  return (
    <LedgerProvider>
      <Outlet />
    </LedgerProvider>
  );
};

const App = () => (
  <BrowserRouter>
    <AuthProvider>
      <Suspense fallback={null}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/upload-document" element={<UploadDocumentPage />} />
          {/* Old path, kept working for any request emails already sent before the rename */}
          <Route path="/upload-receipt" element={<UploadDocumentPage />} />
          <Route element={<ProtectedLayout />}>
            <Route path="/organizations" element={<OrganizationsPage />} />
            <Route path="/budget-setup" element={<CreateOrganization />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/audit-log" element={<AuditLogPage />} />
          </Route>
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </Suspense>
    </AuthProvider>
  </BrowserRouter>
);

export default App;
