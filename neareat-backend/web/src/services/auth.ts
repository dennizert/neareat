/** Şifre sıfırlama — mevcut uçlar (ADR-001 §2: web aynı `forgot/reset-password` uçlarını kullanır). */
import api from '../api/client';

export async function forgotPassword(email: string): Promise<{ message: string }> {
  const { data } = await api.post('/auth/forgot-password', { email });
  return data;
}

export async function resetPassword(token: string, password: string): Promise<{ message: string }> {
  const { data } = await api.post('/auth/reset-password', { token, password });
  return data;
}
