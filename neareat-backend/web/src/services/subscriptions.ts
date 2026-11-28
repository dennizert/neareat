import api from '../api/client';
import type { Subscription } from '../types';

/** `GET /api/subscriptions` — trial sayacı için (Faz 1'de ödeme yok, V7). Abonelik yoksa null. */
export async function getSubscription(): Promise<Subscription | null> {
  const { data } = await api.get('/subscriptions');
  return data ?? null;
}
