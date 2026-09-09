import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { useEffect, type ReactNode } from "react";
import { AppShell } from "./components/Layout";
import { LandingPage } from "./pages/Landing";
import { CatalogPage } from "./pages/Catalog";
import { GameDetailPage } from "./pages/GameDetail";
import { MembershipPage } from "./pages/Membership";
import { ContactPage, StoriesPage, StoryDetailPage } from "./pages/StoriesContact";
import { MaintenancePage, NotFoundPage, PrivacyPage, RefundPage, ServerErrorPage, ShippingPage, TermsPage } from "./pages/Policies";
import { ForgotPage, LoginPage, RegisterPage, ResetPage, VerifyPage, WelcomePage } from "./pages/Auth";
import { ArcadeHomePage, ChallengesPage, CollectionPage, ProfilePage } from "./pages/Arcade";
import { GameSessionPage } from "./pages/GameSession";
import { CheckoutPage, PaymentReturnPage } from "./pages/Checkout";
import { BillingPage, HelpArticlePage, HelpPage, SettingsPage } from "./pages/Account";
import {
  AdminContent,
  AdminGameEdit,
  AdminGames,
  AdminHome,
  AdminMemberDetail,
  AdminMembers,
} from "./pages/Admin";
import { useAuth } from "./state/AuthContext";

function LoadingScreen() {
  return (
    <div className="section wrap">
      <p>Loading…</p>
    </div>
  );
}

function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading, session } = useAuth();
  const location = useLocation();
  if (loading) return <LoadingScreen />;
  if (!session || !user) {
    return <Navigate to={`/login?return=${encodeURIComponent(location.pathname + location.search)}`} replace />;
  }
  if (!user.emailVerified) return <Navigate to="/verify-email" replace />;
  return <>{children}</>;
}

function RequireOnboarded({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <LoadingScreen />;
  return (
    <RequireAuth>
      {user && !user.onboardingComplete ? <Navigate to="/welcome" replace /> : children}
    </RequireAuth>
  );
}

function RequireAdmin({ children }: { children: ReactNode }) {
  const { user, loading, refreshProfile } = useAuth();
  useEffect(() => {
    void refreshProfile();
  }, [refreshProfile]);
  if (loading) return <LoadingScreen />;
  return (
    <RequireOnboarded>
      {user?.role !== "admin" ? (
        <div className="section wrap">
          <h1 className="display">Access denied</h1>
          <p>Operations tools are limited to authorized studio roles.</p>
        </div>
      ) : (
        children
      )}
    </RequireOnboarded>
  );
}

export default function App() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route path="/" element={<LandingPage />} />
        <Route path="/games" element={<CatalogPage />} />
        <Route path="/games/:slug" element={<GameDetailPage />} />
        <Route path="/membership" element={<MembershipPage />} />
        <Route path="/stories" element={<StoriesPage />} />
        <Route path="/stories/:slug" element={<StoryDetailPage />} />
        <Route path="/contact" element={<ContactPage />} />
        <Route path="/terms-and-conditions" element={<TermsPage />} />
        <Route path="/privacy-policy" element={<PrivacyPage />} />
        <Route path="/refund-and-cancellation-policy" element={<RefundPage />} />
        <Route path="/shipping-and-delivery-policy" element={<ShippingPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/forgot-password" element={<ForgotPage />} />
        <Route path="/reset-password" element={<ResetPage />} />
        <Route path="/verify-email" element={<VerifyPage />} />
        <Route
          path="/welcome"
          element={
            <RequireAuth>
              <WelcomePage />
            </RequireAuth>
          }
        />
        <Route
          path="/play"
          element={
            <RequireOnboarded>
              <ArcadeHomePage />
            </RequireOnboarded>
          }
        />
        <Route
          path="/play/:slug"
          element={
            <RequireOnboarded>
              <GameSessionPage />
            </RequireOnboarded>
          }
        />
        <Route path="/challenges" element={<ChallengesPage />} />
        <Route
          path="/collection"
          element={
            <RequireOnboarded>
              <CollectionPage />
            </RequireOnboarded>
          }
        />
        <Route
          path="/profile"
          element={
            <RequireOnboarded>
              <ProfilePage />
            </RequireOnboarded>
          }
        />
        <Route
          path="/membership/checkout"
          element={
            <RequireOnboarded>
              <CheckoutPage />
            </RequireOnboarded>
          }
        />
        <Route path="/membership/payment-return" element={<PaymentReturnPage />} />
        <Route
          path="/billing"
          element={
            <RequireOnboarded>
              <BillingPage />
            </RequireOnboarded>
          }
        />
        <Route
          path="/settings"
          element={
            <RequireOnboarded>
              <SettingsPage />
            </RequireOnboarded>
          }
        />
        <Route path="/help" element={<HelpPage />} />
        <Route path="/help/:slug" element={<HelpArticlePage />} />
        <Route path="/admin" element={<RequireAdmin><AdminHome /></RequireAdmin>} />
        <Route path="/admin/members" element={<RequireAdmin><AdminMembers /></RequireAdmin>} />
        <Route path="/admin/members/:id" element={<RequireAdmin><AdminMemberDetail /></RequireAdmin>} />
        <Route path="/admin/games" element={<RequireAdmin><AdminGames /></RequireAdmin>} />
        <Route path="/admin/games/new" element={<RequireAdmin><AdminGameEdit /></RequireAdmin>} />
        <Route path="/admin/games/:id" element={<RequireAdmin><AdminGameEdit /></RequireAdmin>} />
        <Route path="/admin/content" element={<RequireAdmin><AdminContent /></RequireAdmin>} />
        <Route path="/500" element={<ServerErrorPage />} />
        <Route path="/maintenance" element={<MaintenancePage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
