# build.py içinden exec edilir: ic, GOOGLE, auth_page, app_page, OUT kullanılabilir.

def proto(group, states, label='Prototip durumu'):
    btns = ''.join(
        f'<button type="button" data-proto-group="{group}" data-proto-show="{sid}" aria-pressed="{"true" if i == 0 else "false"}">{name}</button>'
        for i, (sid, name) in enumerate(states))
    return f'<div class="proto-bar" role="group" aria-label="{label}"><span>{label}:</span>{btns}</div>'

def st(group, sid, inner, first=False):
    h = '' if first else ' hidden'
    return f'<div data-proto-state="{group}" data-proto-id="{sid}"{h}>{inner}</div>'

def pw_field(fid, label, ph='En az 8 karakter', ac='current-password', hint=''):
    h = f'<span class="hint" id="{fid}-hint">{hint}</span>' if hint else ''
    d = f' aria-describedby="{fid}-hint"' if hint else ''
    return f'''<div class="field"><label class="label" for="{fid}">{label}</label>
<div class="input-group"><input class="input" id="{fid}" type="password" autocomplete="{ac}" placeholder="{ph}" required minlength="8"{d}>
<button type="button" class="input-action" data-toggle-password="{fid}" aria-label="Şifreyi göster" aria-pressed="false">{ic('eye')}</button></div>{h}</div>'''

# ---------------------------------------------------------------- GİRİŞ
login_form = f'''
<form class="stack" onsubmit="return false" novalidate>
  <button type="button" class="btn btn-google btn-block">{GOOGLE}Google ile devam et</button>
  <div class="divider">veya e-posta ile</div>
  {{ERR}}
  <div class="field"><label class="label" for="email">E-posta</label>
    <input class="input" id="email" type="email" autocomplete="email" inputmode="email" placeholder="ornek@isletme.com" required {{INV}}></div>
  {pw_field('sifre', 'Şifre')}
  <div class="row-between"><span></span><a href="sifre-sifirla.html" class="subtle" style="color:var(--text-link)">Şifremi unuttum</a></div>
  <button type="submit" class="btn btn-primary btn-block">Giriş yap</button>
</form>'''

login_ok = login_form.replace('{ERR}', '').replace('{INV}', '')
login_err = login_form.replace('{ERR}', f'<div class="alert alert-danger" role="alert">{ic("x-circle")}<div class="alert-body"><strong>E-posta veya şifre hatalı.</strong>Lütfen bilgilerinizi kontrol edip tekrar deneyin.</div></div>').replace('{INV}', 'aria-invalid="true"')
login_role = login_form.replace('{ERR}', f'<div class="alert alert-warning" role="alert">{ic("alert")}<div class="alert-body"><strong>Bu panel restoran sahipleri ve yöneticiler içindir.</strong>Kullanıcı hesabınızla Eatlas mobil uygulamasını kullanabilirsiniz.</div></div>').replace('{INV}', '')
login_locked = login_form.replace('{ERR}', f'<div class="alert alert-danger" role="alert">{ic("lock")}<div class="alert-body"><strong>Çok fazla deneme yapıldı.</strong>Güvenliğiniz için 15 dakika sonra tekrar deneyin.</div></div>').replace('{INV}', '').replace('class="btn btn-primary btn-block"', 'class="btn btn-primary btn-block" disabled')
totp = f'''
<div class="stack">
  <div class="alert">{ic('shield')}<div class="alert-body"><strong>İki adımlı doğrulama</strong>Doğrulama uygulamanızdaki 6 haneli kodu girin.</div></div>
  <div class="field"><label class="label" for="otp">Doğrulama kodu</label>
    <input class="input otp" id="otp" inputmode="numeric" autocomplete="one-time-code" maxlength="6" pattern="[0-9]{{6}}" placeholder="••••••"></div>
  <button type="button" class="btn btn-primary btn-block">Doğrula</button>
  <button type="button" class="btn btn-ghost btn-block" data-proto-group="login" data-proto-show="ok">Geri dön</button>
</div>'''

auth_page('giris.html', 'Giriş · Eatlas Panel', f'''
<div class="auth-card">
  <div class="auth-head"><span class="logo logo-lg" role="img" aria-label="Eatlas">Eatlas</span>
    <h1>Panele giriş</h1><p>Restoranınızı ve rezervasyonlarınızı yönetin.</p></div>
  {proto('login', [('ok','Normal'),('err','Hatalı şifre'),('role','Yanlış rol'),('locked','Kilit (429)'),('totp','Admin 2FA')])}
  <div class="card">
    {st('login','ok',login_ok,True)}{st('login','err',login_err)}{st('login','role',login_role)}{st('login','locked',login_locked)}{st('login','totp',totp)}
  </div>
  <p class="auth-foot">Restoranınız Eatlas'ta yok mu? <a href="kayit.html">Başvuru yapın</a></p>
</div>''')

# ---------------------------------------------------------------- ŞİFRE SIFIRLAMA
reset_req = f'''<form class="stack" onsubmit="return false">
  <p class="muted">Hesabınıza bağlı e-posta adresini girin. Şifre sıfırlama bağlantısı göndereceğiz.</p>
  <div class="field"><label class="label" for="r-email">E-posta</label><input class="input" id="r-email" type="email" autocomplete="email" placeholder="ornek@isletme.com"></div>
  <button class="btn btn-primary btn-block" type="button" data-proto-group="reset" data-proto-show="sent">Bağlantı gönder</button>
  <a class="btn btn-ghost btn-block" href="giris.html">{ic('chev-l')}Girişe dön</a></form>'''
reset_sent = f'''<div class="empty" style="padding:var(--space-4) 0">
  <div class="empty-icon">{ic('mail')}</div><h2>E-postanızı kontrol edin</h2>
  <p>Bu adres kayıtlıysa birkaç dakika içinde bir sıfırlama bağlantısı gelecek. Bağlantı 1 saat geçerlidir.</p>
  <button class="btn btn-secondary" type="button">Tekrar gönder</button>
  <p class="subtle" style="margin-top:var(--space-3)">Saatte en fazla 3 gönderim yapılabilir.</p></div>'''
reset_new = f'''<form class="stack" onsubmit="return false">
  <p class="muted">Yeni şifrenizi belirleyin.</p>
  {pw_field('n1','Yeni şifre',ac='new-password',hint='En az 8 karakter.')}
  <div class="field"><label class="label" for="n2">Yeni şifre (tekrar)</label>
    <input class="input" id="n2" type="password" autocomplete="new-password" aria-invalid="true" aria-describedby="n2-err">
    <span class="error-text" id="n2-err">{ic('alert')}Şifreler eşleşmiyor.</span></div>
  <button class="btn btn-primary btn-block" type="button" data-proto-group="reset" data-proto-show="done">Şifreyi güncelle</button></form>'''
