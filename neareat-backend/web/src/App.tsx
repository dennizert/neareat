import { useEffect } from 'react';
import { Route, Routes } from 'react-router-dom';
import { AppShell } from './components/AppShell';
import { ToastRegion } from './components/Feedback';
import { PublicOnly, RequireApproved, RequireSession } from './routes/guards';
import { useSessionStore } from './store/sessionStore';
import LoginPage from './pages/LoginPage';
import ResetPasswordPage from './pages/ResetPasswordPage';
import RegisterPage from './pages/RegisterPage';
import ApplicationStatusPage from './pages/ApplicationStatusPage';
import OverviewPage from './pages/OverviewPage';
import ReservationsPage from './pages/ReservationsPage';
import ReservationDetailPage from './pages/ReservationDetailPage';
import OccupancyPage from './pages/OccupancyPage';
import NotificationsPage from './pages/NotificationsPage';
import InfoPage from './pages/InfoPage';
import HoursPage from './pages/HoursPage';
import MenuPage from './pages/MenuPage';
import PhotosPage from './pages/PhotosPage';
import ReviewsPage from './pages/ReviewsPage';
import DiscountPage from './pages/DiscountPage';
import CampaignPage from './pages/CampaignPage';
import AnalyticsPage from './pages/AnalyticsPage';
import NotFoundPage from './pages/NotFoundPage';

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/giris" element={<PublicOnly><LoginPage /></PublicOnly>} />
      <Route path="/kayit" element={<PublicOnly><RegisterPage /></PublicOnly>} />
      {/* Şifre sıfırlama oturumdan bağımsızdır (e-postadaki bağlantı oturum açıkken de açılabilir). */}
      <Route path="/sifre-sifirla" element={<ResetPasswordPage />} />
      <Route path="/basvuru-durumu" element={<RequireSession><ApplicationStatusPage /></RequireSession>} />
      <Route element={<RequireSession><RequireApproved><AppShell /></RequireApproved></RequireSession>}>
        <Route index element={<OverviewPage />} />
        <Route path="rezervasyonlar" element={<ReservationsPage />} />
        <Route path="rezervasyonlar/:id" element={<ReservationDetailPage />} />
        <Route path="doluluk" element={<OccupancyPage />} />
        <Route path="bildirimler" element={<NotificationsPage />} />
        <Route path="bilgiler" element={<InfoPage />} />
        <Route path="saatler" element={<HoursPage />} />
        <Route path="menu" element={<MenuPage />} />
        <Route path="fotograflar" element={<PhotosPage />} />
        <Route path="yorumlar" element={<ReviewsPage />} />
        <Route path="indirim" element={<DiscountPage />} />
        <Route path="kampanya" element={<CampaignPage />} />
        <Route path="analitik" element={<AnalyticsPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}

export default function App() {
  const bootstrap = useSessionStore((s) => s.bootstrap);
  useEffect(() => { bootstrap(); }, [bootstrap]);
  return (
    <>
      <AppRoutes />
      <ToastRegion />
    </>
  );
}
