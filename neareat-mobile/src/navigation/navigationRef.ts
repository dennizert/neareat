import { createNavigationContainerRef } from '@react-navigation/native';

// Global navigation ref — bileşen ağacı dışından (servis/util) yönlendirme yapmak için.
// premiumGate gibi yardımcılar navigation prop'u almadan Paywall'a gidebilir.
export const navigationRef = createNavigationContainerRef<any>();

export function navigate(name: string, params?: object) {
  if (navigationRef.isReady()) {
    // Tip güvenliği RootStackParamList'e bağlı; util katmanında gevşek tutuluyor.
    (navigationRef as any).navigate(name, params);
  }
}
