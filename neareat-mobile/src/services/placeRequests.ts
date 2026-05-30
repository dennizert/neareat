import api from './api';

export interface PlaceRequestPayload {
  placeId: string;
  placeName: string;
  placeAddress?: string;
  note?: string;
}

export interface PlaceRequest {
  id: string;
  placeId: string;
  placeName: string;
  placeAddress: string | null;
  note: string | null;
  status: 'PENDING' | 'REVIEWED';
  createdAt: string;
}

export async function submitPlaceRequest(payload: PlaceRequestPayload): Promise<PlaceRequest> {
  const { data } = await api.post('/place-requests', payload);
  return data;
}

export async function getMyPlaceRequests(): Promise<PlaceRequest[]> {
  const { data } = await api.get('/place-requests/my');
  return data;
}
