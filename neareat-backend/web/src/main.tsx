import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import App from './App';
import { configureApi } from './api/client';
import { useSessionStore } from './store/sessionStore';
import { useCountsStore } from './store/countsStore';
import { applySavedTheme } from './utils/theme';
import './styles/eatlas-web.css';
import './styles/app.css';

applySavedTheme();

// Korumalı bir istek 401 alırsa (oturum süresi doldu / başka sekmede çıkış): yerel oturumu
// düşür; RequireSession aynı sayfayı `donus` parametresiyle girişe yönlendirir.
configureApi({
  onUnauthorized: () => {
    if (useSessionStore.getState().status === 'authenticated') {
      useCountsStore.getState().reset();
      useSessionStore.getState().clear('expired');
    }
  },
});

// Data router: `useBlocker` (kaydedilmemiş değişiklik uyarısı) için gerekli.
const router = createBrowserRouter([{ path: '*', element: <App /> }], { basename: '/panel' });

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
);
