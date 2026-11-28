import type { ReactElement } from 'react';
import { render } from '@testing-library/react';
import { createMemoryRouter, RouterProvider, useLocation } from 'react-router-dom';
import { useSessionStore } from '../store/sessionStore';
import type { RestaurantSummary, SessionUser } from '../types';

/** Geçerli konumu test içinde okumak için. */
export function LocationProbe() {
  const l = useLocation();
  return <div data-testid="location">{l.pathname}{l.search}</div>;
}

/** Data router ile (useBlocker için) render. `routes` verilmezse tek ekran `*` yolunda. */
export function renderRoute(ui: ReactElement, { path = '/', initial = '/' }: { path?: string; initial?: string } = {}) {
  const router = createMemoryRouter(
    [
      { path, element: <>{ui}<LocationProbe /></> },
      { path: '*', element: <LocationProbe /> },
    ],
    { initialEntries: [initial] },
  );
  return { router, ...render(<RouterProvider router={router} />) };
}

export const RESTAURANT_USER: SessionUser = { id: 'u1', email: 'sahip@isletme.com', displayName: 'Ayşe', role: 'RESTAURANT' };
export const APPROVED: RestaurantSummary = { status: 'APPROVED', rejectionReason: null, businessName: 'Kebapçı Dürüm Evi', displayName: null };

export function signIn(restaurant: RestaurantSummary = APPROVED) {
  useSessionStore.setState({ status: 'authenticated', user: RESTAURANT_USER, restaurant, notice: null });
}

export function signOut() {
  useSessionStore.setState({ status: 'anonymous', user: null, restaurant: null, notice: null });
}

/** axios hata nesnesi taklidi (getStatus/getErrorBody `isAxiosError` ile okur). */
export function axiosError(status: number, data: unknown) {
  return Object.assign(new Error(`HTTP ${status}`), {
    isAxiosError: true,
    response: { status, data, headers: {}, statusText: '', config: {} },
    config: {},
    toJSON: () => ({}),
  });
}
