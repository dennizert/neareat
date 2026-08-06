/**
 * S25-1 bağımlılık kapısının karar çekirdeği.
 *
 * Bu testler kapının KENDİSİNİ koruyor. Yanlış çalışan bir güvenlik kapısının en kötü
 * hâli yanlış-NEGATİF: sessizce yeşil kalır ve kimse bir şey olmadığını fark etmez.
 * Bu yüzden "bloklamalı" senaryolar en az "geçirmeli" senaryolar kadar ayrıntılı.
 */

const {
  evaluateAudit,
  validateEntry,
} = require('../auditGate');

const GELECEK = '2099-01-01';
const GECMIS = '2000-01-01';

/** `npm audit --json` çıktısının test için gereken en küçük biçimi. */
function auditWith(...findings: Array<{ name: string; severity: string }>) {
  return {
    vulnerabilities: Object.fromEntries(findings.map((f) => [f.name, f])),
  };
}

function entry(over: Record<string, unknown> = {}) {
  return {
    package: 'tar',
    severity: 'critical',
    chain: 'expo → @expo/cli → cacache → tar',
    reason: 'Derleme zinciri; APK\'ya girmiyor.',
    reviewBy: GELECEK,
    ...over,
  };
}

describe('evaluateAudit — bloklama kararı', () => {
  it('allowlist\'te olmayan bulgu KAPIYI KIRAR', () => {
    const { blocking, allowed } = evaluateAudit({
      auditJson: auditWith({ name: 'axios', severity: 'high' }),
      allowlist: { entries: [] },
    });

    expect(blocking).toEqual([{ package: 'axios', severity: 'high', why: 'not-allowlisted' }]);
    expect(allowed).toHaveLength(0);
  });

  it('gerekçeli ve süresi geçmemiş muafiyet GEÇİRİR', () => {
    const { blocking, allowed } = evaluateAudit({
      auditJson: auditWith({ name: 'tar', severity: 'critical' }),
      allowlist: { entries: [entry()] },
      now: new Date('2026-08-06'),
    });

    expect(blocking).toHaveLength(0);
    expect(allowed[0]).toMatchObject({ package: 'tar', reviewBy: GELECEK });
  });

  it('süresi GEÇMİŞ muafiyet yeniden bloklar — süresiz af yok', () => {
    const { blocking } = evaluateAudit({
      auditJson: auditWith({ name: 'tar', severity: 'critical' }),
      allowlist: { entries: [entry({ reviewBy: GECMIS })] },
      now: new Date('2026-08-06'),
    });

    expect(blocking[0]).toMatchObject({ package: 'tar', why: 'expired' });
  });

  it('bulgunun şiddeti muafiyet verilenden YÜKSELDİYSE bloklar', () => {
    // Muafiyet 'high' için verilmişti; advisory yeniden puanlanıp 'critical' oldu.
    const { blocking } = evaluateAudit({
      auditJson: auditWith({ name: 'tar', severity: 'critical' }),
      allowlist: { entries: [entry({ severity: 'high' })] },
      now: new Date('2026-08-06'),
    });

    expect(blocking[0]).toMatchObject({ package: 'tar', why: 'severity-escalated' });
  });

  it('şiddeti DÜŞMÜŞ bulgu muafiyeti bozmaz', () => {
    const { blocking, allowed } = evaluateAudit({
      auditJson: auditWith({ name: 'tar', severity: 'high' }),
      allowlist: { entries: [entry({ severity: 'critical' })] },
      now: new Date('2026-08-06'),
    });

    expect(blocking).toHaveLength(0);
    expect(allowed).toHaveLength(1);
  });

  it('gerekçesi silinmiş kayıt muafiyet ÜRETMEZ (sessizce gevşeme yok)', () => {
    const bozuk = entry();
    delete (bozuk as Record<string, unknown>).reason;

    const { blocking } = evaluateAudit({
      auditJson: auditWith({ name: 'tar', severity: 'critical' }),
      allowlist: { entries: [bozuk] },
      now: new Date('2026-08-06'),
    });

    expect(blocking[0]).toMatchObject({ package: 'tar', why: 'invalid-entry' });
    expect(blocking[0].detail).toContain('reason');
  });

  it('eşiğin ALTINDAKİ bulgular dikkate alınmaz', () => {
    const { blocking, allowed } = evaluateAudit({
      auditJson: auditWith(
        { name: 'a', severity: 'moderate' },
        { name: 'b', severity: 'low' },
      ),
      allowlist: { entries: [] },
    });

    expect(blocking).toHaveLength(0);
    expect(allowed).toHaveLength(0);
  });

  it('eşik düşürülünce aynı bulgu bloklamaya başlar', () => {
    const { blocking } = evaluateAudit({
      auditJson: auditWith({ name: 'a', severity: 'moderate' }),
      allowlist: { entries: [] },
      level: 'moderate',
    });

    expect(blocking[0]).toMatchObject({ package: 'a', why: 'not-allowlisted' });
  });

  it('birden çok bulgunun her biri ayrı ayrı değerlendirilir', () => {
    const { blocking, allowed } = evaluateAudit({
      auditJson: auditWith(
        { name: 'tar', severity: 'critical' },
        { name: 'axios', severity: 'high' },
      ),
      allowlist: { entries: [entry()] },
      now: new Date('2026-08-06'),
    });

    expect(allowed.map((a: { package: string }) => a.package)).toEqual(['tar']);
    expect(blocking.map((b: { package: string }) => b.package)).toEqual(['axios']);
  });
});

