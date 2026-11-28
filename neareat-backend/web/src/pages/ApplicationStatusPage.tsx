import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { AuthLayout } from '../components/AuthLayout';
import { EmptyState } from '../components/Feedback';
import { Button } from '../components/Button';
import { useSessionStore } from '../store/sessionStore';

/** Başvuru durumu (mobil `RestaurantPendingScreen` karşılığı, V2). Onaylı hesap panele gider. */
export default function ApplicationStatusPage() {
  const restaurant = useSessionStore((s) => s.restaurant);
  const user = useSessionStore((s) => s.user);
  const logout = useSessionStore((s) => s.logout);
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);

  if (restaurant?.status === 'APPROVED') return <Navigate to="/" replace />;

  async function onLogout() {
    setBusy(true);
    try { await logout(); } catch {} finally { navigate('/giris', { replace: true }); }
  }

  const rejected = restaurant?.status === 'REJECTED';
  return (
    <AuthLayout title={rejected ? 'Başvuru Reddedildi' : 'Restoran başvurusu'} wide>
      <div style={{ padding: 'var(--space-4) 0' }}>
        {rejected ? (
          <EmptyState icon="x-circle" tone="danger" title="Başvurunuz reddedildi" action={<Button variant="secondary" loading={busy} onClick={onLogout}>Çıkış yap</Button>}>
            {restaurant?.rejectionReason
              ? <>Red nedeni: <strong>{restaurant.rejectionReason}</strong></>
              : 'Ayrıntı için info@eatlas.app adresine yazabilirsiniz.'}
          </EmptyState>
        ) : (
          <EmptyState icon="clock" tone="warning" title="Başvurunuz inceleniyor" action={<Button variant="secondary" loading={busy} onClick={onLogout}>Çıkış yap</Button>}>
            Genellikle 1 iş günü içinde sonuçlanır. Sonucu {user?.email ? <strong>{user.email}</strong> : 'e-posta adresinize'} e-postayla bildireceğiz.
          </EmptyState>
        )}
      </div>
    </AuthLayout>
  );
}
