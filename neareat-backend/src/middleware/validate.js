// Şema-bazlı input validasyonu (S14-B2).
//
// Neden: Controller'lardaki dağınık `typeof x !== ...` / uzunluk kontrolleri tekrarlı,
// hataya açık ve hata formatı tutarsızdı. validate(schema) tek noktada zod şemasıyla
// req.body'yi doğrular: hata varsa tutarlı 400 { error, details } döner ve controller'a
// hiç girilmez; başarılıysa PARSE EDİLMİŞ (trim/coerce uygulanmış) veriyi req.body'ye yazar.
function validate(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body ?? {});
    if (!result.success) {
      const issues = result.error.issues;
      return res.status(400).json({
        // İlk sorunun mesajı insan-okunur özet (mevcut tek-mesaj formatıyla uyumlu),
        // details ise alan-bazlı tam liste.
        error: issues[0]?.message || 'Geçersiz istek',
        details: issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
      });
    }
    req.body = result.data;
    next();
  };
}

module.exports = validate;
