'use strict';

/**
 * Anket sonuç çekirdeği — saf, DB yok (S23-2).
 *
 * Kazananın yanlış hesaplanması grubu yanlış restorana yönlendirir ve hiçbir hata üretmez.
 * Beraberlik gibi kenar durumları HTTP akışı ayağa kaldırılmadan test edilebilmeli.
 */

/** Bir seçeneğin YES oy sayısı. */
function countYesVotes(option) {
  return (option?.votes || []).filter((v) => v.vote === 'YES').length;
}

/**
 * En çok YES alan seçeneği bulur.
 *
 * BERABERLİK KURALI: eşitlikte İLK seçenek kazanır. Çağrı yeri seçenekleri `addedAt asc`
 * sırasıyla getirdiğinden bu "önce eklenen kazanır" anlamına gelir — deterministik ve
 * mevcut davranışla birebir aynı (kıyas `>` ile yapılır, `>=` değil).
 *
 * `maxYes` ayrıca döner: çağrı yeri "hiç YES yoksa kazanan duyurma" kararı için kullanır.
 *
 * @param {Array<{votes?: Array<{vote: string}>}>} options
 * @returns {{ winner: object|null, maxYes: number }} boş listede `{ winner: null, maxYes: -1 }`
 */
function computePollWinner(options) {
  let winner = null;
  let maxYes = -1;
  for (const opt of options || []) {
    const yesCount = countYesVotes(opt);
    if (yesCount > maxYes) {
      maxYes = yesCount;
      winner = opt;
    }
  }
  return { winner, maxYes };
}

module.exports = { computePollWinner, countYesVotes };