describe('evaluateAudit — çürüyen muafiyetler', () => {
  it('karşılığı kalmayan muafiyet raporlanır ama BLOKLAMAZ', () => {
    const { blocking, stale } = evaluateAudit({
      auditJson: auditWith(),
      allowlist: { entries: [entry()] },
      now: new Date('2026-08-06'),
    });

    expect(blocking).toHaveLength(0);
    expect(stale).toEqual(['tar']);
  });
});

describe('evaluateAudit — sınır durumlar', () => {
  it('boş audit çıktısı ve boş allowlist güvenle geçer', () => {
    expect(evaluateAudit({ auditJson: {}, allowlist: {} })).toEqual({
      blocking: [],
      allowed: [],
      stale: [],
    });
  });

  it('bilinmeyen eşik seviyesi sessizce geçmez, hata fırlatır', () => {
    expect(() =>
      evaluateAudit({ auditJson: auditWith(), allowlist: {}, level: 'yok-boyle-bir-seviye' }),
    ).toThrow(/bilinmeyen şiddet seviyesi/);
  });
});

describe('validateEntry', () => {
  it('eksiksiz kayda sorun bulmaz', () => {
    expect(validateEntry(entry())).toBeNull();
  });

  it.each(['package', 'severity', 'chain', 'reason', 'reviewBy'])(
    '"%s" alanı eksikse kaydı geçersiz sayar',
    (field) => {
      const bozuk = entry();
      delete (bozuk as Record<string, unknown>)[field];
      expect(validateEntry(bozuk)).toContain(field);
    },
  );

  it('geçersiz tarih biçimini yakalar', () => {
    expect(validateEntry(entry({ reviewBy: 'yakında' }))).toMatch(/geçersiz reviewBy/);
  });

  it('bilinmeyen şiddet değerini yakalar', () => {
    expect(validateEntry(entry({ severity: 'çok-kötü' }))).toMatch(/bilinmeyen şiddet/);
  });

  it('nesne olmayan kaydı reddeder', () => {
    expect(validateEntry(null)).toMatch(/nesne değil/);
  });
});

describe('gerçek allowlist dosyası', () => {
  const allowlist = require('../../.audit-allowlist.json');

  it('her kaydı biçimsel olarak geçerli', () => {
    for (const e of allowlist.entries) {
      expect({ paket: e.package, sorun: validateEntry(e) }).toEqual({
        paket: e.package,
        sorun: null,
      });
    }
  });

  it('hiçbir kaydın gözden geçirme tarihi geçmiş değil', () => {
    // Bu test, allowlist'in unutulup çürümesini engelleyen ikinci kilit: tarih geçtiğinde
    // CI kapısıyla birlikte bu test de kırılır ve neden kırıldığı açıkça görünür.
    const gecmisler = allowlist.entries
      .filter((e: { reviewBy: string }) => new Date(e.reviewBy) < new Date())
      .map((e: { package: string; reviewBy: string }) => `${e.package} (${e.reviewBy})`);

    expect(gecmisler).toEqual([]);
  });

  it('aynı paket için birden çok kayıt yok', () => {
    const isimler = allowlist.entries.map((e: { package: string }) => e.package);
    expect(isimler).toHaveLength(new Set(isimler).size);
  });
});
