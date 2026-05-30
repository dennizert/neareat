/**
 * Koleksiyon Servisi
 *
 * Kullanıcının restoran koleksiyonlarını (tematik listeler) yönetir.
 * CRUD işlemleri, koleksiyona restoran ekleme/çıkarma ve arkadaşlarla paylaşma
 * fonksiyonlarını içerir.
 */
import api from './api';
import type { Collection, CollectionItem, SharedCollection } from '../types';

/**
 * Kullanıcının kendi koleksiyonlarını getirir.
 * @returns Koleksiyon listesi
 */
export async function getMyCollections(): Promise<Collection[]> {
  const { data } = await api.get('/collections');
  return data;
}

/**
 * Arkadaşlar tarafından kullanıcıyla paylaşılan koleksiyonları getirir.
 * @returns Paylaşılan koleksiyon listesi
 */
export async function getSharedWithMe(): Promise<SharedCollection[]> {
  const { data } = await api.get('/collections/shared-with-me');
  return data;
}

/**
 * Belirli bir koleksiyonun detayını (öğeler dahil) getirir.
 * @param id - Koleksiyon ID'si
 * @returns Koleksiyon detayı ve içindeki restoranlar
 */
export type CollectionSortBy = 'addedAt_desc' | 'addedAt_asc' | 'rating';

export async function getCollection(id: string, sortBy?: CollectionSortBy): Promise<Collection> {
  const { data } = await api.get(`/collections/${id}`, sortBy ? { params: { sortBy } } : undefined);
  return data;
}

/**
 * Yeni koleksiyon oluşturur.
 * @param params - Koleksiyon adı, açıklaması ve gizlilik ayarı
 * @returns Oluşturulan koleksiyon
 */
export async function createCollection(params: {
  name: string;
  description?: string;
  isPublic?: boolean;
}): Promise<Collection> {
  const { data } = await api.post('/collections', params);
  return data;
}

/**
 * Mevcut koleksiyonu günceller (isim, açıklama veya gizlilik).
 * @param id - Güncellenecek koleksiyonun ID'si
 * @param params - Güncellenecek alanlar
 * @returns Güncellenmiş koleksiyon
 */
export async function updateCollection(
  id: string,
  params: { name?: string; description?: string; isPublic?: boolean },
): Promise<Collection> {
  const { data } = await api.put(`/collections/${id}`, params);
  return data;
}

/**
 * Koleksiyonu siler. İçindeki tüm öğeler de silinir.
 * @param id - Silinecek koleksiyonun ID'si
 */
export async function deleteCollection(id: string): Promise<void> {
  await api.delete(`/collections/${id}`);
}

/**
 * Koleksiyona restoran ekler.
 * Restoran detay ekranından "Koleksiyona Ekle" butonuyla kullanılır.
 *
 * @param collectionId - Hedef koleksiyon ID'si
 * @param item - Eklenecek restoran bilgileri (placeId, isim, adres, fotoğraf, puan, not)
 * @returns Oluşturulan koleksiyon öğesi
 */
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

/**
 * Koleksiyondan restoran çıkarır.
 * @param collectionId - Koleksiyon ID'si
 * @param placeId - Çıkarılacak restoranın Google Places ID'si
 */
export async function removeFromCollection(collectionId: string, placeId: string): Promise<void> {
  await api.delete(`/collections/${collectionId}/items/${placeId}`);
}

/**
 * Koleksiyonu bir arkadaşla paylaşır.
 * Paylaşılan koleksiyon arkadaşın "Benimle Paylaşılanlar" listesinde görünür.
 *
 * @param collectionId - Paylaşılacak koleksiyon ID'si
 * @param friendId - Paylaşılacak arkadaşın kullanıcı ID'si
 */
export async function shareCollection(collectionId: string, friendId: string): Promise<void> {
  await api.post(`/collections/${collectionId}/share/${friendId}`);
}

/**
 * Koleksiyon paylaşımını iptal eder.
 * @param collectionId - Koleksiyon ID'si
 * @param friendId - Paylaşımı iptal edilecek arkadaşın ID'si
 */
export async function unshareCollection(collectionId: string, friendId: string): Promise<void> {
  await api.delete(`/collections/${collectionId}/share/${friendId}`);
}
