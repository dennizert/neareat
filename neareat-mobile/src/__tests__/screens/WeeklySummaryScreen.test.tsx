import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';

// #249 — Haftalık Özet ekranı (alınan tavsiyeler + bu hafta sayımı + mekana geçiş)

const mockNavigate = jest.fn();
const mockGetReceived = jest.fn();

jest.mock('@react-navigation/native', () => ({ useNavigation: () => ({ navigate: mockNavigate }) }));
jest.mock('../../services/social', () => ({ getReceivedRecommendations: () => mockGetReceived() }));

import WeeklySummaryScreen from '../../screens/social/WeeklySummaryScreen';

function makeRec(over: any = {}) {
  return {
    id: 'rec1',
    fromUserId: 'u1',
    fromProfile: { id: 'u1', displayName: 'Ayşe', photoUrl: null },
    toUserId: 'me',
    message: 'Harika bir yer!',
    createdAt: new Date().toISOString(),
    restaurant: { placeId: 'p1', name: 'Test Lokanta', rating: 4.5, photoUrl: null },
    ...over,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
});

// Ekran, mount'ta async veri çeker (getReceivedRecommendations) ve giriş animasyonu
// çalıştırır. Yavaş CI runner'larında ilk testin soğuk başlangıcı findBy'ın varsayılan
// 1000ms timeout'unu aşabildiğinden cömert bir timeout veriyoruz (deterministiklik).
const FIND_OPTS = { timeout: 10000 } as const;

describe('WeeklySummaryScreen', () => {
  it('alınan tavsiyeleri render eder', async () => {
    mockGetReceived.mockResolvedValue([makeRec()]);
    render(<WeeklySummaryScreen />);
    expect(await screen.findByText('Test Lokanta', {}, FIND_OPTS)).toBeTruthy();
  });

  it('bu hafta gelen tavsiye sayısını özet başlıkta gösterir', async () => {
    const old = makeRec({ id: 'rec2', createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString() });
    mockGetReceived.mockResolvedValue([makeRec(), old]);
    render(<WeeklySummaryScreen />);
    expect(await screen.findByText('Bu hafta 1 restoran tavsiyesi aldın', {}, FIND_OPTS)).toBeTruthy();
  });

  it('karta basınca RestaurantDetail açılır', async () => {
    mockGetReceived.mockResolvedValue([makeRec()]);
    render(<WeeklySummaryScreen />);
    fireEvent.press(await screen.findByText('Test Lokanta', {}, FIND_OPTS));
    expect(mockNavigate).toHaveBeenCalledWith('RestaurantDetail', { placeId: 'p1' });
  });

  it('hiç tavsiye yoksa boş durum gösterir', async () => {
    mockGetReceived.mockResolvedValue([]);
    render(<WeeklySummaryScreen />);
    await waitFor(() => expect(screen.getByText('Henüz tavsiye almadın')).toBeTruthy(), { timeout: 10000 });
  });
});
