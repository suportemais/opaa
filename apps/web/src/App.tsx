import { Navigate, Route, Routes, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { AppShell } from './components/layout/AppShell';
import { AdminShell } from './components/layout/AdminShell';
import { LoginPage } from './pages/LoginPage';
import { OnboardingPage } from './pages/OnboardingPage';
import { DashboardPage } from './pages/DashboardPage';
import { RankingPage } from './pages/RankingPage';
import { UnitsPage } from './pages/UnitsPage';
import { SurveysPage } from './pages/SurveysPage';
import { FeedbacksPage } from './pages/FeedbacksPage';
import { FeedbackDetailPage } from './pages/FeedbackDetailPage';
import { PublicSurveyPage } from './pages/PublicSurveyPage';
import { CustomersPage } from './pages/CustomersPage';
import { CustomerDetailPage } from './pages/CustomerDetailPage';
import { KanbanPage } from './pages/KanbanPage';
import { CompanyPage } from './pages/CompanyPage';
import { UsersPage } from './pages/UsersPage';
import { EmployeesPage } from './pages/EmployeesPage';
import { DenunciasPage } from './pages/DenunciasPage';
import { DenunciaDetailPage } from './pages/DenunciaDetailPage';
import { PublicWhistleblowerPage } from './pages/PublicWhistleblowerPage';
import { ForgotPasswordPage } from './pages/ForgotPasswordPage';
import { ResetPasswordPage } from './pages/ResetPasswordPage';
import { AdminOverviewPage } from './pages/admin/AdminOverviewPage';
import { AdminAccountsPage } from './pages/admin/AdminAccountsPage';
import { AdminAccountDetailPage } from './pages/admin/AdminAccountDetailPage';
import { AdminPlansPage } from './pages/admin/AdminPlansPage';
import { AdminSubscriptionsPage } from './pages/admin/AdminSubscriptionsPage';
import { LandingPage } from './pages/LandingPage';
import { getAccessToken } from './lib/auth-store';
import { apiFetch } from './lib/api';
import { isPlatformOperator } from './lib/billing-access';
import { AdminEmptyState } from './components/admin/AdminEmptyState';

function RequireAuth(props: { children: React.ReactNode }) {
  const token = getAccessToken();
  if (!token) return <Navigate to="/login" replace />;
  return <>{props.children}</>;
}

function RequirePlatformAdmin(props: { children: React.ReactNode }) {
  const me = useQuery({
    queryKey: ['authMe'],
    queryFn: () => apiFetch<{ permissionCodes: string[]; roleCodes?: string[] }>('/auth/me'),
  });

  if (me.isLoading) {
    return <div className="flex h-full items-center justify-center text-sm text-slate-500">Carregando…</div>;
  }

  if (me.isError) {
    return (
      <div className="p-8">
        <AdminEmptyState
          title="Não foi possível validar o acesso"
          description="Faça login novamente ou tente recarregar."
          onRetry={() => void me.refetch()}
        />
      </div>
    );
  }

  if (!isPlatformOperator(me.data)) {
    return <Navigate to="/app" replace />;
  }

  return <>{props.children}</>;
}

function RedirectToOnboarding() {
  const [searchParams] = useSearchParams();
  const search = searchParams.toString();
  return <Navigate to={search ? `/onboarding?${search}` : '/onboarding'} replace />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/assinar" element={<RedirectToOnboarding />} />
      <Route path="/register" element={<RedirectToOnboarding />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/onboarding" element={<OnboardingPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route path="/public/:token" element={<PublicSurveyPage />} />
      <Route path="/canal-etico/:tenantSlug" element={<PublicWhistleblowerPage />} />
      <Route path="/whistleblower/:tenantSlug" element={<PublicWhistleblowerPage />} />

      <Route
        path="/admin"
        element={
          <RequireAuth>
            <RequirePlatformAdmin>
              <AdminShell />
            </RequirePlatformAdmin>
          </RequireAuth>
        }
      >
        <Route index element={<AdminOverviewPage />} />
        <Route path="contas" element={<AdminAccountsPage />} />
        <Route path="contas/:id" element={<AdminAccountDetailPage />} />
        <Route path="plans" element={<AdminPlansPage />} />
        <Route path="assinaturas" element={<AdminSubscriptionsPage />} />
      </Route>

      <Route
        path="/app"
        element={
          <RequireAuth>
            <AppShell />
          </RequireAuth>
        }
      >
        <Route index element={<DashboardPage />} />
        <Route path="ranking" element={<RankingPage />} />
        <Route path="company" element={<CompanyPage />} />
        <Route path="plans" element={<Navigate to="/admin/plans" replace />} />
        <Route path="units" element={<UnitsPage />} />
        <Route path="users" element={<UsersPage />} />
        <Route path="employees" element={<EmployeesPage />} />
        <Route path="surveys" element={<SurveysPage />} />
        <Route path="customers" element={<CustomersPage />} />
        <Route path="customers/:id" element={<CustomerDetailPage />} />
        <Route path="whistleblower" element={<DenunciasPage />} />
        <Route path="whistleblower/:id" element={<DenunciaDetailPage />} />
        <Route path="feedbacks" element={<FeedbacksPage />} />
        <Route path="feedbacks/kanban" element={<KanbanPage />} />
        <Route path="feedbacks/:id" element={<FeedbackDetailPage />} />
      </Route>

      <Route path="*" element={<Navigate to="/app" replace />} />
    </Routes>
  );
}
