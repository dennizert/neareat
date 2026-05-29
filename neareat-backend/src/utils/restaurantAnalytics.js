/**
 * Restoran analitik — saf hesaplama çekirdeği (Sprint-5 Task #5).
 * DB'siz, test edilebilir. Controller DB'den çeker, bunlara verir.
 */

const RESERVATION_STATUSES = ['PENDING', 'CONFIRMED', 'REJECTED', 'CANCELLED', 'COMPLETED'];

/** now → Türkiye saati "YYYY-MM-DD". */
function turkeyDateStr(date) {
  return new Date(date.getTime() + 3 * 60 * 60 * 1000).toISOString().split('T')[0];
}

/** Bugünden geriye n günün TR tarih dizisi (eski→yeni). */
function lastNDates(now, n) {
  const out = [];
  for (let i = n - 1; i >= 0; i--) {
    out.push(turkeyDateStr(new Date(now.getTime() - i * 24 * 60 * 60 * 1000)));
  }
  return out;
}

/**
 * Rezervasyon analitiği.
 * @param {Array<{date:string,time:string,status:string,attended:boolean|null}>} reservations
 * @param {Date} now
 */
function computeReservationAnalytics(reservations, now = new Date()) {
  const windowDates = lastNDates(now, 7);
  const windowSet = new Set(windowDates);
  const byDate = Object.fromEntries(windowDates.map((d) => [d, 0]));
  const hourCounts = {};
  const statusBreakdown = Object.fromEntries(RESERVATION_STATUSES.map((s) => [s, 0]));
  let attended = 0;
  let noShow = 0;

  for (const r of reservations || []) {
    if (statusBreakdown[r.status] != null) statusBreakdown[r.status] += 1;
    const active = r.status !== 'CANCELLED' && r.status !== 'REJECTED';

    if (active && windowSet.has(r.date)) byDate[r.date] += 1;

    if (active && typeof r.time === 'string' && r.time.includes(':')) {
      const hour = r.time.split(':')[0].padStart(2, '0');
      hourCounts[hour] = (hourCounts[hour] || 0) + 1;
    }

    if (r.attended === true) attended += 1;
    else if (r.attended === false) noShow += 1;
  }

  const trend = windowDates.map((d) => ({ date: d, count: byDate[d] }));

  const busiestHours = Object.entries(hourCounts)
    .map(([hour, count]) => ({ hour, count }))
    .sort((a, b) => b.count - a.count || a.hour.localeCompare(b.hour))
    .slice(0, 5);

  const attendanceTotal = attended + noShow;
  const attendanceRate = attendanceTotal > 0 ? Number((attended / attendanceTotal).toFixed(2)) : null;

  return {
    totalReservations: (reservations || []).length,
    trend,
    busiestHours,
    statusBreakdown,
    attendanceRate,
  };
}

/**
 * Yorum analitiği.
 * @param {number[]} ratings - review rating'leri (1-5)
 */
function computeReviewAnalytics(ratings) {
  const list = (ratings || []).filter((r) => typeof r === 'number');
  const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  let sum = 0;
  for (const r of list) {
    const k = Math.min(5, Math.max(1, Math.round(r)));
    distribution[k] += 1;
    sum += r;
  }
  const reviewCount = list.length;
  const avgRating = reviewCount > 0 ? Number((sum / reviewCount).toFixed(1)) : null;
  return { reviewCount, avgRating, distribution };
}

module.exports = {
  RESERVATION_STATUSES,
  turkeyDateStr,
  lastNDates,
  computeReservationAnalytics,
  computeReviewAnalytics,
};
