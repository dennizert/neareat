'use strict';

/**
 * Anket sonuç çekirdeği (S23-2) — saf, DB yok.
 *
 * Kazananın yanlış hesaplanması grubu yanlış restorana yönlendirir ve hiçbir hata üretmez;
 * bu yüzden beraberlik ve sıfır-oy gibi kenar durumlar doğrudan sabitlenir.
 */

const { computePollWinner, countYesVotes } = require('../../../src/utils/pollResult');

/** Test kısayolu: verilen oy dizisiyle bir seçenek üretir. */
function option(placeName, votes = []) {
  return { placeName, votes: votes.map((vote) => ({ vote })) };
}

describe('countYesVotes', () => {
  it('yalnızca YES oylarını sayar', () => {
    expect(countYesVotes(option('A', ['YES', 'NO', 'MAYBE', 'YES']))).toBe(2);
  });

  it('oy yoksa 0', () => {
    expect(countYesVotes(option('A'))).toBe(0);
  });

  it('votes alanı yoksa/null ise çökmez', () => {
    expect(countYesVotes({})).toBe(0);
    expect(countYesVotes(null)).toBe(0);
  });
});

describe('computePollWinner', () => {
  it('en çok YES alan seçenek kazanır', () => {
    const opts = [
      option('A', ['YES']),
      option('B', ['YES', 'YES']),
      option('C', ['NO']),
    ];
    const { winner, maxYes } = computePollWinner(opts);
    expect(winner.placeName).toBe('B');
    expect(maxYes).toBe(2);
  });

  it('BERABERLİKTE ilk seçenek kazanır (önce eklenen)', () => {
    const opts = [
      option('İlk', ['YES', 'YES']),
      option('Sonra', ['YES', 'YES']),
    ];
    expect(computePollWinner(opts).winner.placeName).toBe('İlk');
  });

  it('hiç YES yoksa ilk seçenek döner ama maxYes 0 olur', () => {
    // Çağrı yeri `maxYes > 0` kontrolüyle "kazanan duyurma" kararını verir.
    const opts = [option('A', ['NO']), option('B', ['MAYBE'])];
    const { winner, maxYes } = computePollWinner(opts);
    expect(winner.placeName).toBe('A');
    expect(maxYes).toBe(0);
  });

  it('hiç oy yoksa da ilk seçenek + maxYes 0', () => {
    const { winner, maxYes } = computePollWinner([option('A'), option('B')]);
    expect(winner.placeName).toBe('A');
    expect(maxYes).toBe(0);
  });

  it('boş seçenek listesinde kazanan yok', () => {
    expect(computePollWinner([])).toEqual({ winner: null, maxYes: -1 });
  });

  it('null/undefined girdide çökmez', () => {
    expect(computePollWinner(null)).toEqual({ winner: null, maxYes: -1 });
    expect(computePollWinner(undefined)).toEqual({ winner: null, maxYes: -1 });
  });

  it('NO/MAYBE oyları kazananı etkilemez', () => {
    const opts = [
      option('A', ['NO', 'NO', 'NO', 'MAYBE']),
      option('B', ['YES']),
    ];
    expect(computePollWinner(opts).winner.placeName).toBe('B');
  });
});
