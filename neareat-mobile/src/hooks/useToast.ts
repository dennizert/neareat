import { useContext } from 'react';
import { ToastContext, type ToastApi } from '../components/Toast';

/**
 * S11-2 — Kısa bildirim (toast) göster.
 * Kullanım: const toast = useToast(); toast.show('Favorilere eklendi', 'success');
 * Not: yıkıcı/onay gerektiren akışlar için Alert kullanmaya devam et.
 */
export function useToast(): ToastApi {
  return useContext(ToastContext);
}
