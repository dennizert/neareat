import { useCallback, useEffect, useRef, useState } from 'react';
import { PageHeader } from '../components/AuthLayout';
import { Button } from '../components/Button';
import { Icon } from '../components/Icon';
import { Alert, EmptyState, ErrorState, SkeletonBlock } from '../components/Feedback';
import { ConfirmDialog } from '../components/Dialog';
import { deleteMenuItem, getMyRestaurantProfile, uploadMenuItem } from '../services/restaurantAccount';
import { getErrorMessage } from '../api/client';
import { toast } from '../store/toastStore';
import { MENU_RULE, readFileAsDataUrl, validateFile } from '../utils/validation';
import { formatDateShort } from '../utils/format';
import type { RestaurantMenuItemMeta } from '../types';

export const MENU_LIMIT = 10;

export default function MenuPage() {
  const [items, setItems] = useState<RestaurantMenuItemMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [toDelete, setToDelete] = useState<RestaurantMenuItemMeta | null>(null);
  const [deleting, setDeleting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const p = await getMyRestaurantProfile();
      setItems(p.menuItems ?? []);
    } catch (err) {
      setLoadError(getErrorMessage(err, 'Menü yüklenemedi.'));
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  const full = items.length >= MENU_LIMIT;

  async function onFile(file: File | undefined) {
    if (inputRef.current) inputRef.current.value = '';
    if (!file || uploading) return;
    const v = validateFile(file, MENU_RULE);
    setError(v);
    if (v) return;
    setUploading(true);
    try {
      const data = await readFileAsDataUrl(file);
      const item = await uploadMenuItem({ data, mimeType: file.type, fileName: file.name });
      setItems((prev) => [...prev, item]);
      toast('Menü öğesi yüklendi.', 'success');
    } catch (err) {
      setError(getErrorMessage(err, 'Yükleme başarısız.'));
    } finally {
      setUploading(false);
    }
  }

  async function confirmDelete() {
    if (!toDelete) return;
    setDeleting(true);
    try {
      await deleteMenuItem(toDelete.id);
      setItems((prev) => prev.filter((i) => i.id !== toDelete.id));
      toast('Menü öğesi silindi.', 'success');
      setToDelete(null);
    } catch (err) {
      toast(getErrorMessage(err, 'Silinemedi.'), 'error');
    } finally {
      setDeleting(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Menü"
        description={`Menü sayfalarınızı yükleyin (JPG, PNG, WebP veya PDF · en fazla 3 MB · en çok ${MENU_LIMIT} öğe).`}
        action={(
          <>
            <input ref={inputRef} className="sr-only" id="menu-file" type="file" accept={MENU_RULE.types.join(',')} onChange={(e) => onFile(e.target.files?.[0])} disabled={full || uploading} />
            <Button variant="primary" icon="upload" loading={uploading} disabled={full} onClick={() => inputRef.current?.click()}>Menü öğesi yükle</Button>
          </>
        )}
      />
      {full && <div className="section"><Alert tone="warning">En fazla 10 menü öğesi yükleyebilirsiniz</Alert></div>}
      {error && <div className="section"><Alert tone="danger">{error}</Alert></div>}
      {loading ? <SkeletonBlock /> : loadError ? <ErrorState message={loadError} onRetry={load} /> : items.length === 0 ? (
        <div className="card"><EmptyState icon="book" title="Menü yüklenmemiş">Kullanıcılar restoran detayında menünüzü görebilsin diye bir sayfa yükleyin.</EmptyState></div>
      ) : (
        <div className="card">
          <ul className="thumb-grid" role="list" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            {items.map((it, i) => (
              <li key={it.id} className="thumb">
                <div style={{ aspectRatio: '4 / 3', display: 'grid', placeItems: 'center', color: 'var(--text-tertiary)' }}>
                  <Icon name={it.mimeType === 'application/pdf' ? 'book' : 'image'} />
                </div>
                <div className="thumb-foot">
                  <span className="wrap-anywhere">{it.fileName || `Sayfa ${i + 1}`}<br /><span className="subtle">{formatDateShort(it.uploadedAt)}</span></span>
                  <Button size="sm" variant="ghost" iconOnly aria-label={`${it.fileName || `Sayfa ${i + 1}`} öğesini sil`} onClick={() => setToDelete(it)}><Icon name="trash" /></Button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
      <ConfirmDialog open={!!toDelete} title="Menü öğesini sil" message="Bu menü öğesi kalıcı olarak silinecek." confirmLabel="Sil" tone="danger" busy={deleting} onConfirm={confirmDelete} onClose={() => setToDelete(null)} />
    </>
  );
}
