import { useRef, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AuthLayout } from '../components/AuthLayout';
import { Alert } from '../components/Feedback';
import { Button } from '../components/Button';
import { Field, PasswordInput } from '../components/Field';
import { Icon } from '../components/Icon';
import { Dialog } from '../components/Dialog';
import { registerRestaurant } from '../services/restaurantAccount';
import { fetchNearby, searchPlaces } from '../services/places';
import { getErrorMessage, getStatus } from '../api/client';
import { useSessionStore } from '../store/sessionStore';
import { KVKK_TEXT, PRIVACY_POLICY, type LegalBlock } from '../content/legal';
import {
  buildPayload, CATEGORIES, conflictTarget, EMPTY_FORM, payloadFitsBodyLimit, placeAddressOf,
  sanitizeTaxNumber, STEPS, validateStep, type RegisterErrors, type RegisterForm,
} from '../utils/register';
import { formatBytes, readFileAsDataUrl, TAX_CERT_RULE, validateFile } from '../utils/validation';
import type { PlaceResult } from '../types';

function Stepper({ step }: { step: number }) {
  return (
    <>
      <ol className="stepper" aria-label="Başvuru adımları">
        {STEPS.map((n, j) => (
          <li key={n} data-done={j < step ? 'true' : undefined} aria-current={j === step ? 'step' : undefined}><span className="sr-only">{n}{j < step ? ' (tamamlandı)' : ''}</span></li>
        ))}
      </ol>
      <p className="stepper-label">Adım {step + 1}/5 · {STEPS[step]}</p>
    </>
  );
}

function LegalText({ blocks }: { blocks: LegalBlock[] }) {
  return (
    <div className="stack-sm">
      {blocks.map((b, i) => {
        if (b.t === 'docTitle') return <h3 key={i}>{b.x}</h3>;
        if (b.t === 'docDate') return <p key={i} className="subtle">{b.x}</p>;
        if (b.t === 'h') return <h4 key={i} style={{ marginTop: 'var(--space-4)' }}>{b.x}</h4>;
        if (b.t === 'subHeading') return <p key={i}><strong>{b.x}</strong></p>;
        if (b.t === 'li') return <p key={i} style={{ paddingLeft: 'var(--space-4)' }}>• {b.x}</p>;
        return <p key={i} style={{ whiteSpace: 'pre-line' }}>{b.x}</p>;
      })}
    </div>
  );
}