reset_done = f'''<div class="empty" style="padding:var(--space-4) 0"><div class="empty-icon" style="color:var(--success);background:var(--success-bg)">{ic('check-circle')}</div>
  <h2>Şifreniz güncellendi</h2><p>Açık olan diğer oturumlarınız kapatıldı. Yeni şifrenizle giriş yapabilirsiniz.</p>
  <a class="btn btn-primary" href="giris.html">Giriş yap</a></div>'''
reset_bad = f'''<div class="empty" style="padding:var(--space-4) 0"><div class="empty-icon" style="color:var(--danger);background:var(--danger-bg)">{ic('x-circle')}</div>
  <h2>Bağlantı geçersiz</h2><p>Bu bağlantının süresi dolmuş ya da daha önce kullanılmış.</p>
  <button class="btn btn-primary" type="button" data-proto-group="reset" data-proto-show="req">Yeni bağlantı iste</button></div>'''
auth_page('sifre-sifirla.html', 'Şifre Sıfırlama · Eatlas Panel', f'''
<div class="auth-card">
  <div class="auth-head"><span class="logo logo-lg" role="img" aria-label="Eatlas">Eatlas</span><h1>Şifre sıfırlama</h1></div>
  {proto('reset', [('req','Talep'),('sent','Gönderildi'),('new','Yeni şifre'),('done','Başarılı'),('bad','Geçersiz bağlantı')])}
  <div class="card">{st('reset','req',reset_req,True)}{st('reset','sent',reset_sent)}{st('reset','new',reset_new)}{st('reset','done',reset_done)}{st('reset','bad',reset_bad)}</div>
</div>''')

# ---------------------------------------------------------------- KAYIT
STEPS = ['Hesap', 'İşletme', 'Vergi levhası', 'Restoran seçimi', 'Özet']
def stepper(i):
    def li(j, n):
        a = ' data-done="true"' if j < i else ''
        if j == i: a += ' aria-current="step"'
        return f'<li{a}><span class="sr-only">{n}</span></li>'
    lis = ''.join(li(j, n) for j, n in enumerate(STEPS))
    return f'<ol class="stepper" aria-label="Başvuru adımları">{lis}</ol><p class="stepper-label">Adım {i+1}/5 · {STEPS[i]}</p>'
def nav(i):
    back = f'<button type="button" class="btn btn-secondary" data-proto-group="reg" data-proto-show="s{i-1}">{ic("chev-l")}Geri</button>' if i > 0 else '<a class="btn btn-secondary" href="giris.html">Vazgeç</a>'
    nxt = f'<button type="button" class="btn btn-primary" data-proto-group="reg" data-proto-show="s{i+1}">Devam et{ic("chev-r")}</button>' if i < 4 else '<button type="button" class="btn btn-primary" data-proto-group="reg" data-proto-show="s5">Başvuruyu gönder</button>'
    return f'<div class="row-between" style="margin-top:var(--space-6)">{back}{nxt}</div>'
def fld(fid, label, typ='text', ph='', extra='', hint=''):
    h = f'<span class="hint">{hint}</span>' if hint else ''
    return f'<div class="field"><label class="label" for="{fid}">{label}</label><input class="input" id="{fid}" type="{typ}" placeholder="{ph}" {extra}>{h}</div>'

s0 = stepper(0) + '<h2>Hesap bilgileri</h2><p class="muted" style="margin:4px 0 16px">Panele bu bilgilerle giriş yapacaksınız.</p>' + \
     fld('ad','Ad Soyad',ph='Adınız Soyadınız',extra='autocomplete="name"') + fld('k-email','E-posta','email','ornek@isletme.com','autocomplete="email"') + \
     pw_field('k-sifre','Şifre',ac='new-password',hint='En az 8 karakter.') + nav(0)
cats = ''.join(f'<option>{c}</option>' for c in ['Restoran','Kafe','Fast Food','Esnaf Lokantası','Pastane/Fırın','Diğer'])
s1 = stepper(1) + '<h2>İşletme bilgileri</h2><p class="muted" style="margin:4px 0 16px">Vergi levhasındaki bilgilerle aynı olmalı.</p>' + \
     fld('isl','İşletme adı',ph='Örn. Kebapçı Dürüm Evi') + \
     f'<div class="field"><label class="label" for="kat">Kategori</label><select class="select" id="kat">{cats}</select></div>' + \
     f'''<div class="field"><label class="label" for="vno">Vergi numarası</label><input class="input num" id="vno" inputmode="numeric" maxlength="10" value="12345678" aria-invalid="true" aria-describedby="vno-err"><span class="error-text" id="vno-err">{ic('alert')}Vergi numarası 10 haneli olmalı.</span></div>''' + \
     fld('vd','Vergi dairesi',ph='Örn. Kadıköy') + fld('tel','Telefon','tel','05xx xxx xx xx','autocomplete="tel"') + \
     fld('ie','İletişim e-postası','email','iletisim@isletme.com', hint='Müşteri ve fatura yazışmaları bu adrese gider.') + \
     '<div class="field"><label class="label" for="adr">İşletme adresi</label><textarea class="textarea" id="adr" rows="2" placeholder="Açık adres"></textarea></div>' + nav(1)
s2 = stepper(2) + f'''<h2>Vergi levhası</h2><p class="muted" style="margin:4px 0 16px">Vergi levhanızın fotoğrafını ya da PDF'ini yükleyin. Yalnızca onay sürecinde kullanılır.</p>
<label class="dropzone" for="levha">{ic('upload')}<div style="margin-top:8px;font-weight:600">Dosya seçin ya da buraya sürükleyin</div><div class="hint">JPG, PNG veya PDF · en fazla 5 MB</div>
<input class="sr-only" id="levha" type="file" accept="image/jpeg,image/png,application/pdf"></label>
<div class="dropzone" data-state="done" style="margin-top:12px;display:flex;gap:12px;align-items:center;text-align:left;padding:16px">{ic('check-circle')}<div style="flex:1;min-width:0"><strong>vergi-levhasi.jpg</strong><div class="hint">1,8 MB · yüklendi</div></div><button type="button" class="btn btn-ghost btn-sm">Değiştir</button></div>
<div class="dropzone" data-state="error" style="margin-top:12px;display:flex;gap:12px;align-items:center;text-align:left;padding:16px">{ic('x-circle')}<div style="flex:1"><strong>levha.heic</strong><div class="error-text">Bu dosya türü desteklenmiyor. JPG, PNG veya PDF yükleyin.</div></div></div>''' + nav(2)
places = ''.join(f'''<label class="check" style="border:1px solid var(--border-input);border-radius:var(--radius-md);padding:12px;margin-top:8px"><input type="radio" name="place" {"checked" if i==0 else ""}><span><strong>{n}</strong><br><span class="subtle">{a}</span></span></label>'''
    for i,(n,a) in enumerate([('Kebapçı Dürüm Evi','Caferağa Mah. Moda Cd. 112, Kadıköy'),('Dürüm Evi Moda','Moda Cd. 40, Kadıköy'),('Kebapçı Halil','Bahariye Cd. 7, Kadıköy')]))
