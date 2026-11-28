import { useEffect } from 'react';
import { useBlocker } from 'react-router-dom';

export const UNSAVED_MESSAGE = 'Kaydedilmemiş değişiklikleriniz var. Sayfadan ayrılmak istediğinize emin misiniz?';

/**
 * Kaydedilmemiş değişiklik uyarısı (#530): sekme kapatma/yenileme `beforeunload`, uygulama
 * içi gezinme `useBlocker` ile yakalanır (data router gerekir — main.tsx `createBrowserRouter`).
 */
export function useUnsavedChangesWarning(dirty: boolean) {
  useEffect(() => {
    if (!dirty) return;
    const h = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', h);
    return () => window.removeEventListener('beforeunload', h);
  }, [dirty]);
  return useBlocker(dirty);
}
