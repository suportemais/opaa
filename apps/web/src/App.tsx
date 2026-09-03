import { Navigate, Route, Routes } from 'react-router-dom';
import { AppShell } from './components/layout/AppShell';
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
import { LandingPage } from './pages/LandingPage';
import { PlansAdminPage } from './pages/PlansAdminPage';
import { getAccessToken } from './lib/auth-store';

function RequireAuth(props: { children: React.ReactNode }) {
  const token = getAccessToken();
  if (!token) return <Navigate to="/login" replace />;
  return <>{props.children}</>;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/onboarding" element={<OnboardingPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route path="/public/:token" element={<PublicSurveyPage />} />
      <Route path="/canal-etico/:tenantSlug" element={<PublicWhistleblowerPage />} />
      <Route path="/whistleblower/:tenantSlug" element={<PublicWhistleblowerPage />} />

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
        <Route path="plans" element={<PlansAdminPage />} />
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