s3 = stepper(3) + f'''<h2>Restoranınızı seçin</h2><p class="muted" style="margin:4px 0 16px">İşletmenizi adıyla arayın. Bulamazsanız bu adımı atlayabilirsiniz; ekibimiz eşleştirir.</p>
<div class="field"><label class="label" for="ara">İşletme ara</label><div class="input-group"><input class="input" id="ara" type="search" value="Kebapçı Dürüm" placeholder="Restoran adı ve semt"><span class="input-action" style="display:grid;place-items:center">{ic('search')}</span></div></div>
<fieldset style="border:0;padding:0;margin:8px 0 0"><legend class="sr-only">Arama sonuçları</legend>{places}</fieldset>
<button type="button" class="btn btn-ghost btn-block" style="margin-top:8px">Listede yok, atla</button>''' + nav(3)
s4 = stepper(4) + f'''<h2>Başvuruyu gönder</h2><p class="muted" style="margin:4px 0 16px">Bilgilerinizi kontrol edin.</p>
<dl class="summary card" style="box-shadow:none;background:var(--bg-subtle)"><dt>İşletme</dt><dd>Kebapçı Dürüm Evi</dd><dt>Yetkili</dt><dd>Ayşe Yılmaz</dd><dt>Vergi no</dt><dd class="num">1234567890</dd><dt>Kategori</dt><dd>Restoran</dd><dt>Telefon</dt><dd class="num">0532 000 00 00</dd><dt>Seçilen restoran</dt><dd>Kebapçı Dürüm Evi</dd><dt>Vergi levhası</dt><dd><span class="badge badge-success">Yüklendi</span></dd></dl>
<div class="alert" style="margin-top:16px">{ic('info')}<div class="alert-body">Başvurunuz onaylandığında <strong style="display:inline">15 gün ücretsiz deneme</strong> başlar. Kart bilgisi istenmez. Deneme sonunda abonelik 1.299,90 ₺/ay'dır.</div></div>
<label class="check"><input type="checkbox"><span><a href="#">Abonelik koşullarını</a> ve <a href="#">KVKK aydınlatma metnini</a> okudum, kabul ediyorum.</span></label>''' + nav(4)
s5 = f'''<div class="empty" style="padding:var(--space-4) 0"><div class="empty-icon" style="color:var(--warning);background:var(--warning-bg)">{ic('clock')}</div>
<h2>Başvurunuz inceleniyor</h2><p>Genellikle 1 iş günü içinde sonuçlanır. Sonucu <strong>ayse@kebapci.com</strong> adresine e-postayla bildireceğiz.</p>
<a class="btn btn-secondary" href="giris.html">Giriş sayfasına dön</a></div>'''
auth_page('kayit.html', 'Restoran Başvurusu · Eatlas Panel', f'''
<div class="auth-card wide">
  <div class="auth-head"><span class="logo logo-lg" role="img" aria-label="Eatlas">Eatlas</span><h1>Restoran başvurusu</h1></div>
  {proto('reg', [('s0','1 Hesap'),('s1','2 İşletme'),('s2','3 Levha'),('s3','4 Seçim'),('s4','5 Özet'),('s5','Bekliyor')])}
  <div class="card"><form onsubmit="return false" novalidate>{st('reg','s0',s0,True)}{st('reg','s1',s1)}{st('reg','s2',s2)}{st('reg','s3',s3)}{st('reg','s4',s4)}{st('reg','s5',s5)}</form></div>
  <p class="auth-foot">Zaten hesabınız var mı? <a href="giris.html">Giriş yapın</a></p>
</div>''')

# ---------------------------------------------------------------- PANEL
trial_banner = f'''<div class="alert alert-warning" role="status">{ic('clock')}<div class="alert-body"><strong>Ücretsiz denemenizin bitmesine 3 gün kaldı.</strong>Kesintisiz devam etmek için aboneliği başlatın. Kalan günleriniz korunur.</div><a class="btn btn-primary btn-sm alert-action" href="abonelik.html">Abone ol</a></div>'''
sub_banner = f'''<div class="alert alert-danger" role="alert">{ic('lock')}<div class="alert-body"><strong>Aboneliğiniz aktif değil.</strong>Rezervasyon onayı, indirim, kampanya ve analitik kapalı. Restoranınız listede görünmeye devam eder.</div><a class="btn btn-primary btn-sm alert-action" href="abonelik.html">Aboneliği başlat</a></div>'''
today_rows = ''.join(f'''<tr><td class="cell-primary"><span class="cell-title">{n}</span> {"<span class='badge badge-priority'>Öncelikli</span>" if p else ""}</td><td data-label="Saat" class="num">{t}</td><td data-label="Kişi" class="num">{g}</td><td data-label="Durum"><span class="badge {b}">{s}</span></td></tr>'''
    for n,t,g,s,b,p in [('Mehmet K.','12:30','4','Onaylı','badge-success',False),('Zeynep A.','19:00','2','Bekliyor','badge-warning',True),('Can D.','20:30','6','Onaylı','badge-success',False)])
quick = ''.join(f'<a class="card nav-link" style="min-height:64px;box-shadow:none" href="{h}">{ic(i)}<span>{l}</span></a>' for h,i,l in
    [('rezervasyonlar.html','calendar','Rezervasyonlar'),('doluluk.html','gauge','Doluluk'),('#','store','Bilgiler'),('#','clock','Çalışma saatleri'),('#','book','Menü'),('#','star','Yorumlar'),('#','tag','İndirim'),('#','megaphone','Kampanya'),('#','trend','Analitik'),('abonelik.html','card','Abonelik')])
app_page('panel.html', 'Genel Bakış · Eatlas Panel', 'restaurant', 'panel.html', 'Kebapçı Dürüm Evi', f'''
      <div class="page-head"><div><h1>Genel bakış</h1><p>27 Kasım 2026, Cuma</p></div><a class="btn btn-primary" href="rezervasyonlar.html">{ic('calendar')}Bekleyen talepler (3)</a></div>
      {proto('pbanner', [('trial','Deneme bitiyor'),('sub','Abonelik yok'),('none','Banner yok')])}
      <div class="section">{st('pbanner','trial',trial_banner,True)}{st('pbanner','sub',sub_banner)}{st('pbanner','none','')}</div>
      <div class="section grid grid-stats">
        <div class="stat"><div class="stat-label">Bugünkü rezervasyon</div><div class="stat-value">12</div><div class="stat-meta">38 kişi</div></div>
        <div class="stat"><div class="stat-label">Bekleyen talep</div><div class="stat-value">3</div><div class="stat-meta"><span class="badge badge-priority">1 öncelikli</span></div></div>
        <div class="stat"><div class="stat-label">Bugün en yoğun saat</div><div class="stat-value num">20:00</div><div class="stat-meta"><span class="badge badge-danger">Dolu</span> 76/80 koltuk</div></div>
        <div class="stat"><div class="stat-label">Eatlas puanı</div><div class="stat-value">4,6</div><div class="stat-meta">128 yorum · Google 4,4</div></div>
      </div>
      <div class="section grid grid-2">
        <div class="card card-flush"><div class="card-header" style="padding:16px 20px 0"><h2 style="font-size:var(--fs-lg)">Bugün</h2><a href="rezervasyonlar.html" class="subtle" style="color:var(--text-link)">Tümünü gör</a></div>
          <table class="table table-stack"><thead><tr><th>Misafir</th><th>Saat</th><th>Kişi</th><th>Durum</th></tr></thead><tbody>{today_rows}</tbody></table></div>
        <div class="card"><h2 style="font-size:var(--fs-lg);margin-bottom:12px">Hızlı erişim</h2><div class="grid" style="grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:8px">{quick}</div></div>
      </div>''')

