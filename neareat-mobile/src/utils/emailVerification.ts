import type { User } from '../types';

// E-posta doğrulama uyarı bandının gösterilip gösterilmeyeceğine dair SAF karar (S14-M1).
// Yalnızca e-posta ile kayıtlı VE henüz doğrulanmamış hesaplara gösterilir; Google
// kullanıcıları zaten emailVerified=true olduğundan banner görmez. Ağır/native import
// içermez ki kolayca birim-test edilebilsin (CLAUDE.md konvansiyonu).
export function shouldShowVerifyBanner(user: User | null): boolean {
  return !!user && user.authProvider === 'email' && user.emailVerified === false;
}
