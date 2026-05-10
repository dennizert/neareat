import api from './api';
import type { Collection, CollectionItem, SharedCollection } from '../types';

export async function getMyCollections(): Promise<Collection[]> {
  const { data } = await api.get('/collections');
  return data;
}

export async function getSharedWithMe(): Promise<SharedCollection[]> {
  const { data } = await api.get('/collections/shared-with-me');
  return data;
}

export async function getCollection(id: string): Promise<Collection> {
  const { data } = await api.get(`/collections/${id}`);
  return data;
}

export async function createCollection(params: {
  name: string;
  description?: string;
  isPublic?: boolean;
}): Promise<Collection> {
  const { data } = await api.post('/collections', params);
  return data;
}

export async function updateCollection(
  id: string,
  params: { name?: string; description?: string; isPublic?: boolean },
): Promise<Collection> {
  const { data } = await api.put(`/collections/${id}`, params);
  return data;
}

export async function deleteCollection(id: string): Promise<void> {
  await api.delete(`/collections/${id}`);
}

export async function addToCollection(
  collectionId: string,
  item: {
    placeId: string;
    placeName: string;
    placeAddress?: string | null;
    placePhotoUrl?: string | null;
    placeRating?: number | null;
    note?: string;
  },
): Promise<CollectionItem> {
  const { data } = await api.post(`/collections/${collectionId}/items`, item);
  return data;
}

export async function removeFromCollection(collectionId: string, placeId: string): Promise<void> {
  await api.delete(`/collections/${collectionId}/items/${placeId}`);
}

export async function shareCollection(collectionId: string, friendId: string): Promise<void> {
  await api.post(`/collections/${collectionId}/share/${friendId}`);
}

export async function unshareCollection(collectionId: string, friendId: string): Promise<void> {
  await api.delete(`/collections/${collectionId}/share/${friendId}`);
}