# ---------------------------------------------------------------- REZERVASYONLAR
RES = [
  ('r1','Zeynep Arslan','28 Kas','19:00',2,'PENDING','Doğum günü','Cam kenarı olursa sevinirim',True),
  ('r2','Burak Çelik','28 Kas','20:30',5,'PENDING','', '',False),
  ('r3','Elif Şahin','29 Kas','13:00',3,'PENDING','', 'Bebek sandalyesi',True),
  ('r4','Mehmet Kaya','27 Kas','12:30',4,'CONFIRMED','İş yemeği','',False),
  ('r5','Can Demir','27 Kas','20:30',6,'CONFIRMED','','',False),
  ('r6','Selin Aydın','25 Kas','19:30',2,'COMPLETED','','',False),
  ('r7','Ali Vural','24 Kas','21:00',8,'REJECTED','','',False),
]
SB = {'PENDING':('Bekliyor','badge-warning'),'CONFIRMED':('Onaylı','badge-success'),'COMPLETED':('Tamamlandı','badge-info'),'REJECTED':('Reddedildi','badge-danger')}
rows = ''
for rid,n,d,t,g,s,occ,sp,pri in RES:
    lab,b = SB[s]
    extra = ''
    if occ: extra += f'<div class="subtle">Özel gün: {occ}</div>'
    if sp: extra += f'<div class="subtle">Not: {sp}</div>'
    if s == 'PENDING':
        act = f'<button class="btn btn-secondary btn-sm" data-dialog-open="dlg-red" data-name="{n}">Reddet</button><button class="btn btn-primary btn-sm" data-dialog-open="dlg-onay" data-name="{n}" data-when="{d} · {t}" data-guests="{g}" data-seats="{g}">Onayla</button>'
    elif s == 'CONFIRMED':
        act = f'<button class="btn btn-secondary btn-sm" data-dialog-open="dlg-katilim" data-name="{n}" data-q="Müşteri gelmedi olarak işaretlensin mi?">Gelmedi</button><button class="btn btn-success btn-sm" data-dialog-open="dlg-katilim" data-name="{n}" data-q="Müşteri geldi olarak işaretlensin mi?">Geldi</button>'
    else:
        act = '<span class="subtle">—</span>'
    seats = f'{g} koltuk' if s in ('CONFIRMED','COMPLETED') else '—'
    hidden = '' if s == 'PENDING' else ' hidden'
    prib = " <span class='badge badge-priority'>Öncelikli kullanıcı</span>" if pri else ''
    rows += f'''<tr data-status-row="{s}"{hidden}><td class="cell-primary"><span class="cell-title">{n}</span>{prib}{extra}</td><td data-label="Tarih" class="num">{d} · {t}</td><td data-label="Kişi" class="num">{g}</td><td data-label="Rezerve koltuk" class="num">{seats}</td><td data-label="Durum"><span class="badge {b}">{lab}</span></td><td class="cell-actions">{act}</td></tr>'''
tabs = ''.join(f'<button class="tab" role="tab" aria-selected="{"true" if k=="PENDING" else "false"}" tabindex="{0 if k=="PENDING" else -1}" data-filter="{k}">{l}<span class="count">{c}</span></button>'
    for k,l,c in [('PENDING','Bekleyen',3),('CONFIRMED','Onaylı',2),('COMPLETED','Tamamlandı',1),('REJECTED','Reddedildi',1),('ALL','Tümü',7)])
app_page('rezervasyonlar.html', 'Rezervasyonlar · Eatlas Panel', 'restaurant', 'rezervasyonlar.html', 'Kebapçı Dürüm Evi', f'''
      <div class="page-head"><div><h1>Rezervasyonlar</h1><p>Bekleyen talepler öncelik sırasına göre (3. seviye ve üstü kullanıcılar üstte).</p></div>
        <div class="row"><label class="sr-only" for="tarih">Tarih</label><input class="input" id="tarih" type="date" value="2026-11-28" style="width:auto"></div></div>
      <div class="tabs" role="tablist" aria-label="Duruma göre filtre">{tabs}</div>
      <div class="card card-flush"><table class="table table-stack"><caption class="sr-only">Rezervasyon talepleri</caption>
        <thead><tr><th>Misafir</th><th>Tarih · saat</th><th>Kişi</th><th>Rezerve koltuk</th><th>Durum</th><th class="cell-actions">İşlem</th></tr></thead><tbody>{rows}</tbody></table></div>

      <dialog class="modal" id="dlg-onay" aria-labelledby="onay-t">
        <form method="dialog">
          <div class="modal-header"><h2 id="onay-t" style="font-size:var(--fs-lg)">Rezervasyonu onayla</h2><button class="btn btn-ghost btn-icon" value="cancel" aria-label="Kapat">{ic('x')}</button></div>
          <div class="modal-body stack">
            <dl class="summary"><dt>Misafir</dt><dd data-fill="name">—</dd><dt>Tarih</dt><dd data-fill="when">—</dd><dt>Kişi sayısı</dt><dd data-fill="guests">—</dd></dl>
            <div class="field"><label class="label" for="koltuk">Rezerve koltuk</label>
              <input class="input num" id="koltuk" type="number" inputmode="numeric" min="1" max="5000" data-fill="seats" aria-describedby="koltuk-h">
              <span class="hint" id="koltuk-h">Varsayılan kişi sayısıdır. Doluluk bu sayıya göre hesaplanır (1-5000).</span></div>
            <div class="alert alert-warning">{ic('alert')}<div class="alert-body">Bu saat diliminde 76/80 koltuk dolu. Onaylarsanız kapasite aşılır.</div></div>
          </div>
          <div class="modal-footer"><button class="btn btn-secondary" value="cancel">Vazgeç</button><button class="btn btn-primary" value="ok">Onayla</button></div>
        </form>
      </dialog>
      <dialog class="modal" id="dlg-red" aria-labelledby="red-t">
        <form method="dialog">
          <div class="modal-header"><h2 id="red-t" style="font-size:var(--fs-lg)">Talebi reddet</h2><button class="btn btn-ghost btn-icon" value="cancel" aria-label="Kapat">{ic('x')}</button></div>
          <div class="modal-body"><p class="muted" style="margin-bottom:12px"><span data-fill="name"></span> adlı misafire neden bildirilecek.</p>
            <div class="field"><label class="label" for="neden">Red nedeni</label><textarea class="textarea" id="neden" placeholder="Örn. O saat dilimi dolu" aria-invalid="true" aria-describedby="neden-e"></textarea>
            <span class="error-text" id="neden-e">{ic('alert')}Red nedeni girilmesi zorunludur.</span></div></div>
          <div class="modal-footer"><button class="btn btn-secondary" value="cancel">Vazgeç</button><button class="btn btn-danger" value="ok">Reddet</button></div>
        </form>
      </dialog>
      <dialog class="modal" id="dlg-katilim" aria-labelledby="kat-t">
        <form method="dialog">
          <div class="modal-header"><h2 id="kat-t" style="font-size:var(--fs-lg)">Katılım durumu</h2></div>
          <div class="modal-body"><p><strong data-fill="name"></strong></p><p class="muted" data-fill="q"></p></div>
          <div class="modal-footer"><button class="btn btn-secondary" value="cancel">Vazgeç</button><button class="btn btn-primary" value="ok">Evet, işaretle</button></div>
        </form>
      </dialog>''')

