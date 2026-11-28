import { useCallback, useEffect, useRef, useState } from 'react';
import { PageHeader } from '../components/AuthLayout';
import { Button } from '../components/Button';
import { Icon } from '../components/Icon';
import { Alert, EmptyState, ErrorState, SkeletonBlock } from '../components/Feedback';
import { ConfirmDialog } from '../components/Dialog';
import {
  addRestaurantPhoto, deleteRestaurantPhoto, getPhotoUploadUrl, listRestaurantPhotos,
  PhotoStorageUnavailableError, PhotoUploadRejectedError, uploadPhotoToS3,
} from '../services/restaurantAccount';
import { getErrorMessage, isSubscriptionRequired } from '../api/client';
import { toast } from '../store/toastStore';
import { PHOTO_RULE, validateFile } from '../utils/validation';
import type { RestaurantPhoto, RestaurantPhotoKind } from '../types';

export const PHOTOS_PER_GALLERY = 8;

/**
 * S2 varsayımı: canlı depoda web origin'ine CORS kuralı uygulanana kadar yükleme kapalı ve
 * "yakında" durumu gösterilir. Kural uygulanınca build'de `VITE_PHOTO_UPLOAD_ENABLED=true`.
 * (Örnek kural: `web/deploy/s3-cors.example.json`.) Listeleme ve silme her zaman açık.
 */
export const PHOTO_UPLOAD_ENABLED = import.meta.env.VITE_PHOTO_UPLOAD_ENABLED === 'true';
export const STORAGE_SOON = 'Fotoğraf yükleme yakında aktifleşecek.';

/**
 * Foto yükleme 3 adımda: yükleme URL'si al → dosyayı depoya PUT → kaydet. Kayıt yalnızca
 * depo yüklemesi başarılıysa oluşturulur (yarıda kalan yüklemede galeri tutarlı kalır).
 * S2 varsayımı: canlı depoda web origin'i için CORS yoksa PUT reddedilir → anlaşılır hata.
 */
export async function uploadGalleryPhoto(kind: RestaurantPhotoKind, file: File): Promise<RestaurantPhoto> {
  const { uploadUrl, publicUrl } = await getPhotoUploadUrl(kind, file.type);
  await uploadPhotoToS3(uploadUrl, file, file.type);
  return addRestaurantPhoto(kind, publicUrl);
}

