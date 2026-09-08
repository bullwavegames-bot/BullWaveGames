import { Navigate, Route, Routes } from "react-router-dom";
import type { ReactNode } from "react";
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
import { useApp } from "./state/AppState";

function RequireUser({ children }: { children: ReactNode }) {
  const { user } = useApp();
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
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
        <Route path="/welcome" element={<WelcomePage />} />
        <Route path="/play" element={<ArcadeHomePage />} />
        <Route path="/play/:slug" element={<GameSessionPage />} />
        <Route path="/challenges" element={<ChallengesPage />} />
        <Route
          path="/collection"
          element={
            <RequireUser>
              <CollectionPage />
            </RequireUser>
          }
        />
        <Route
          path="/profile"
          element={
            <RequireUser>
              <ProfilePage />
            </RequireUser>
          }
        />
        <Route path="/membership/checkout" element={<CheckoutPage />} />
        <Route path="/membership/payment-return" element={<PaymentReturnPage />} />
        <Route path="/billing" element={<BillingPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/help" element={<HelpPage />} />
        <Route path="/help/:slug" element={<HelpArticlePage />} />
        <Route path="/admin" element={<AdminHome />} />
        <Route path="/admin/members" element={<AdminMembers />} />
        <Route path="/admin/members/:id" element={<AdminMemberDetail />} />
        <Route path="/admin/games" element={<AdminGames />} />
        <Route path="/admin/games/new" element={<AdminGameEdit />} />
        <Route path="/admin/games/:id" element={<AdminGameEdit />} />
        <Route path="/admin/content" element={<AdminContent />} />
        <Route path="/500" element={<ServerErrorPage />} />
        <Route path="/maintenance" element={<MaintenancePage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
