import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { render } from '@testing-library/react';
import { axiosError, LocationProbe, renderRoute, signIn, signOut, APPROVED } from '../test/render';
import { useSessionStore } from '../store/sessionStore';
import type { UserRole, WebSessionPayload } from '../types';

vi.mock('../api/client', async (orig) => {
  const real = await orig<typeof import('../api/client')>();
  return { ...real, loginWithPassword: vi.fn(), loginWithGoogle: vi.fn(), logout: vi.fn(), fetchRestaurantSummary: vi.fn() };
});
vi.mock('../services/auth', () => ({ forgotPassword: vi.fn(), resetPassword: vi.fn() }));
// GIS betiği testte yüklenmez → düğme gizlenir, e-posta girişi çalışır.
vi.mock('../components/GoogleSignInButton', () => ({ GoogleSignInButton: () => null }));

import * as client from '../api/client';
import * as authSvc from '../services/auth';
import LoginPage from './LoginPage';
import ResetPasswordPage from './ResetPasswordPage';
import ApplicationStatusPage from './ApplicationStatusPage';
import { PublicOnly, RequireApproved, RequireSession } from '../routes/guards';

const session = (role: UserRole = 'RESTAURANT'): WebSessionPayload => ({ user: { id: 'u', email: 'a@b.co', displayName: 'A', role }, csrfToken: 'c', mfa: 'none' });

function fillLogin(email = 'sahip@isletme.com', pw = 'secret123') {
  fireEvent.change(screen.getByLabelText('E-posta'), { target: { value: email } });
  fireEvent.change(screen.getByLabelText('Şifre'), { target: { value: pw } });
  fireEvent.click(screen.getByRole('button', { name: 'Giriş yap' }));
}

beforeEach(() => {
  vi.clearAllMocks();
  signOut();
});

describe('Giriş', () => {
  it('başarılı giriş → onaylı restoran istenen yola döner', async () => {
    vi.mocked(client.loginWithPassword).mockResolvedValue(session());
    vi.mocked(client.fetchRestaurantSummary).mockResolvedValue(APPROVED);
    renderRoute(<LoginPage />, { path: '/giris', initial: '/giris?donus=%2Frezervasyonlar' });
    fillLogin();
    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('/rezervasyonlar'));
    expect(client.loginWithPassword).toHaveBeenCalledWith('sahip@isletme.com', 'secret123');
    expect(useSessionStore.getState().status).toBe('authenticated');
  });

  it('PENDING restoran → başvuru durumu', async () => {
    vi.mocked(client.loginWithPassword).mockResolvedValue(session());
    vi.mocked(client.fetchRestaurantSummary).mockResolvedValue({ ...APPROVED, status: 'PENDING' });
    renderRoute(<LoginPage />, { path: '/giris', initial: '/giris' });
    fillLogin();
    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('/basvuru-durumu'));
  });

  it('hatalı şifre (401) prototip metni', async () => {
    vi.mocked(client.loginWithPassword).mockRejectedValue(axiosError(401, { error: 'E-posta veya şifre hatalı' }));
    renderRoute(<LoginPage />, { path: '/giris', initial: '/giris' });
    fillLogin();
    expect(await screen.findByText('E-posta veya şifre hatalı.')).toBeInTheDocument();
  });

  it('yanlış rol (oturum USER döndü) → ret mesajı ve oturum kapatılır', async () => {
    vi.mocked(client.loginWithPassword).mockResolvedValue(session('USER'));
    vi.mocked(client.logout).mockResolvedValue();
    renderRoute(<LoginPage />, { path: '/giris', initial: '/giris' });
    fillLogin();
    expect(await screen.findByText('Bu panel restoran sahipleri ve yöneticiler içindir.')).toBeInTheDocument();
    expect(client.logout).toHaveBeenCalled();
    expect(useSessionStore.getState().status).toBe('anonymous');
  });

  it('askıya alınmış hesap', async () => {
    vi.mocked(client.loginWithPassword).mockRejectedValue(axiosError(403, { error: 'Hesabınız askıya alınmıştır.' }));
    renderRoute(<LoginPage />, { path: '/giris', initial: '/giris' });
    fillLogin();
    expect(await screen.findByText('Hesabınız askıya alınmıştır.')).toBeInTheDocument();
  });

  it('429 → kilit mesajı ve düğme geçici kilitli', async () => {
    vi.mocked(client.loginWithPassword).mockRejectedValue(axiosError(429, { error: 'Çok fazla istek' }));
    renderRoute(<LoginPage />, { path: '/giris', initial: '/giris' });
    fillLogin();
    expect(await screen.findByText('Çok fazla deneme yapıldı.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Giriş yap' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Giriş yap' }));
    expect(client.loginWithPassword).toHaveBeenCalledTimes(1);
  });

  it('gönderim sürerken ikinci istek gitmez', async () => {
    let resolve!: (v: WebSessionPayload) => void;
    vi.mocked(client.loginWithPassword).mockImplementation(() => new Promise((r) => { resolve = r; }));
    vi.mocked(client.fetchRestaurantSummary).mockResolvedValue(APPROVED);
    renderRoute(<LoginPage />, { path: '/giris', initial: '/giris' });
    fillLogin();
    fireEvent.click(screen.getByRole('button', { name: 'Giriş yap' }));
    fireEvent.submit(screen.getByRole('button', { name: 'Giriş yap' }).closest('form')!);
    expect(client.loginWithPassword).toHaveBeenCalledTimes(1);
    resolve(session());
    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('/'));
  });

  it('boş alanlar gönderilmez', () => {
    renderRoute(<LoginPage />, { path: '/giris', initial: '/giris' });
    fireEvent.click(screen.getByRole('button', { name: 'Giriş yap' }));
    expect(client.loginWithPassword).not.toHaveBeenCalled();
    expect(screen.getByLabelText('E-posta')).toHaveAttribute('aria-invalid', 'true');
  });

  it('oturum süresi doldu bildirimi gösterilir', () => {
    useSessionStore.setState({ notice: 'expired' });
    renderRoute(<LoginPage />, { path: '/giris', initial: '/giris' });
    expect(screen.getByText('Oturumunuzun süresi doldu.')).toBeInTheDocument();
  });
});

