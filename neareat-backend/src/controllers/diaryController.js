/**
 * Kişisel Yemek Günlüğü kontrolcüsü (Sprint-7 #93).
 *
 * - POST   /api/diary       — yeni günlük girdisi (sadece sahibe görünür)
 * - GET    /api/diary       — günlük girdileri (visitedAt desc, sayfalı)
 * - DELETE /api/diary/:id   — sahip kontrollü silme
 * - GET    /api/diary/stats — Spotify-Wrapped tarzı yıllık özet
 *
 * Stats çekirdeği `computeDiaryStats` saf fonksiyon, ayrı export edilir → unit test.
 */

const prisma = require('../utils/prisma');
const { deriveCuisineTags } = require('../utils/cuisineTags');

const MAX_ENTRIES_PER_PAGE = 30;
const MAX_NOTE_LENGTH = 500;

/**
 * Saf stats hesabı — girdi listesini alır, agregeler.
 * @param {Array<{ visitedAt: Date|string, placeId: string, placeName: string, placeTypes?: string[] }>} entries
 * @returns {{
 *   totalEntries: number,
 *   uniquePlaces: number,
 *   topCuisineTags: Array<{ tag: string, count: number }>,
 *   topPlaces: Array<{ placeId: string, placeName: string, count: number }>,
 *   monthlyCount: Array<{ month: string, count: number }>,
 *   firstVisit: string|null,
 *   lastVisit: string|null,
 * }}
 */
function computeDiaryStats(entries) {
  const uniquePlaceIds = new Set();
  const tagCounts = new Map();
  const placeCounts = new Map(); // placeId → { name, count }
  const monthCounts = new Map();
  let first = null;
  let last = null;

  for (const e of entries) {
    uniquePlaceIds.add(e.placeId);

    const tags = deriveCuisineTags({ name: e.placeName, types: e.placeTypes || [] });
    for (const t of tags) tagCounts.set(t, (tagCounts.get(t) || 0) + 1);

    const cur = placeCounts.get(e.placeId) || { name: e.placeName, count: 0 };
    cur.count += 1;
    placeCounts.set(e.placeId, cur);

    const dt = e.visitedAt instanceof Date ? e.visitedAt : new Date(e.visitedAt);
    const ym = dt.toISOString().slice(0, 7); // "YYYY-MM"
    monthCounts.set(ym, (monthCounts.get(ym) || 0) + 1);

    if (!first || dt < first) first = dt;
    if (!last || dt > last) last = dt;
  }

  const topCuisineTags = [...tagCounts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 5)
    .map(([tag, count]) => ({ tag, count }));

  const topPlaces = [...placeCounts.entries()]
    .sort((a, b) => b[1].count - a[1].count || a[1].name.localeCompare(b[1].name))
    .slice(0, 5)
    .map(([placeId, { name, count }]) => ({ placeId, placeName: name, count }));

  const monthlyCount = [...monthCounts.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([month, count]) => ({ month, count }));

  return {
    totalEntries: entries.length,
    uniquePlaces: uniquePlaceIds.size,
    topCuisineTags,
    topPlaces,
    monthlyCount,
    firstVisit: first ? first.toISOString() : null,
    lastVisit: last ? last.toISOString() : null,
  };
}

async function addDiaryEntry(req, res, next) {
  try {
    const placeId = String(req.body?.placeId || '').trim();
    const placeName = String(req.body?.placeName || '').trim().slice(0, 200);
    const placePhotoUrl = req.body?.placePhotoUrl
      ? String(req.body.placePhotoUrl).trim().slice(0, 600)
      : null;
    const placeTypes = Array.isArray(req.body?.placeTypes)
      ? req.body.placeTypes.map((t) => String(t).trim()).filter(Boolean).slice(0, 20)
      : [];
    const note = req.body?.note
      ? String(req.body.note).trim().slice(0, MAX_NOTE_LENGTH)
      : null;
    const visitedAt = req.body?.visitedAt ? new Date(req.body.visitedAt) : new Date();

    if (!placeId) return res.status(400).json({ error: 'placeId gerekli' });
    if (!placeName) return res.status(400).json({ error: 'placeName gerekli' });
    if (Number.isNaN(visitedAt.getTime())) return res.status(400).json({ error: 'visitedAt geçersiz' });

    const entry = await prisma.diaryEntry.create({
      data: {
        userId: req.user.id,
        placeId, placeName, placePhotoUrl, placeTypes, visitedAt, note,
      },
      select: {
        id: true, placeId: true, placeName: true, placePhotoUrl: true,
        placeTypes: true, visitedAt: true, note: true, createdAt: true,
      },
    });
    res.status(201).json(entry);
  } catch (err) {
    next(err);
  }
}

async function listDiaryEntries(req, res, next) {
  try {
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const limit = Math.min(parseInt(req.query.limit) || MAX_ENTRIES_PER_PAGE, MAX_ENTRIES_PER_PAGE);

    const [items, total] = await Promise.all([
      prisma.diaryEntry.findMany({
        where: { userId: req.user.id },
        orderBy: { visitedAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true, placeId: true, placeName: true, placePhotoUrl: true,
          placeTypes: true, visitedAt: true, note: true, createdAt: true,
        },
      }),
      prisma.diaryEntry.count({ where: { userId: req.user.id } }),
    ]);
    res.json({ items, total, page, limit });
  } catch (err) {
    next(err);
  }
}

async function deleteDiaryEntry(req, res, next) {
  try {
    const { id } = req.params;
    const { count } = await prisma.diaryEntry.deleteMany({
      where: { id, userId: req.user.id },
    });
    if (count === 0) return res.status(404).json({ error: 'Kayıt bulunamadı' });
    res.status(204).end();
  } catch (err) {
    next(err);
  }
}

async function getDiaryStats(req, res, next) {
  try {
    const entries = await prisma.diaryEntry.findMany({
      where: { userId: req.user.id },
      select: { placeId: true, placeName: true, placeTypes: true, visitedAt: true },
    });
    res.json(computeDiaryStats(entries));
  } catch (err) {
    next(err);
  }
}

module.exports = {
  addDiaryEntry,
  listDiaryEntries,
  deleteDiaryEntry,
  getDiaryStats,
  computeDiaryStats,
  MAX_NOTE_LENGTH,
};