export default function RegisterPage() {
  const navigate = useNavigate();
  const loginEmail = useSessionStore((s) => s.loginEmail);
  const setNotice = useSessionStore((s) => s.setNotice);
  const [step, setStep] = useState(0);
  const [f, setF] = useState<RegisterForm>(EMPTY_FORM);
  const [errors, setErrors] = useState<RegisterErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [places, setPlaces] = useState<PlaceResult[]>([]);
  const [placesState, setPlacesState] = useState<'idle' | 'loading' | 'done' | 'denied' | 'error'>('idle');
  const [query, setQuery] = useState('');
  const [legal, setLegal] = useState<'privacy' | 'kvkk' | null>(null);
  const coords = useRef<{ lat: number; lng: number } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  function set<K extends keyof RegisterForm>(k: K, v: RegisterForm[K]) {
    setF((p) => ({ ...p, [k]: v }));
  }

  function loadNearby() {
    if (!('geolocation' in navigator)) { setPlacesState('denied'); return; }
    setPlacesState('loading');
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        coords.current = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        try {
          const r = await fetchNearby(pos.coords.latitude, pos.coords.longitude, 'all');
          setPlaces(r.results.slice(0, 30));
          setPlacesState('done');
        } catch {
          setPlacesState('error');
        }
      },
      () => setPlacesState('denied'),
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 },
    );
  }

  async function search(e?: FormEvent) {
    e?.preventDefault();
    const q = query.trim();
    if (q.length < 2) return;
    setPlacesState('loading');
    try {
      const r = await searchPlaces(q, coords.current?.lat, coords.current?.lng);
      setPlaces(r.results.slice(0, 30));
      setPlacesState('done');
    } catch {
      setPlacesState('error');
    }
  }

  function next() {
    const errs = validateStep(step, f);
    setErrors(errs);
    if (Object.keys(errs).length) return;
    if (step === 2 && placesState === 'idle') loadNearby();
    if (step < 4) setStep(step + 1);
    else submit();
  }

  async function onFile(file: File | undefined) {
    if (fileRef.current) fileRef.current.value = '';
    if (!file) return;
    const v = validateFile(file, TAX_CERT_RULE);
    setFileError(v);
    if (v) return;
    try {
      const dataUrl = await readFileAsDataUrl(file);
      set('taxCertificate', { name: file.name, size: file.size, dataUrl });
      setPreview(dataUrl);
    } catch {
      setFileError('Dosya okunamadı. Lütfen tekrar deneyin.');
    }
  }

  async function submit() {
    if (busy) return;
    const payload = buildPayload(f);
    if (!payloadFitsBodyLimit(payload)) {
      setStep(2);
      setFileError(TAX_CERT_RULE.sizeMessage);
      return;
    }
    setBusy(true);
    setSubmitError(null);
    try {
      await registerRestaurant(payload);
    } catch (err) {
      const msg = getErrorMessage(err, 'Kayıt başarısız.');
      if (getStatus(err) === 409) {
        const t = conflictTarget(msg);
        if (t) { setStep(t.step); setErrors({ [t.field]: msg }); setBusy(false); return; }
      }
      setSubmitError(msg);
      setBusy(false);
      return;
    }
    // V4: başvurudan sonra web oturumu açılır → "inceleniyor". Açılamazsa giriş ekranına.
    try {
      await loginEmail(payload.email, payload.password);
      navigate('/basvuru-durumu', { replace: true });
    } catch {
      setNotice('applicationReceived');
      navigate('/giris', { replace: true });
    } finally {
      setBusy(false);
    }
  }

  const nav = (
    <div className="row-between" style={{ marginTop: 'var(--space-6)' }}>
      {step > 0
        ? <Button variant="secondary" onClick={() => { setErrors({}); setStep(step - 1); }}><Icon name="chev-l" />Geri</Button>
        : <Link className="btn btn-secondary" to="/giris">Vazgeç</Link>}
      {step < 4
        ? <Button variant="primary" onClick={next}>Devam et<Icon name="chev-r" /></Button>
        : <Button variant="primary" loading={busy} disabled={!f.consent} onClick={next}>Başvuruyu gönder</Button>}
    </div>
  );

  return (
    <AuthLayout title="Restoran başvurusu" wide foot={<>Zaten hesabınız var mı? <Link to="/giris">Giriş yapın</Link></>}>
      <form noValidate onSubmit={(e) => { e.preventDefault(); if (step !== 3) next(); }}>
        <Stepper step={step} />
        {step === 0 && (
          <>
            <h2>Hesap bilgileri</h2>
            <p className="muted" style={{ margin: 'var(--space-1) 0 var(--space-4)' }}>Panele bu bilgilerle giriş yapacaksınız.</p>
            <Field id="ad" label="Ad Soyad" error={errors.ownerName}><input className="input" autoComplete="name" placeholder="Adınız Soyadınız" value={f.ownerName} onChange={(e) => set('ownerName', e.target.value)} /></Field>
            <Field id="k-email" label="E-posta" error={errors.email}><input className="input" type="email" autoComplete="email" inputMode="email" placeholder="ornek@isletme.com" value={f.email} onChange={(e) => set('email', e.target.value)} /></Field>
            <Field id="k-sifre" label="Şifre" hint="En az 8 karakter." error={errors.password}><PasswordInput autoComplete="new-password" maxLength={128} value={f.password} onChange={(e) => set('password', e.target.value)} /></Field>
          </>
        )}
        {step === 1 && (
          <>
            <h2>İşletme bilgileri</h2>
            <p className="muted" style={{ margin: 'var(--space-1) 0 var(--space-4)' }}>Vergi levhasındaki bilgilerle aynı olmalı.</p>
            <Field id="isl" label="İşletme adı" error={errors.businessName}><input className="input" placeholder="Örn. Kebapçı Dürüm Evi" value={f.businessName} onChange={(e) => set('businessName', e.target.value)} /></Field>
            <Field id="kat" label="Kategori" error={errors.businessCategory}>
              <select className="select" value={f.businessCategory} onChange={(e) => set('businessCategory', e.target.value)}>
                <option value="">Seçin</option>
                {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </Field>
            <Field id="vno" label="Vergi numarası" error={errors.taxNumber}><input className="input num" inputMode="numeric" maxLength={10} value={f.taxNumber} onChange={(e) => set('taxNumber', sanitizeTaxNumber(e.target.value))} /></Field>
            <Field id="vd" label="Vergi dairesi" error={errors.taxOffice}><input className="input" placeholder="Örn. Kadıköy" value={f.taxOffice} onChange={(e) => set('taxOffice', e.target.value)} /></Field>
            <Field id="tel" label="Telefon" error={errors.phone}><input className="input" type="tel" autoComplete="tel" placeholder="05xx xxx xx xx" value={f.phone} onChange={(e) => set('phone', e.target.value)} /></Field>
            <Field id="ie" label="İletişim e-postası" hint="Müşteri ve fatura yazışmaları bu adrese gider." error={errors.contactEmail}><input className="input" type="email" placeholder="iletisim@isletme.com" value={f.contactEmail} onChange={(e) => set('contactEmail', e.target.value)} /></Field>
            <Field id="adr" label="İşletme adresi" error={errors.address}><textarea className="textarea" rows={2} placeholder="Açık adres" value={f.address} onChange={(e) => set('address', e.target.value)} /></Field>
          </>
        )}
        {step === 2 && (
          <>
            <h2>Vergi levhası</h2>
            <p className="muted" style={{ margin: 'var(--space-1) 0 var(--space-4)' }}>Vergi levhanızın fotoğrafını yükleyin. Yalnızca onay sürecinde kullanılır.</p>
            {!f.taxCertificate ? (
              <label className="dropzone" htmlFor="levha" data-state={fileError ? 'error' : undefined}>
                <Icon name="upload" />
                <div style={{ marginTop: 'var(--space-2)', fontWeight: 600 }}>Dosya seçin</div>
                <div className="hint">JPG veya PNG · en fazla 3,5 MB</div>
                <input ref={fileRef} className="sr-only" id="levha" type="file" accept={TAX_CERT_RULE.types.join(',')} onChange={(e) => onFile(e.target.files?.[0])} aria-describedby={fileError ? 'levha-err' : undefined} />
              </label>
            ) : (
              <div className="dropzone" data-state="done" style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'center', textAlign: 'left', padding: 'var(--space-4)' }}>
                {preview ? <img src={preview} alt="Vergi levhası önizlemesi" style={{ width: 64, height: 64, objectFit: 'cover', borderRadius: 'var(--radius-sm)' }} /> : <Icon name="check-circle" />}
                <div style={{ flex: 1, minWidth: 0 }}><strong className="wrap-anywhere">{f.taxCertificate.name}</strong><div className="hint">{formatBytes(f.taxCertificate.size)} · yüklendi</div></div>
                <label className="btn btn-ghost btn-sm" htmlFor="levha2">Değiştir</label>
                <input ref={fileRef} className="sr-only" id="levha2" type="file" accept={TAX_CERT_RULE.types.join(',')} onChange={(e) => onFile(e.target.files?.[0])} />
                <Button size="sm" variant="ghost" onClick={() => { set('taxCertificate', null); setPreview(null); }}>Kaldır</Button>
              </div>
            )}
            {fileError && <p className="error-text" id="levha-err" style={{ marginTop: 'var(--space-2)' }}><Icon name="alert" />{fileError}</p>}
            <p className="subtle" style={{ marginTop: 'var(--space-3)' }}>Levhayı daha sonra da iletebilirsiniz; bu adım isteğe bağlıdır.</p>
          </>
        )}
        {step === 3 && (
          <>
            <h2>Restoranınızı seçin</h2>
            <p className="muted" style={{ margin: 'var(--space-1) 0 var(--space-4)' }}>Yakındaki işletmeler listelenir ya da adıyla arayabilirsiniz. Bulamazsanız bu adımı atlayabilirsiniz; ekibimiz eşleştirir.</p>
            {placesState === 'denied' && <Alert tone="warning" title="Konum izni verilmedi.">Restoranınızı adıyla arayabilirsiniz.</Alert>}
            {placesState === 'error' && <Alert tone="danger">Restoranlar yüklenemedi. Aramayı tekrar deneyin.</Alert>}
            <div className="field" style={{ marginTop: 'var(--space-3)' }}>
              <label className="label" htmlFor="ara">İşletme ara</label>
              <div className="row" style={{ flexWrap: 'nowrap' }}>
                <input className="input" id="ara" type="search" placeholder="Restoran adı ve semt" value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); search(); } }} />
                <Button variant="secondary" iconOnly aria-label="Ara" onClick={() => search()}><Icon name="search" /></Button>
              </div>
            </div>
            {placesState === 'loading' && <p className="subtle" role="status" style={{ marginTop: 'var(--space-3)' }}>Yükleniyor…</p>}
            {placesState === 'done' && places.length === 0 && <p className="subtle" style={{ marginTop: 'var(--space-3)' }}>Sonuç bulunamadı.</p>}
            {places.length > 0 && placesState !== 'loading' && (
              <fieldset style={{ border: 0, padding: 0, margin: 'var(--space-2) 0 0' }}>
                <legend className="sr-only">Arama sonuçları</legend>
                {places.map((p) => (
                  <label key={p.placeId} className="check" style={{ border: '1px solid var(--border-input)', borderRadius: 'var(--radius-md)', padding: 'var(--space-3)', marginTop: 'var(--space-2)' }}>
                    <input type="radio" name="place" checked={f.place?.placeId === p.placeId} onChange={() => set('place', p)} />
                    <span><strong>{p.name}</strong>{placeAddressOf(p) && <><br /><span className="subtle">{placeAddressOf(p)}</span></>}</span>
                  </label>
                ))}
              </fieldset>
            )}
            {f.place && <Button variant="ghost" block onClick={() => set('place', null)} style={{ marginTop: 'var(--space-2)' }}>Seçimi kaldır</Button>}
            <Button variant="ghost" block style={{ marginTop: 'var(--space-2)' }} onClick={() => { set('place', null); setStep(4); }}>Listede yok, atla</Button>
          </>
        )}
        {step === 4 && (
          <>
            <h2>Başvuruyu gönder</h2>
            <p className="muted" style={{ margin: 'var(--space-1) 0 var(--space-4)' }}>Bilgilerinizi kontrol edin.</p>
            <dl className="summary card" style={{ boxShadow: 'none', background: 'var(--bg-subtle)' }}>
              <dt>İşletme</dt><dd>{f.businessName}</dd>
              <dt>Yetkili</dt><dd>{f.ownerName}</dd>
              <dt>E-posta</dt><dd>{f.email}</dd>
              <dt>Vergi no</dt><dd className="num">{f.taxNumber}</dd>
              <dt>Vergi dairesi</dt><dd>{f.taxOffice}</dd>
              <dt>Kategori</dt><dd>{f.businessCategory}</dd>
              <dt>Telefon</dt><dd className="num">{f.phone}</dd>
              <dt>İletişim e-postası</dt><dd>{f.contactEmail}</dd>
              <dt>Adres</dt><dd>{f.address}</dd>
              <dt>Seçilen restoran</dt><dd>{f.place?.name ?? 'Seçilmedi'}</dd>
              <dt>Vergi levhası</dt><dd>{f.taxCertificate ? <span className="badge badge-success">Yüklendi</span> : <span className="badge badge-warning">Yüklenmedi</span>}</dd>
            </dl>
            <div style={{ marginTop: 'var(--space-4)' }}>
              <Alert tone="info">Başvurunuz onaylandığında <strong style={{ display: 'inline' }}>15 gün ücretsiz deneme</strong> başlar. Kart bilgisi istenmez. Deneme sonunda abonelik 1.299,90 ₺/ay'dır.</Alert>
            </div>
            <label className="check" style={{ marginTop: 'var(--space-3)' }}>
              <input type="checkbox" checked={f.consent} onChange={(e) => set('consent', e.target.checked)} aria-invalid={errors.consent ? 'true' : undefined} />
              <span>
                <button type="button" className="btn-link" onClick={() => setLegal('privacy')} style={{ background: 'none', border: 0, padding: 0, color: 'var(--text-link)', textDecoration: 'underline', font: 'inherit', cursor: 'pointer' }}>Gizlilik Politikası</button>
                {' ve '}
                <button type="button" className="btn-link" onClick={() => setLegal('kvkk')} style={{ background: 'none', border: 0, padding: 0, color: 'var(--text-link)', textDecoration: 'underline', font: 'inherit', cursor: 'pointer' }}>KVKK Aydınlatma Metni</button>
                'ni okudum, kabul ediyorum.
              </span>
            </label>
            {errors.consent && <p className="error-text"><Icon name="alert" />{errors.consent}</p>}
            {submitError && <div style={{ marginTop: 'var(--space-3)' }}><Alert tone="danger">{submitError}</Alert></div>}
          </>
        )}
        {nav}
      </form>
      <Dialog open={legal !== null} title={legal === 'kvkk' ? 'KVKK Aydınlatma Metni' : 'Gizlilik Politikası'} onClose={() => setLegal(null)} footer={<Button variant="primary" onClick={() => setLegal(null)}>Kapat</Button>}>
        <div style={{ maxHeight: '60vh', overflowY: 'auto' }}>
          <LegalText blocks={legal === 'kvkk' ? KVKK_TEXT : PRIVACY_POLICY} />
        </div>
      </Dialog>
    </AuthLayout>
  );
}
