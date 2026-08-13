import { Component, type ErrorInfo, type ReactNode } from "react";
import { Navigate, Outlet, Route, Routes, useLocation } from "react-router-dom";
import { AppShell } from "./components/AppShell";
import { LoadingState, useDocumentTitle } from "./components/ui";
import { useAuth } from "./context/AuthContext";
import { destinationForRole, type UserRole } from "./types";
import {
  AdminDashboardPage,
  AdminInvitationsPage,
  AdminStoreFormPage,
  AdminStoresPage,
  AdminUserDetailPage,
  AdminUserFormPage,
  AdminUsersPage,
} from "./pages/AdminPages";
import { PasswordPage } from "./pages/AccountPages";
import {
  LoginPage,
  PrivilegedInviteRegisterPage,
  RegisterPage,
  VerifyEmailPage,
} from "./pages/AuthPages";
import { OwnerDashboardPage } from "./pages/OwnerDashboardPage";
import { ForbiddenPage, NotFoundPage } from "./pages/StatusPages";
import { StoreDirectoryPage } from "./pages/StoreDirectoryPage";

class AppErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  state = { hasError: false };

  static getDerivedStateFromError(): { hasError: boolean } {
    return { hasError: true };
  }

  componentDidCatch(_error: Error, _info: ErrorInfo) {
    // Errors are intentionally contained so a recoverable UI failure does not white-screen the app.
  }

  render() {
    if (this.state.hasError) {
      return (
        <main className="status-page">
          <section className="status-card">
            <p className="status-card__code" aria-hidden="true">
              !
            </p>
            <h1>Something unexpected happened</h1>
            <p>
              Refresh the page to try again. If the problem continues, please contact an
              administrator.
            </p>
            <button
              type="button"
              className="button button--primary"
              onClick={() => window.location.reload()}
            >
              Refresh page
            </button>
          </section>
        </main>
      );
    }

    return this.props.children;
  }
}

function InitialLoading() {
  useDocumentTitle("Loading");
  return (
    <main className="bootstrap-loading">
      <LoadingState label="Preparing your workspace" />
    </main>
  );
}

function HomeRedirect() {
  const { user, isLoading } = useAuth();
  if (isLoading) {
    return <InitialLoading />;
  }
  return <Navigate to={user ? destinationForRole(user.role) : "/login"} replace />;
}

function PublicOnlyRoute() {
  const { user, isLoading } = useAuth();
  if (isLoading) {
    return <InitialLoading />;
  }
  return user ? <Navigate to={destinationForRole(user.role)} replace /> : <Outlet />;
}

function ProtectedRoute({ allowedRoles }: { allowedRoles?: UserRole[] }) {
  const { user, isLoading } = useAuth();
  const location = useLocation();
  if (isLoading) {
    return <InitialLoading />;
  }
  if (!user) {
    return (
      <Navigate to="/login" replace state={{ from: `${location.pathname}${location.search}` }} />
    );
  }
  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to="/forbidden" replace />;
  }
  return <Outlet />;
}

export default function App() {
  return (
    <AppErrorBoundary>
      <Routes>
        <Route path="/" element={<HomeRedirect />} />
        <Route element={<PublicOnlyRoute />}>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route
            path="/register/admin/:token"
            element={<PrivilegedInviteRegisterPage expectedRole="ADMIN" />}
          />
          <Route
            path="/register/store-owner/:token"
            element={<PrivilegedInviteRegisterPage expectedRole="STORE_OWNER" />}
          />
          <Route path="/verify-email" element={<VerifyEmailPage />} />
        </Route>
        <Route element={<ProtectedRoute />}>
          <Route element={<AppShell />}>
            <Route path="/password" element={<PasswordPage />} />
            <Route element={<ProtectedRoute allowedRoles={["NORMAL_USER"]} />}>
              <Route path="/stores" element={<StoreDirectoryPage />} />
            </Route>
            <Route element={<ProtectedRoute allowedRoles={["STORE_OWNER"]} />}>
              <Route path="/owner" element={<OwnerDashboardPage />} />
            </Route>
            <Route element={<ProtectedRoute allowedRoles={["ADMIN"]} />}>
              <Route path="/admin" element={<AdminDashboardPage />} />
              <Route path="/admin/invitations" element={<AdminInvitationsPage />} />
              <Route path="/admin/users" element={<AdminUsersPage />} />
              <Route path="/admin/users/new" element={<AdminUserFormPage />} />
              <Route path="/admin/users/:id" element={<AdminUserDetailPage />} />
              <Route path="/admin/stores" element={<AdminStoresPage />} />
              <Route path="/admin/stores/new" element={<AdminStoreFormPage />} />
            </Route>
          </Route>
        </Route>
        <Route path="/forbidden" element={<ForbiddenPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </AppErrorBoundary>
  );
}
