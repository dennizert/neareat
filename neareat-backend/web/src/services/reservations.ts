/**
 * Rezervasyon servisi — mobil `neareat-mobile/src/services/reservations.ts`'in restoran
 * tarafı fonksiyonlarının AYNASI (aynı adlar ve parametreler).
 */
import api from '../api/client';
import type { Reservation, ReservationMessage } from '../types';

export async function getReservationDetail(id: string): Promise<Reservation> {
  const { data } = await api.get(`/reservations/${id}`);
  return data;
}

export async function getRestaurantReservations(status?: string, date?: string): Promise<Reservation[]> {
  const params: Record<string, string> = {};
  if (status) params.status = status;
  if (date) params.date = date;
  const { data } = await api.get('/reservations/restaurant', { params });
  return data;
}

export async function updateReservationStatus(
  id: string,
  status: 'CONFIRMED' | 'REJECTED',
  rejectionReason?: string,
  reservedSeats?: number,
): Promise<Reservation> {
  const { data } = await api.put(`/reservations/${id}/status`, { status, rejectionReason, reservedSeats });
  return data;
}

export interface OccupancySlot { time: string; reserved: number; free: number | null; percent: number | null; band: string }
export interface OccupancyResponse { date: string; seatCapacity: number | null; slots: OccupancySlot[] }

export async function getOccupancy(date: string): Promise<OccupancyResponse> {
  const { data } = await api.get('/restaurant-account/occupancy', { params: { date } });
  return data;
}

export async function markAttendance(id: string, attended: boolean): Promise<Reservation> {
  const { data } = await api.put(`/reservations/${id}/attendance`, { attended });
  return data;
}

export async function sendReservationMessage(id: string, content: string): Promise<ReservationMessage> {
  const { data } = await api.post(`/reservations/${id}/messages`, { content });
  return data;
}

export async function getReservationMessages(id: string): Promise<ReservationMessage[]> {
  const { data } = await api.get(`/reservations/${id}/messages`);
  return data;
}