# ---------------------------------------------------------------- DOLULUK
OCC = [('12:00',18),('13:00',44),('14:00',22),('15:00',6),('16:00',0),('17:00',12),('18:00',38),('19:00',62),('20:00',76),('21:00',80),('22:00',40),('23:00',10)]
CAP = 80
def band(p):
    return ('full','Dolu','badge-danger') if p >= 100 else (('limited','Az yer kaldı','badge-warning') if p >= 70 else ('available','Müsait','badge-success'))
occ_rows = ''
for t,s in OCC:
    p = round(s*100/CAP); k,l,b = band(p)
    occ_rows += f'''<li class="occ-row" data-band="{k}"><span class="occ-time">{t}</span><div class="occ-bar" role="img" aria-label="{t}: {s}/{CAP} koltuk, yüzde {p}, {l}"><span style="width:{p}%"></span></div><span class="occ-meta"><span class="num">{s}/{CAP} · %{p}</span><span class="badge {b}">{l}</span></span></li>'''
occ_main = f'''
  <div class="grid grid-stats">
    <div class="stat"><div class="stat-label">Koltuk kapasitesi</div><div class="stat-value">{CAP}</div><div class="stat-meta"><a href="#">Değiştir</a></div></div>
    <div class="stat"><div class="stat-label">En yoğun saat</div><div class="stat-value num">21:00</div><div class="stat-meta"><span class="badge badge-danger">Dolu</span></div></div>
    <div class="stat"><div class="stat-label">Onaylı rezervasyon</div><div class="stat-value">14</div><div class="stat-meta">408 koltuk-saat</div></div>
  </div>
  <div class="card section"><div class="card-header"><h2 style="font-size:var(--fs-lg)">Saatlik doluluk</h2>
    <div class="row subtle"><span class="badge badge-success">Müsait</span><span class="badge badge-warning">Az yer kaldı (%70+)</span><span class="badge badge-danger">Dolu</span></div></div>
    <ul class="occ-list" role="list">{occ_rows}</ul>
    <p class="subtle" style="margin-top:12px">Yalnızca onaylı rezervasyonlar sayılır. Her rezervasyon yaklaşık 2 saat yer tutar.</p></div>'''
occ_nocap = f'''<div class="card empty"><div class="empty-icon">{ic('gauge')}</div><h2>Koltuk kapasitesi girilmemiş</h2><p>Doluluğu görebilmek için restoranınızın toplam koltuk sayısını girin.</p><a class="btn btn-primary" href="#">Kapasite gir</a></div>'''
occ_sub = f'''<div class="card empty"><div class="empty-icon" style="color:var(--danger);background:var(--danger-bg)">{ic('lock')}</div><h2>Abonelik gerekli</h2><p>Doluluk paneli aktif abonelik ya da deneme süresi gerektirir.</p><a class="btn btn-primary" href="abonelik.html">Aboneliği başlat</a></div>'''
occ_load = '<div class="card stack">' + ''.join(f'<div class="skeleton" style="width:{w}%"></div>' for w in (40,90,75,85,60,95)) + '</div>'
app_page('doluluk.html', 'Doluluk · Eatlas Panel', 'restaurant', 'doluluk.html', 'Kebapçı Dürüm Evi', f'''
      <div class="page-head"><div><h1>Doluluk</h1><p>Seçili gün için saat saat koltuk durumu.</p></div>
        <div class="date-nav"><button class="btn btn-secondary btn-icon" aria-label="Önceki gün">{ic('chev-l')}</button>
          <label class="sr-only" for="dt">Tarih</label><input class="input" id="dt" type="date" value="2026-11-28"><button class="btn btn-secondary btn-icon" aria-label="Sonraki gün">{ic('chev-r')}</button>
          <button class="btn btn-ghost">Bugün</button></div></div>
      {proto('occ', [('main','Normal'),('load','Yükleniyor'),('nocap','Kapasite yok'),('sub','Abonelik gerekli')])}
      {st('occ','main',occ_main,True)}{st('occ','load',occ_load)}{st('occ','nocap',occ_nocap)}{st('occ','sub',occ_sub)}''')

# ---------------------------------------------------------------- ABONELİK
features = ''.join(f'<li>{ic("check")}<span>{f}</span></li>' for f in ['Rezervasyon kabulü ve doluluk paneli','İndirim ve anlık kampanya bildirimleri','Analitik panel ve haftalık iş raporu','Menü ve ürün fotoğrafları','Yorumlara cevap verme'])
def status_card(badge, title, body, actions=''):
    return f'<div class="card"><div class="row-between"><span class="badge {badge[1]}">{badge[0]}</span></div><h2 style="margin-top:12px">{title}</h2><div class="muted stack-sm" style="margin-top:8px">{body}</div>{actions}</div>'
trial_card = f'''<div class="card"><span class="badge badge-info">Ücretsiz deneme</span>
  <div class="trial-count" style="margin-top:16px"><span class="big">9</span><span class="muted">gün kaldı</span></div>
  <div class="progress" style="margin:12px 0 8px" role="progressbar" aria-label="Deneme süresi" aria-valuemin="0" aria-valuemax="15" aria-valuenow="6" aria-valuetext="15 günün 6'sı kullanıldı"><span style="width:40%"></span></div>
  <p class="subtle">Deneme 6 Aralık 2026'da biter. Kart bilgisi istenmedi.</p>
  <p class="muted" style="margin-top:12px">Şimdi abone olursanız kartınızdan <strong>deneme bitiminde</strong> çekim yapılır; kalan günleriniz korunur.</p></div>'''