describe('Şifre sıfırlama', () => {
  it('talep: hesap var/yok aynı ekran; 429 da aynı', async () => {
    vi.mocked(authSvc.forgotPassword).mockRejectedValue(axiosError(429, {}));
    renderRoute(<ResetPasswordPage />, { path: '/sifre-sifirla', initial: '/sifre-sifirla' });
    fireEvent.change(screen.getByLabelText('E-posta'), { target: { value: 'x@y.co' } });
    fireEvent.click(screen.getByRole('button', { name: 'Bağlantı gönder' }));
    expect(await screen.findByText('E-postanızı kontrol edin')).toBeInTheDocument();
  });

  it('şifreler eşleşmiyor / kısa → gönderilmez', () => {
    renderRoute(<ResetPasswordPage />, { path: '/sifre-sifirla', initial: '/sifre-sifirla?token=abc' });
    fireEvent.change(screen.getByLabelText('Yeni şifre'), { target: { value: 'kisa' } });
    fireEvent.change(screen.getByLabelText('Yeni şifre (tekrar)'), { target: { value: 'baska' } });
    fireEvent.click(screen.getByRole('button', { name: 'Şifreyi güncelle' }));
    expect(screen.getByText('Şifre 8-128 karakter arasında olmalı')).toBeInTheDocument();
    expect(screen.getByText('Şifreler eşleşmiyor.')).toBeInTheDocument();
    expect(authSvc.resetPassword).not.toHaveBeenCalled();
  });

  it('başarı → güncellendi + giriş bağlantısı', async () => {
    vi.mocked(authSvc.resetPassword).mockResolvedValue({ message: 'ok' });
    renderRoute(<ResetPasswordPage />, { path: '/sifre-sifirla', initial: '/sifre-sifirla?token=abc' });
    fireEvent.change(screen.getByLabelText('Yeni şifre'), { target: { value: 'yenisifre1' } });
    fireEvent.change(screen.getByLabelText('Yeni şifre (tekrar)'), { target: { value: 'yenisifre1' } });
    fireEvent.click(screen.getByRole('button', { name: 'Şifreyi güncelle' }));
    expect(await screen.findByText('Şifreniz güncellendi')).toBeInTheDocument();
    expect(authSvc.resetPassword).toHaveBeenCalledWith('abc', 'yenisifre1');
    expect(screen.getByRole('link', { name: 'Giriş yap' })).toHaveAttribute('href', '/giris');
  });

  it('geçersiz token → ayrı durum + yeni bağlantı iste', async () => {
    vi.mocked(authSvc.resetPassword).mockRejectedValue(axiosError(400, { error: 'Geçersiz veya süresi dolmuş sıfırlama bağlantısı' }));
    renderRoute(<ResetPasswordPage />, { path: '/sifre-sifirla', initial: '/sifre-sifirla?token=bad' });
    fireEvent.change(screen.getByLabelText('Yeni şifre'), { target: { value: 'yenisifre1' } });
    fireEvent.change(screen.getByLabelText('Yeni şifre (tekrar)'), { target: { value: 'yenisifre1' } });
    fireEvent.click(screen.getByRole('button', { name: 'Şifreyi güncelle' }));
    expect(await screen.findByText('Bağlantı geçersiz')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Yeni bağlantı iste' }));
    expect(await screen.findByRole('button', { name: 'Bağlantı gönder' })).toBeInTheDocument();
  });
});

describe('Korumalı yönlendirme', () => {
  function tree(initial: string) {
    const router = createMemoryRouter([
      { path: '/giris', element: <PublicOnly><LocationProbe /></PublicOnly> },
      { path: '/basvuru-durumu', element: <RequireSession><ApplicationStatusPage /><LocationProbe /></RequireSession> },
      { path: '/rezervasyonlar', element: <RequireSession><RequireApproved><div>PANEL</div></RequireApproved></RequireSession> },
    ], { initialEntries: [initial] });
    return render(<RouterProvider router={router} />);
  }

  it('oturum yoksa giriş + donus parametresi', () => {
    tree('/rezervasyonlar');
    expect(screen.getByTestId('location')).toHaveTextContent('/giris?donus=%2Frezervasyonlar');
  });

  it('PENDING restoran panel yolundan durum ekranına', () => {
    signIn({ ...APPROVED, status: 'PENDING' });
    tree('/rezervasyonlar');
    expect(screen.getByText('Başvurunuz inceleniyor')).toBeInTheDocument();
  });

  it('REJECTED → red nedeni ve çıkış', () => {
    signIn({ ...APPROVED, status: 'REJECTED', rejectionReason: 'Vergi levhası okunamıyor' });
    tree('/basvuru-durumu');
    expect(screen.getByText('Başvurunuz reddedildi')).toBeInTheDocument();
    expect(screen.getByText('Vergi levhası okunamıyor')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Çıkış yap' })).toBeInTheDocument();
  });

  it('onaylı restoran paneli görür', () => {
    signIn();
    tree('/rezervasyonlar');
    expect(screen.getByText('PANEL')).toBeInTheDocument();
  });

  it('401 sonrası (clear) panel içeriği gösterilmez, girişe gider', () => {
    signIn();
    tree('/rezervasyonlar');
    useSessionStore.getState().clear('expired');
    return waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('/giris'));
  });
});
