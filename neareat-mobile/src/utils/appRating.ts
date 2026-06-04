// #256 — Uygulama içi (Eatlas) puan ortalaması + oy sayısı.
// Restoran detayında zaten çekilen appReviews dizisinden hesaplanır (backend yok).

export interface AppRating {
  /** Ortalama puan (oy yoksa 0). */
  avg: number;
  /** Oy (yorum) sayısı. */
  count: number;
}

export function computeAppRating(reviews: { rating: number }[]): AppRating {
  const count = reviews.length;
  if (count === 0) return { avg: 0, count: 0 };
  const sum = reviews.reduce((s, r) => s + (r.rating || 0), 0);
  return { avg: sum / count, count };
}