trial_sub_card = status_card(('Deneme + abonelik başlatıldı','badge-success'),'İlk ödeme 6 Aralık 2026', '<p>Kartınız (•••• 4242) kaydedildi. Deneme bitince 1.299,90 ₺ çekilecek.</p>',
    '<div class="row" style="margin-top:16px"><button class="btn btn-secondary">Kartı güncelle</button><button class="btn btn-ghost">Aboneliği iptal et</button></div>')
active_card = status_card(('Aktif','badge-success'),'Sonraki ödeme 27 Aralık 2026','<p>1.299,90 ₺ · •••• 4242</p>',
    '<div class="row" style="margin-top:16px"><button class="btn btn-secondary">Kartı güncelle</button><button class="btn btn-ghost">Aboneliği iptal et</button></div>')
pastdue_card = f'''<div class="alert alert-danger" role="alert">{ic('alert')}<div class="alert-body"><strong>Ödeme alınamadı.</strong>Kartınızdan çekim yapılamadı. 30 Kasım 2026'ya kadar (3 gün) kartınızı güncellemezseniz panel işlemleri kapanır.</div></div>
  <div style="margin-top:16px">{status_card(('Ödeme bekliyor','badge-danger'),'Kartınızı güncelleyin','<p>Son deneme: 27 Kasım 2026 · •••• 4242</p>','<div class="row" style="margin-top:16px"><button class="btn btn-primary">Kartı güncelle</button></div>')}</div>'''
cancel_card = status_card(('İptal edildi','badge-warning'),'27 Aralık 2026\'ya kadar erişiminiz sürüyor','<p>Dönem sonunda yenilenmeyecek. Kısmi iade yapılmaz.</p>','<div class="row" style="margin-top:16px"><button class="btn btn-primary">Aboneliği yeniden başlat</button></div>')
play_card = status_card(('Google Play aboneliği','badge-info'),'Aboneliğiniz Google Play üzerinden','<p>Mevcut aboneliğiniz 14 Ocak 2027\'ye kadar geçerli. Süre bitmeden web\'den abone olmanız gerekmez; bittiğinde buradan devam edebilirsiniz.</p>')
pay_block = f'''<div class="card plan section"><div class="row-between"><h2>Eatlas Restoran</h2><span class="badge badge-priority no-dot">Tek plan</span></div>
    <div class="price" style="margin-top:8px">1.299,90 ₺<small> / ay</small></div><p class="subtle">KDV durumu: [YER TUTUCU — mali müşavir onayı]</p>
    <ul class="feature-list" style="margin-top:16px">{features}</ul></div>
  <div class="card section"><h2 style="font-size:var(--fs-lg)">Ödeme</h2>
    <p class="muted" style="margin:4px 0 12px">Kart bilgileriniz iyzico'nun güvenli formunda girilir; Eatlas kart bilgisi görmez ve saklamaz.</p>
    <label class="check"><input type="checkbox" id="c1"><span><a href="#">Ön bilgilendirme formunu</a> okudum.</span></label>
    <label class="check"><input type="checkbox" id="c2"><span><a href="#">Mesafeli hizmet sözleşmesini</a> ve <a href="#">iptal ve iade politikasını</a> kabul ediyorum.</span></label>
    <div class="payment-slot" style="margin-top:12px"><div><div class="empty-icon" style="margin:0 auto 12px;width:56px;height:56px;border-radius:50%;display:grid;place-items:center;background:var(--bg-surface)">{ic('lock')}</div>
      <strong>iyzico ödeme formu burada açılır</strong><p class="subtle" style="margin-top:6px">Kutular işaretlenince yüklenir.<br>Gömme noktası: <code>&lt;div id="iyzipay-checkout-form" class="responsive"&gt;</code></p></div></div>
    <p class="subtle" style="margin-top:12px">Faturanız mali müşavirimiz tarafından düzenlenip iletişim e-postanıza gönderilir.</p></div>'''
inv_rows = ''.join(f'<tr><td class="cell-primary num">{d}</td><td data-label="Tutar" class="num">1.299,90 ₺</td><td data-label="Durum"><span class="badge {b}">{s}</span></td></tr>' for d,s,b in [('27 Kas 2026','Ödendi','badge-success'),('27 Eki 2026','Ödendi','badge-success')])
history = f'<div class="card card-flush section"><div class="card-header" style="padding:16px 20px 0"><h2 style="font-size:var(--fs-lg)">Ödeme geçmişi</h2></div><table class="table table-stack"><thead><tr><th>Tarih</th><th>Tutar</th><th>Durum</th></tr></thead><tbody>{inv_rows}</tbody></table></div>'
app_page('abonelik.html', 'Abonelik · Eatlas Panel', 'restaurant', 'abonelik.html', 'Kebapçı Dürüm Evi', f'''
      <div class="page-head"><div><h1>Abonelik</h1><p>Tek plan, aylık ödeme. İstediğiniz zaman dönem sonunda iptal edebilirsiniz.</p></div></div>
      {proto('sub', [('trial','Deneme'),('trialsub','Deneme + abone'),('active','Aktif'),('pastdue','Ödeme sorunu'),('cancel','İptal edildi'),('play','Play abonesi')])}
      {st('sub','trial','<div class="grid grid-2"><div>'+trial_card+'</div><div>'+pay_block+'</div></div>',True)}
      {st('sub','trialsub',trial_sub_card)}
      {st('sub','active',active_card+history)}
      {st('sub','pastdue',pastdue_card+history)}
      {st('sub','cancel',cancel_card+history)}
      {st('sub','play',play_card)}''')

# ---------------------------------------------------------------- ADMIN: METRİKLER
def stat(label, val, meta, breach=False):
    ds = ' data-status="breach"' if breach else ''
    return f'<div class="stat"{ds}><div class="stat-label">{label}</div><div class="stat-value">{val}</div><div class="stat-meta">{meta}</div></div>'
jobs = ''.join(f'''<tr><td class="cell-primary"><span class="cell-title">{n}</span><div class="subtle">{d}</div></td><td data-label="Son çalışma" class="num">{last}</td><td class="cell-actions"><button class="btn btn-{"danger" if danger else "secondary"} btn-sm" data-dialog-open="dlg-job" data-name="{n}">{ic('play')}Çalıştır</button></td></tr>'''
    for n,d,last,danger in [('Arkadaş önerileri','Gece 03:00 · tüm kullanıcılar','27 Kas 03:00',False),('Geri bildirim özeti','Haftalık','24 Kas 04:00',False),('Sezon sıfırlama','6 ayda bir · herkes 2 seviye düşer','23 Haz 04:00',True),('Trial hatırlatması','Günlük 10:00','27 Kas 10:00',False)])
