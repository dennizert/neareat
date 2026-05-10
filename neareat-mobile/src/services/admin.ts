import api from './api';
import type { AdminStats, AdminRestaurantSummary, AdminUserSummary, AppReview, UserReport } from '../types';

export async function adminLogin(email: string, password: string) {
  const { data } = await api.post('/admin/login', { email, password });
  return data as { token: string; user: { id: string; email: string; role: string; displayName: string } };
}

export async function seedAdmin(payload: { email: string; password: string; displayName: string }) {
  const { data } = await api.post('/admin/seed', payload);
  return data;
}

export async function getPlatformStats(): Promise<AdminStats> {
  const { data } = await api.get('/admin/stats');
  return data;
}

export async function getPendingRestaurants(status = 'PENDING', page = 1): Promise<{ profiles: AdminRestaurantSummary[]; total: number }> {
  const { data } = await api.get('/admin/restaurants', { params: { status, page } });
  return data;
}

export async function getRestaurantDetail(id: string): Promise<AdminRestaurantSummary & { hasTaxCertificate: boolean }> {
  const { data } = await api.get(`/admin/restaurants/${id}`);
  return data;
}

export async function getTaxCertificate(id: string): Promise<{ data: string }> {
  const { data } = await api.get(`/admin/restaurants/${id}/certificate`);
  return data;
}

export async function approveRestaurant(id: string): Promise<AdminRestaurantSummary> {
  const { data } = await api.post(`/admin/restaurants/${id}/approve`);
  return data;
}

export async function rejectRestaurant(id: string, rejectionReason: string): Promise<AdminRestaurantSummary> {
  const { data } = await api.post(`/admin/restaurants/${id}/reject`, { rejectionReason });
  return data;
}

export async function getUsers(search = '', page = 1, role = 'USER'): Promise<{ users: AdminUserSummary[]; total: number }> {
  const { data } = await api.get('/admin/users', { params: { search, page, role } });
  return data;
}

export async function suspendUser(id: string) {
  const { data } = await api.post(`/admin/users/${id}/suspend`);
  return data;
}

export async function unsuspendUser(id: string) {
  const { data } = await api.post(`/admin/users/${id}/unsuspend`);
  return data;
}

export async function getFlaggedReviews(): Promise<AppReview[]> {
  const { data } = await api.get('/admin/reviews');
  return data;
}

export async function adminDeleteReview(id: string): Promise<void> {
  await api.delete(`/admin/reviews/${id}`);
}

export async function getReports(status = 'PENDING', page = 1): Promise<{ reports: UserReport[]; total: number }> {
  const { data } = await api.get('/admin/reports', { params: { status, page } });
  return data;
}

export async function handleReport(
  id: string,
  action: 'suspend' | 'dismiss' | 'warn',
  actionNote?: string,
): Promise<void> {
  await api.put(`/admin/reports/${id}`, { action, actionNote });
}