function Gallery({ kind, title, hint, photos, onAdded, onDelete, storageOff, uploadDisabled }: {
  kind: RestaurantPhotoKind; title: string; hint: string; photos: RestaurantPhoto[];
  onAdded: (p: RestaurantPhoto) => void; onDelete: (p: RestaurantPhoto) => void; storageOff: (msg: string) => void;
  uploadDisabled: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [locked, setLocked] = useState(false);
  const full = photos.length >= PHOTOS_PER_GALLERY;
  const id = `file-${kind}`;

  async function onFile(file: File | undefined) {
    if (inputRef.current) inputRef.current.value = '';
    if (!file || busy) return;
    const v = validateFile(file, PHOTO_RULE);
    setError(v);
    if (v) return;
    setBusy(true);
    try {
      onAdded(await uploadGalleryPhoto(kind, file));
      toast('Fotoğraf eklendi.', 'success');
    } catch (err) {
      if (err instanceof PhotoStorageUnavailableError) { storageOff(err.message); return; }
      if (err instanceof PhotoUploadRejectedError) { setError(err.message); return; }
      if (isSubscriptionRequired(err)) { setLocked(true); setError(getErrorMessage(err)); return; }
      setError(getErrorMessage(err, 'Fotoğraf yüklenemedi.'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card" aria-labelledby={`${id}-t`}>
      <div className="card-header">
        <div>
          <h2 className="card-title" id={`${id}-t`}>{title}</h2>
          <p className="subtle">{hint} · {photos.length}/{PHOTOS_PER_GALLERY}</p>
        </div>
        <input ref={inputRef} className="sr-only" id={id} type="file" accept={PHOTO_RULE.types.join(',')} onChange={(e) => onFile(e.target.files?.[0])} disabled={full || busy || locked || uploadDisabled} />
        <Button variant="secondary" icon="upload" loading={busy} disabled={full || locked || uploadDisabled} onClick={() => inputRef.current?.click()}>Fotoğraf ekle</Button>
      </div>
      {full && <Alert tone="warning">Bir galeride en fazla {PHOTOS_PER_GALLERY} fotoğraf olabilir.</Alert>}
      {error && <div style={{ marginTop: 'var(--space-3)' }}><Alert tone="danger" icon={locked ? 'lock' : undefined}>{error}</Alert></div>}
      {photos.length === 0 ? (
        <p className="subtle" style={{ marginTop: 'var(--space-3)' }}>Henüz fotoğraf yok.</p>
      ) : (
        <ul className="thumb-grid" role="list" style={{ listStyle: 'none', margin: 'var(--space-3) 0 0', padding: 0 }}>
          {photos.map((p, i) => (
            <li key={p.id} className="thumb">
              <img src={p.url} alt={`${title} ${i + 1}`} loading="lazy" />
              <div className="thumb-foot">
                <span className="subtle">#{i + 1}</span>
                <Button size="sm" variant="ghost" iconOnly aria-label={`${title} ${i + 1} fotoğrafını sil`} onClick={() => onDelete(p)}><Icon name="trash" /></Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export default function PhotosPage() {
  const [photos, setPhotos] = useState<RestaurantPhoto[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [storageMsg, setStorageMsg] = useState<string | null>(PHOTO_UPLOAD_ENABLED ? null : STORAGE_SOON);
  const [toDelete, setToDelete] = useState<RestaurantPhoto | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      setPhotos(await listRestaurantPhotos());
    } catch (err) {
      setLoadError(getErrorMessage(err, 'Fotoğraflar yüklenemedi.'));
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  async function confirmDelete() {
    if (!toDelete) return;
    setDeleting(true);
    try {
      await deleteRestaurantPhoto(toDelete.id);
      setPhotos((prev) => prev.filter((p) => p.id !== toDelete.id));
      toast('Fotoğraf silindi.', 'success');
      setToDelete(null);
    } catch (err) {
      toast(getErrorMessage(err, 'Silinemedi.'), 'error');
    } finally {
      setDeleting(false);
    }
  }

  const add = (p: RestaurantPhoto) => setPhotos((prev) => [...prev, p]);

  return (
    <>
      <PageHeader title="Fotoğraflar" description="Restoran ve ürün galerileri (JPEG, PNG veya WebP · en fazla 5 MB)." />
      {storageMsg && (
        <div className="section">
          <Alert tone="warning" icon="clock" title={STORAGE_SOON}>{storageMsg !== STORAGE_SOON ? storageMsg : 'Mevcut fotoğraflarınızı görüntüleyip silebilirsiniz.'}</Alert>
        </div>
      )}
      {loading ? <SkeletonBlock /> : loadError ? <ErrorState message={loadError} onRetry={load} /> : (
        <div className="stack">
          {photos.length === 0 && !storageMsg && (
            <div className="card"><EmptyState icon="image" title="Galeriniz boş">Mekânınızın ve ürünlerinizin fotoğrafları restoran detayında gösterilir.</EmptyState></div>
          )}
          <Gallery kind="RESTAURANT" title="Restoran fotoğrafları" hint="Mekân, salon, dış cephe" photos={photos.filter((p) => p.kind === 'RESTAURANT')} onAdded={add} onDelete={setToDelete} storageOff={setStorageMsg} uploadDisabled={!!storageMsg} />
          <Gallery kind="PRODUCT" title="Ürün fotoğrafları" hint="Yemek ve içecekler" photos={photos.filter((p) => p.kind === 'PRODUCT')} onAdded={add} onDelete={setToDelete} storageOff={setStorageMsg} uploadDisabled={!!storageMsg} />
        </div>
      )}
      <ConfirmDialog open={!!toDelete} title="Fotoğrafı sil" message="Bu fotoğraf galeriden kalıcı olarak silinecek." confirmLabel="Sil" tone="danger" busy={deleting} onConfirm={confirmDelete} onClose={() => setToDelete(null)} />
    </>
  );
}