app_page('admin-metrikler.html', 'Metrikler · Eatlas Admin', 'admin', 'admin-metrikler.html', 'Sistem Yöneticisi', f'''
      <div class="page-head"><div><h1>Metrikler</h1><p>Bu değerler isteği karşılayan sunucu kopyasına aittir (replica başına).</p></div><button class="btn btn-secondary">Yenile</button></div>
      <div class="alert alert-danger" role="alert">{ic('alert')}<div class="alert-body"><strong>1 alarm aktif</strong>Google günlük maliyeti eşiği aştı: 31,40 $ / 30 $.</div></div>
      <h2 class="section-title">İstek ve altyapı</h2>
      <div class="grid grid-stats">
        {stat('p95 yanıt süresi','182 ms','p50 48 ms · p99 640 ms')}
        {stat('Hata oranı','%0,4','eşik %2 · <span class="badge badge-success">Normal</span>')}
        {stat('Redis isabet','%87','12.840 isabet / 1.910 ıska')}
        {stat('Event loop gecikmesi','14 ms','eşik 200 ms · <span class="badge badge-success">Normal</span>')}
        {stat('DB bağlantısı','23','pg_stat_activity')}
      </div>
      <h2 class="section-title">Günlük dış servis maliyeti</h2>
      <div class="grid grid-stats">
        {stat('Anthropic','18,20 $','eşik 50 $ · 2.304 çağrı')}
        {stat('Google Places','31,40 $','eşik 30 $ · <span class="badge badge-danger">Eşik aşıldı</span>',True)}
      </div>
      <h2 class="section-title">Platform</h2>
      <div class="grid grid-stats">
        {stat('Toplam kullanıcı','10.482','bugün +64 kayıt')}{stat('Bugün giriş yapan','2.931','')}{stat('Onaylı restoran','212','4 bekleyen başvuru')}{stat('Toplam yorum','18.776','')}
      </div>
      <div class="card card-flush section" id="joblar"><div class="card-header" style="padding:16px 20px 0"><h2 style="font-size:var(--fs-lg)">Joblar</h2><span class="subtle">Elle tetikleme kilitsiz çalışır</span></div>
        <table class="table table-stack"><thead><tr><th>Job</th><th>Son çalışma</th><th class="cell-actions">İşlem</th></tr></thead><tbody>{jobs}</tbody></table></div>
      <dialog class="modal" id="dlg-job" aria-labelledby="job-t"><form method="dialog">
        <div class="modal-header"><h2 id="job-t" style="font-size:var(--fs-lg)">Job çalıştırılsın mı?</h2></div>
        <div class="modal-body"><p><strong data-fill="name"></strong> şimdi çalıştırılacak. Bu işlem denetim kaydına yazılır.</p></div>
        <div class="modal-footer"><button class="btn btn-secondary" value="cancel">Vazgeç</button><button class="btn btn-primary" value="ok">Çalıştır</button></div></form></dialog>''')

# ---------------------------------------------------------------- ADMIN: ONAYLAR
APPS = [('Kebapçı Dürüm Evi','Ayşe Yılmaz','1234567890','Kadıköy','27 Kas','PENDING'),('Moda Kahve','Kerem Ak','9876543210','Kadıköy','26 Kas','PENDING'),('Ege Meyhanesi','Deniz Er','1122334455','Beşiktaş','25 Kas','PENDING'),('Pide Salonu','Hakan Su','5566778899','Üsküdar','25 Kas','PENDING'),('Lezzet Durağı','Ece Kar','4433221100','Şişli','20 Kas','APPROVED'),('Hızlı Burger','Ozan Tek','1010101010','Ataşehir','18 Kas','REJECTED')]
AB = {'PENDING':('Bekliyor','badge-warning'),'APPROVED':('Onaylı','badge-success'),'REJECTED':('Reddedildi','badge-danger')}
arows = ''.join(f'''<tr data-status-row="{s}"{"" if s=="PENDING" else " hidden"}><td class="cell-primary"><span class="cell-title">{n}</span><div class="subtle">{o}</div></td><td data-label="Vergi no" class="num">{v}</td><td data-label="Semt">{c}</td><td data-label="Başvuru" class="num">{d}</td><td data-label="Durum"><span class="badge {AB[s][1]}">{AB[s][0]}</span></td><td class="cell-actions"><button class="btn btn-secondary btn-sm" data-dialog-open="dlg-basvuru" data-name="{n}" data-owner="{o}" data-tax="{v}">İncele</button></td></tr>''' for n,o,v,c,d,s in APPS)
atabs = ''.join(f'<button class="tab" role="tab" aria-selected="{"true" if k=="PENDING" else "false"}" tabindex="{0 if k=="PENDING" else -1}" data-filter="{k}">{l}<span class="count">{c}</span></button>' for k,l,c in [('PENDING','Bekleyen',4),('APPROVED','Onaylı',1),('REJECTED','Reddedilen',1)])
app_page('admin-onaylar.html', 'Restoran Onayları · Eatlas Admin', 'admin', 'admin-onaylar.html', 'Sistem Yöneticisi', f'''
      <div class="page-head"><div><h1>Restoran onayları</h1><p>Onaylanan restoranda 15 günlük deneme otomatik başlar.</p></div></div>
      <div class="tabs" role="tablist" aria-label="Başvuru durumu">{atabs}</div>
      <div class="card card-flush"><table class="table table-stack"><caption class="sr-only">Restoran başvuruları</caption><thead><tr><th>İşletme</th><th>Vergi no</th><th>Semt</th><th>Başvuru</th><th>Durum</th><th class="cell-actions">İşlem</th></tr></thead><tbody>{arows}</tbody></table></div>
      <dialog class="modal" id="dlg-basvuru" aria-labelledby="bs-t" style="width:min(640px,calc(100% - 32px))"><form method="dialog">
        <div class="modal-header"><h2 id="bs-t" style="font-size:var(--fs-lg)" data-fill="name">Başvuru</h2><button class="btn btn-ghost btn-icon" value="cancel" aria-label="Kapat">{ic('x')}</button></div>
        <div class="modal-body stack">
          <dl class="summary"><dt>Yetkili</dt><dd data-fill="owner"></dd><dt>Vergi no</dt><dd class="num" data-fill="tax"></dd><dt>Vergi dairesi</dt><dd>Kadıköy</dd><dt>Telefon</dt><dd class="num">0532 000 00 00</dd><dt>Hesap e-postası</dt><dd>ayse@kebapci.com</dd><dt>Google eşleşmesi</dt><dd>Kebapçı Dürüm Evi · Moda Cd. 112</dd></dl>
          <div><div class="label" style="margin-bottom:6px">Vergi levhası</div><div class="payment-slot" style="min-height:180px">{ic('book')}<span class="subtle">Levha önizlemesi (görsel / PDF)</span></div></div>
          <div class="field"><label class="label" for="not">İşlem notu <span class="opt">(onayda isteğe bağlı, redde zorunlu)</span></label><textarea class="textarea" id="not" placeholder="İşlem notu"></textarea></div>
        </div>
        <div class="modal-footer"><button class="btn btn-danger" value="reject">Reddet</button><button class="btn btn-success" value="ok">Onayla</button></div></form></dialog>''')

