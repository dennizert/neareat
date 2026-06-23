'use strict';

// S19-2 — koltuk + zaman-dilimi bazlı doluluk çekirdeği (saf).

const {
  toMinutes,
  occupiesSlot,
  seatsOf,
  computeOccupancy,
  occupancyBand,
  availabilityForRequest,
  dailyOccupancySlots,
} = require('../../../src/utils/occupancy');

const TURN = 120; // varsayılan çevrim süresi

describe('toMinutes', () => {
  it('HH:MM → dakika; geçersiz → NaN', () => {
    expect(toMinutes('19:30')).toBe(19 * 60 + 30);
    expect(toMinutes('00:00')).toBe(0);
    expect(Number.isNaN(toMinutes('24:99'))).toBe(true);
    expect(Number.isNaN(toMinutes('abc'))).toBe(true);
  });
});

describe('occupiesSlot ([start, start+turn))', () => {
  it('19:00 rezervasyon (120dk) → 19:00 ve 20:00 işgal, 21:00 değil', () => {
    expect(occupiesSlot('19:00', toMinutes('19:00'), TURN)).toBe(true);
    expect(occupiesSlot('19:00', toMinutes('20:00'), TURN)).toBe(true);
    expect(occupiesSlot('19:00', toMinutes('21:00'), TURN)).toBe(false); // üst sınır dışı
    expect(occupiesSlot('19:00', toMinutes('18:00'), TURN)).toBe(false);
  });
});

describe('seatsOf', () => {
  it('reservedSeats varsa onu, yoksa guestCount', () => {
    expect(seatsOf({ reservedSeats: 6, guestCount: 4 })).toBe(6);
    expect(seatsOf({ reservedSeats: null, guestCount: 4 })).toBe(4);
    expect(seatsOf({ guestCount: 3 })).toBe(3);
  });
});

describe('computeOccupancy', () => {
  const reservations = [
    { time: '19:00', guestCount: 4, reservedSeats: 4 },
    { time: '20:00', guestCount: 2, reservedSeats: 2 },
    { time: '13:00', guestCount: 8, reservedSeats: 8 }, // öğle — akşamı etkilemez
  ];

  it('20:00 diliminde 19:00 ve 20:00 çakışır → 6 koltuk dolu (40 kapasitede %15)', () => {
    const occ = computeOccupancy(reservations, 40, toMinutes('20:00'), TURN);
    expect(occ.reserved).toBe(6);
    expect(occ.free).toBe(34);
    expect(occ.percent).toBe(15);
  });

  it('13:30 diliminde yalnızca öğle rezervasyonu → 8 dolu', () => {
    const occ = computeOccupancy(reservations, 40, toMinutes('13:30'), TURN);
    expect(occ.reserved).toBe(8);
  });

  it('seatCapacity null → free/percent null (bilinmiyor)', () => {
    const occ = computeOccupancy(reservations, null, toMinutes('20:00'), TURN);
    expect(occ.capacity).toBeNull();
    expect(occ.free).toBeNull();
    expect(occ.percent).toBeNull();
  });
});

describe('occupancyBand', () => {
  it('eşiklere göre bant', () => {
    expect(occupancyBand(null)).toBe('unknown');
    expect(occupancyBand(50)).toBe('available');
    expect(occupancyBand(70)).toBe('limited');
    expect(occupancyBand(99)).toBe('limited');
    expect(occupancyBand(100)).toBe('full');
    expect(occupancyBand(120)).toBe('full');
  });
});

describe('availabilityForRequest', () => {
  const reservations = [{ time: '20:00', guestCount: 38, reservedSeats: 38 }];

  it('kapasite 40, 20:00 dolu 38, 4 kişilik talep → yetersiz (enough:false)', () => {
    const r = availabilityForRequest(reservations, 40, '20:00', 4, TURN);
    expect(r.known).toBe(true);
    expect(r.reserved).toBe(38);
    expect(r.enough).toBe(false);
    expect(r.band).toBe('limited'); // 38/40 = %95
  });

  it('2 kişilik talep tam sığar → enough:true', () => {
    const r = availabilityForRequest(reservations, 40, '20:00', 2, TURN);
    expect(r.enough).toBe(true);
  });

  it('seatCapacity null → known:false, enough:true (kapasite kontrolü yok)', () => {
    const r = availabilityForRequest(reservations, null, '20:00', 10, TURN);
    expect(r.known).toBe(false);
    expect(r.enough).toBe(true);
  });
});

describe('dailyOccupancySlots', () => {
  it('saat başı dilimler döndürür, bant içerir', () => {
    const slots = dailyOccupancySlots([{ time: '19:00', guestCount: 40, reservedSeats: 40 }], 40, 18, 22, TURN);
    expect(slots).toHaveLength(4); // 18,19,20,21
    const at19 = slots.find((s) => s.time === '19:00');
    expect(at19.band).toBe('full'); // 40/40
    const at18 = slots.find((s) => s.time === '18:00');
    expect(at18.band).toBe('available'); // boş
  });
});
