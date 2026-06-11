# E-posta Entegrasyonu — Kurulum & Durum

Son güncelleme: 2026-06-11

Eatlas doğrulama / şifre sıfırlama / hoş geldin e-postaları **Resend** ile gönderilir.

---

## DURUM

| Parça | Durum |
|------|------|
| Backend kod (servis, controller, route, token hash) | ✅ HAZIR |
| Mobil kod (3 ekran, deep-link handler, scheme) | ✅ HAZIR |
| Eatlas markalı mail şablonları (doğrulama/sıfırlama/hoş geldin) | ✅ HAZIR (bu PR) |
| Markalı deep-link ara sayfası + Play Store fallback | ✅ HAZIR (bu PR) |
| Backend testleri (emailService + appLinkPage) | ✅ HAZIR (bu PR) |
| **Resend domain doğrulaması (Faz A)** | ⏳ SENİN AKSİYONUN |
| **Railway env varları** | ⏳ SENİN AKSİYONUN |

> Kod tamam — gerçek kullanıcılara mail gitmesi için yalnızca **Faz A** (domain + env) kaldı.

---

## FAZ A — Resend domain doğrulama (zorunlu)

`onboarding@resend.dev` test adresidir; **yalnızca Resend hesabının sahibinin kendi e-postasına** gönderir. Gerçek kullanıcılara mail için kendi domainini doğrulaman gerekir.

### A1 — Resend'e domain ekle
1. https://resend.com → **Domains → Add Domain**
2. Domainini gir (`eatlastr.com`). İki seçenek:
   - Ana domain: `eatlastr.com` → gönderici `noreply@eatlastr.com`
   - **Önerilen**: alt domain `mail.eatlastr.com` (ana domainin e-posta itibarını izole eder) → gönderici `noreply@mail.eatlastr.com`
3. Resend sana **DNS kayıtları** verecek (genelde 3 kayıt):
   - **SPF** — `TXT` (örn. `v=spf1 include:amazonses.com ~all`)
   - **DKIM** — `TXT` veya `CNAME` (uzun anahtar kaydı)
   - **(Opsiyonel) DMARC** — `TXT` (`_dmarc` → `v=DMARC1; p=none;`)

### A2 — DNS kayıtlarını domain sağlayıcına gir
Domainini aldığın yerde (GoDaddy / Cloudflare / Natro / İsimtescil vb.) **DNS yönetimi**ne gir ve Resend'in verdiği kayıtları **birebir** ekle.
- Cloudflare kullanıyorsan DKIM CNAME kayıtlarında **proxy'i KAPAT** (gri bulut / DNS only).

### A3 — Doğrula
Resend'de domain sayfasında **Verify** → kayıtlar yayılınca (birkaç dk – birkaç saat) "Verified" olur.

---

## FAZ A (devam) — Railway env varları

Railway → `neareat-backend` servisi → **Variables**:

```
RESEND_API_KEY=re_xxx                          # Resend → API Keys
EMAIL_FROM=Eatlas <noreply@eatlastr.com>       # A1'de doğruladığın gönderici
APP_BASE_URL=https://railway-up-production-6cdc.up.railway.app
TOKEN_HASH_SECRET=<uzun-rastgele-değer>        # ayarlı değilse JWT_SECRET'e düşer
```

> `EMAIL_FROM`'daki adres A1'de **doğruladığın domaine** ait olmalı; aksi halde Resend
> 403 döner ve mail gitmez.

---

## TEST (Faz A sonrası)

1. Uygulamadan yeni bir hesapla **kayıt ol** → doğrulama maili gelmeli (spam'i de kontrol et).
2. Maildeki **E-postamı Doğrula** → markalı ara sayfa → "Uygulamada Aç" → Eatlas açılıp doğrulamalı.
3. Doğrulama sonrası **hoş geldin** maili gelmeli.
4. Login → **Şifremi Unuttum** → sıfırlama maili → link → ResetPassword ekranı.

Railway loglarında `[EMAIL]` ile başlayan satırlar gönderim hatalarını gösterir.

---

## MİMARİ (referans)

- **Servis:** `src/services/emailService.js` — `sendVerificationEmail`, `sendPasswordResetEmail`, `sendWelcomeEmail`. Ortak markalı şablon (`renderEmail`), kullanıcı adı HTML-escape'li.
- **Ara sayfa:** `src/utils/appLinkPage.js` — e-posta linkleri (`/verify-email`, `/reset-password`) bu HTML'i döner; deep link'i otomatik dener + "Uygulamada Aç" + Play Store fallback.
- **Controller:** `src/controllers/authController.js` — register (doğrulama maili), verifyEmail + Google yeni kayıt (hoş geldin maili), forgotPassword/resetPassword.
- **Token:** ham token e-postaya gider, DB'de `hashToken()` ile saklanır (`src/utils/tokenHash.js`).
- **Mobil:** `navigation/index.tsx` deep-link handler; `EmailVerificationScreen` / `ForgotPasswordScreen` / `ResetPasswordScreen`; scheme `neareat` (app.json + AndroidManifest).

### Opsiyonel sertleştirme (ileride)
Android **App Links** ile `https://` linkin redirect'siz direkt uygulamayı açması için:
`/.well-known/assetlinks.json` (Play App Signing SHA-256 ile) + app.json `intentFilters` `autoVerify:true`. Şu anki ara sayfa + custom scheme yaklaşımı bunsuz da çalışır.