# ---------------------------------------------------------------- ADMIN: KULLANICILAR
USERS = [('Zeynep Arslan','zeynep@ornek.com','Kullanıcı','L4','Aktif','12 Mar 2026'),('Ayşe Yılmaz','ayse@kebapci.com','Restoran','—','Aktif','27 Kas 2026'),('Burak Çelik','burak@ornek.com','Kullanıcı','L2','Askıda','3 Eyl 2026'),('Elif Şahin','elif@ornek.com','Kullanıcı','L5','Aktif','8 Oca 2026'),('Deniz E.','deniz@eatlastr.com','Admin','—','Aktif','1 Oca 2026')]
urows = ''
for n,e,r,l,s,d in USERS:
    b = 'badge-success' if s=='Aktif' else 'badge-danger'
    act = '' if r=='Admin' else (f'<button class="btn btn-secondary btn-sm" data-dialog-open="dlg-askiya" data-name="{n}">Askıya al</button>' if s=='Aktif' else '<button class="btn btn-secondary btn-sm">Etkinleştir</button>')
    urows += f'<tr><td class="cell-primary"><span class="cell-title">{n}</span><div class="subtle">{e}</div></td><td data-label="Rol">{r}</td><td data-label="Seviye">{l}</td><td data-label="Durum"><span class="badge {b}">{s}</span></td><td data-label="Kayıt" class="num">{d}</td><td class="cell-actions">{act or "<span class=subtle>—</span>"}</td></tr>'
app_page('admin-kullanicilar.html', 'Kullanıcılar · Eatlas Admin', 'admin', 'admin-kullanicilar.html', 'Sistem Yöneticisi', f'''
      <div class="page-head"><div><h1>Kullanıcılar</h1><p>10.482 hesap</p></div></div>
      <div class="card" style="margin-bottom:16px"><div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(min(100%,200px),1fr))">
        <div class="field"><label class="label" for="q">Ara</label><div class="input-group"><input class="input" id="q" type="search" placeholder="Ad veya e-posta"><span class="input-action" style="display:grid;place-items:center">{ic('search')}</span></div></div>
        <div class="field" style="margin:0"><label class="label" for="rol">Rol</label><select class="select" id="rol"><option>Tümü</option><option>Kullanıcı</option><option>Restoran</option><option>Admin</option></select></div>
        <div class="field" style="margin:0"><label class="label" for="dur">Durum</label><select class="select" id="dur"><option>Tümü</option><option>Aktif</option><option>Askıda</option></select></div></div></div>
      <div class="card card-flush"><table class="table table-stack"><caption class="sr-only">Kullanıcı listesi</caption><thead><tr><th>Kullanıcı</th><th>Rol</th><th>Seviye</th><th>Durum</th><th>Kayıt</th><th class="cell-actions">İşlem</th></tr></thead><tbody>{urows}</tbody></table></div>
      <nav class="row-between section" aria-label="Sayfalama"><span class="subtle">1-5 / 10.482</span><div class="row"><button class="btn btn-secondary" disabled>{ic('chev-l')}Önceki</button><button class="btn btn-secondary">Sonraki{ic('chev-r')}</button></div></nav>
      <dialog class="modal" id="dlg-askiya" aria-labelledby="ask-t"><form method="dialog">
        <div class="modal-header"><h2 id="ask-t" style="font-size:var(--fs-lg)">Hesabı askıya al</h2></div>
        <div class="modal-body stack"><p><strong data-fill="name"></strong> giriş yapamayacak; açık oturumları kapatılır.</p>
          <div class="field"><label class="label" for="ask-n">Neden</label><textarea class="textarea" id="ask-n" placeholder="Denetim kaydına yazılır"></textarea></div></div>
        <div class="modal-footer"><button class="btn btn-secondary" value="cancel">Vazgeç</button><button class="btn btn-danger" value="ok">Askıya al</button></div></form></dialog>''')

# ---------------------------------------------------------------- ADMIN: LOGLAR
LOGS = [('27 Kas 14:02:11','Uyarı','badge-warning','LOGIN_FAILED','burak@ornek.com','85.105.x.x','a1f3…9c'),('27 Kas 13:58:40','Bilgi','badge-info','RESTAURANT_APPROVED','deniz@eatlastr.com','—','7be2…01'),('27 Kas 13:40:02','Kritik','badge-danger','METRICS_ALARM','sistem','—','job:metrics'),('27 Kas 12:11:19','Bilgi','badge-info','PASSWORD_RESET','elif@ornek.com','78.180.x.x','c9d0…44'),('27 Kas 04:00:00','Bilgi','badge-info','SEASON_RESET','sistem','—','job:seasonReset')]
lrows = ''.join(f'<tr><td class="cell-primary"><span class="cell-title log">{ev}</span><div class="subtle num">{t}</div></td><td data-label="Seviye"><span class="badge {b}">{lv}</span></td><td data-label="Kullanıcı">{u}</td><td data-label="IP" class="log">{ip}</td><td data-label="İstek" class="log">{rq}</td></tr>' for t,lv,b,ev,u,ip,rq in LOGS)
app_page('admin-loglar.html', 'Loglar · Eatlas Admin', 'admin', 'admin-loglar.html', 'Sistem Yöneticisi', f'''
      <div class="page-head"><div><h1>Loglar</h1><p>Güvenlik ve denetim olayları.</p></div><button class="btn btn-secondary">Dışa aktar (CSV)</button></div>
      <div class="card" style="margin-bottom:16px"><div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(min(100%,180px),1fr))">
        <div class="field" style="margin:0"><label class="label" for="lq">E-posta</label><input class="input" id="lq" type="search" placeholder="E-posta ara"></div>
        <div class="field" style="margin:0"><label class="label" for="lv">Seviye</label><select class="select" id="lv"><option>Tümü</option><option>Bilgi</option><option>Uyarı</option><option>Kritik</option></select></div>
        <div class="field" style="margin:0"><label class="label" for="l1">Başlangıç</label><input class="input" id="l1" type="date"></div>
        <div class="field" style="margin:0"><label class="label" for="l2">Bitiş</label><input class="input" id="l2" type="date"></div></div></div>
      <div class="card card-flush"><table class="table table-stack"><caption class="sr-only">Log kayıtları</caption><thead><tr><th>Olay</th><th>Seviye</th><th>Kullanıcı</th><th>IP</th><th>İstek kimliği</th></tr></thead><tbody>{lrows}</tbody></table></div>
      <nav class="row-between section" aria-label="Sayfalama"><span class="subtle">Son 50 kayıt</span><button class="btn btn-secondary">Daha fazla yükle</button></nav>''')
