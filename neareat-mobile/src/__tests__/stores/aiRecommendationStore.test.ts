/**
 * aiRecommendationStore Tests (Sprint-1 Task #7)
 *
 * Zustand store + service interaction tests.
 * Service layer (`getDinnerRecommendation`) mock'lu — backend gerçek call yok.
 */

// Service'i mock'la — store import edilmeden ÖNCE
jest.mock('../../services/aiRecommendation', () => {
  const actual = jest.requireActual('../../services/aiRecommendation');
  return {
    ...actual,
    getDinnerRecommendation: jest.fn(),
    streamDinnerRecommendation: jest.fn(),
    getRouteRecommendation: jest.fn(),
    postFeedback: jest.fn(),
  };
});

import { useAiRecommendationStore } from '../../store/aiRecommendationStore';
import {
  getDinnerRecommendation,
  streamDinnerRecommendation,
  getRouteRecommendation,
  postFeedback,
  AiRecommendationLimitError,
  AiRecommendationNoCandidatesError,
} from '../../services/aiRecommendation';
import type { AiRecommendationResponse, RouteRecommendationResponse } from '../../types';

const mockedGetDinner = getDinnerRecommendation as jest.MockedFunction<typeof getDinnerRecommendation>;
const mockedStreamDinner = streamDinnerRecommendation as jest.MockedFunction<typeof streamDinnerRecommendation>;
const mockedGetRoute = getRouteRecommendation as jest.MockedFunction<typeof getRouteRecommendation>;
const mockedPostFeedback = postFeedback as jest.MockedFunction<typeof postFeedback>;

// ─── Helpers ─────────────────────────────────────────────────────────────────

const INITIAL_STATE = {
  loading: false,
  recommendations: [],
  noteToUser: '',
  remainingToday: null,
  resetAt: null,
  tier: null,
  error: null,
  limitReached: false,
  noCandidates: false,
  feedbackByPlaceId: {},
  streamingStatus: 'idle' as const,
  abortController: null,
  sessionId: null,
  refining: false,
  routeRecommendations: [],
  routeMeta: null,
  routeNoteToUser: '',
  routeLoading: false,
  routeError: null,
  routeLimitReached: false,
  routeNoCandidates: false,
};

function resetStore() {
  useAiRecommendationStore.setState(INITIAL_STATE);
}

function makeResponse(overrides: Partial<AiRecommendationResponse> = {}): AiRecommendationResponse {
  return {
    recommendations: [
      {
        placeId: 'p1',
        reason: 'Test gerekçesi.',
        restaurant: {
          name: 'Test Place',
          types: ['restaurant'],
          rating: 4.5,
          userRatingsTotal: 100,
          priceLevel: 2,
          vicinity: 'Test',
          location: { lat: 41.04, lng: 28.98 },
          distanceKm: 0.5,
          openNow: true,
          photoUrl: null,
        },
      },
    ],
    noteToUser: '',
    tier: 'free',
    model: 'claude-haiku-4-5-20251001',
    remainingToday: 2,
    resetAt: '2026-05-21T21:00:00.000Z',
    latencyMs: 1234,
    ...overrides,
  };
}

function makeRec(placeId: string) {
  return {
    placeId,
    reason: 'r',
    restaurant: {
      name: placeId,
      types: ['restaurant'],
      rating: 4.5,
      userRatingsTotal: 100,
      priceLevel: 2,
      vicinity: 'Test',
      location: { lat: 41.04, lng: 28.98 },
      distanceKm: 0.5,
      openNow: true,
      photoUrl: null,
    },
  };
}

beforeEach(() => {
  resetStore();
  jest.clearAllMocks();
});

// ─── Initial state ───────────────────────────────────────────────────────────

describe('aiRecommendationStore — initial state', () => {
  it('starts with sensible defaults', () => {
    const s = useAiRecommendationStore.getState();
    expect(s.loading).toBe(false);
    expect(s.recommendations).toEqual([]);
    expect(s.noteToUser).toBe('');
    expect(s.remainingToday).toBeNull();
    expect(s.resetAt).toBeNull();
    expect(s.tier).toBeNull();
    expect(s.error).toBeNull();
    expect(s.limitReached).toBe(false);
    expect(s.noCandidates).toBe(false);
    expect(s.streamingStatus).toBe('idle');
    expect(s.abortController).toBeNull();
    expect(s.routeRecommendations).toEqual([]);
    expect(s.routeMeta).toBeNull();
    expect(s.routeLoading).toBe(false);
    expect(s.routeError).toBeNull();
  });
});

// ─── fetchDinnerRecommendation ───────────────────────────────────────────────

describe('aiRecommendationStore — fetchDinnerRecommendation — success', () => {
  it('sets loading=true during call, false after', async () => {
    let loadingDuringCall = false;
    mockedGetDinner.mockImplementation(async () => {
      loadingDuringCall = useAiRecommendationStore.getState().loading;
      return makeResponse();
    });

    await useAiRecommendationStore.getState().fetchDinnerRecommendation(41.04, 28.98);

    expect(loadingDuringCall).toBe(true);
    expect(useAiRecommendationStore.getState().loading).toBe(false);
  });

  it('populates recommendations from response', async () => {
    mockedGetDinner.mockResolvedValueOnce(makeResponse());

    await useAiRecommendationStore.getState().fetchDinnerRecommendation(41.04, 28.98);

    const s = useAiRecommendationStore.getState();
    expect(s.recommendations).toHaveLength(1);
    expect(s.recommendations[0].placeId).toBe('p1');
    expect(s.tier).toBe('free');
    expect(s.remainingToday).toBe(2);
    expect(s.error).toBeNull();
  });

  it('passes coordinates to service (mood özelliği kaldırıldı)', async () => {
    mockedGetDinner.mockResolvedValueOnce(makeResponse());

    await useAiRecommendationStore.getState().fetchDinnerRecommendation(41.04, 28.98);

    expect(mockedGetDinner).toHaveBeenCalledWith(41.04, 28.98);
  });

  it('clears previous error on new successful call', async () => {
    useAiRecommendationStore.setState({ error: 'old error', limitReached: true });

    mockedGetDinner.mockResolvedValueOnce(makeResponse());
    await useAiRecommendationStore.getState().fetchDinnerRecommendation(41.04, 28.98);

    const s = useAiRecommendationStore.getState();
    expect(s.error).toBeNull();
    expect(s.limitReached).toBe(false);
  });

  it('handles premium tier response (remainingToday=null)', async () => {
    mockedGetDinner.mockResolvedValueOnce(
      makeResponse({ tier: 'premium', remainingToday: null, resetAt: null }),
    );

    await useAiRecommendationStore.getState().fetchDinnerRecommendation(41.04, 28.98);

    const s = useAiRecommendationStore.getState();
    expect(s.tier).toBe('premium');
    expect(s.remainingToday).toBeNull();
    expect(s.resetAt).toBeNull();
  });

  it('stores noteToUser when provided', async () => {
    mockedGetDinner.mockResolvedValueOnce(
      makeResponse({ noteToUser: 'Yakında pek uygun seçenek yok.' }),
    );

    await useAiRecommendationStore.getState().fetchDinnerRecommendation(41.04, 28.98);

    expect(useAiRecommendationStore.getState().noteToUser).toBe('Yakında pek uygun seçenek yok.');
  });
});

describe('aiRecommendationStore — fetchDinnerRecommendation — 429 limit', () => {
  it('sets limitReached=true and remainingToday=0 on AiRecommendationLimitError', async () => {
    mockedGetDinner.mockRejectedValueOnce(
      new AiRecommendationLimitError({
        message: 'Günlük hakkın doldu.',
        resetAt: '2026-05-21T21:00:00.000Z',
      }),
    );

    await useAiRecommendationStore.getState().fetchDinnerRecommendation(41.04, 28.98);

    const s = useAiRecommendationStore.getState();
    expect(s.loading).toBe(false);
    expect(s.limitReached).toBe(true);
    expect(s.remainingToday).toBe(0);
    expect(s.tier).toBe('free');
    expect(s.resetAt).toBe('2026-05-21T21:00:00.000Z');
    expect(s.error).toBe('Günlük hakkın doldu.');
  });

  it('does NOT replace prior recommendations on limit hit', async () => {
    // Önce başarılı bir call yaparak öneriyi store'a koy
    mockedGetDinner.mockResolvedValueOnce(makeResponse());
    await useAiRecommendationStore.getState().fetchDinnerRecommendation(41.04, 28.98);
    const prevRecs = useAiRecommendationStore.getState().recommendations;
    expect(prevRecs).toHaveLength(1);

    // Sonraki call'da limit hit
    mockedGetDinner.mockRejectedValueOnce(
      new AiRecommendationLimitError({
        message: 'Limit',
        resetAt: '2026-05-21T00:00:00.000Z',
      }),
    );
    await useAiRecommendationStore.getState().fetchDinnerRecommendation(41.04, 28.98);

    // Eski öneriler korunmalı — UI bu state'i kullanabilir
    expect(useAiRecommendationStore.getState().recommendations).toEqual(prevRecs);
  });
});

describe('aiRecommendationStore — fetchDinnerRecommendation — 404 no candidates', () => {
  it('sets noCandidates=true on AiRecommendationNoCandidatesError', async () => {
    mockedGetDinner.mockRejectedValueOnce(
      new AiRecommendationNoCandidatesError('Yakında uygun restoran yok.'),
    );

    await useAiRecommendationStore.getState().fetchDinnerRecommendation(41.04, 28.98);

    const s = useAiRecommendationStore.getState();
    expect(s.loading).toBe(false);
    expect(s.noCandidates).toBe(true);
    expect(s.recommendations).toEqual([]);
    expect(s.error).toBe('Yakında uygun restoran yok.');
    expect(s.limitReached).toBe(false);
  });
});

describe('aiRecommendationStore — fetchDinnerRecommendation — generic errors', () => {
  it('sets user-friendly error on network failure', async () => {
    mockedGetDinner.mockRejectedValueOnce(new Error('Network Error'));

    await useAiRecommendationStore.getState().fetchDinnerRecommendation(41.04, 28.98);

    const s = useAiRecommendationStore.getState();
    expect(s.loading).toBe(false);
    expect(s.error).toMatch(/Öneri alınamadı/);
    expect(s.limitReached).toBe(false);
    expect(s.noCandidates).toBe(false);
  });

  it('does not crash on unexpected error shape', async () => {
    mockedGetDinner.mockRejectedValueOnce({ weird: 'shape' });

    await expect(
      useAiRecommendationStore.getState().fetchDinnerRecommendation(41.04, 28.98),
    ).resolves.not.toThrow();

    expect(useAiRecommendationStore.getState().error).toBeDefined();
  });
});

// ─── clear() ─────────────────────────────────────────────────────────────────

describe('aiRecommendationStore — clear()', () => {
  it('resets all state to initial values', async () => {
    // Önce state'i değiştir
    mockedGetDinner.mockResolvedValueOnce(makeResponse());
    await useAiRecommendationStore.getState().fetchDinnerRecommendation(41.04, 28.98);
    useAiRecommendationStore.setState({ streamingStatus: 'error', abortController: {} as AbortController });

    expect(useAiRecommendationStore.getState().recommendations).toHaveLength(1);

    // Clear çağır
    useAiRecommendationStore.getState().clear();

    const s = useAiRecommendationStore.getState();
    expect(s.recommendations).toEqual([]);
    expect(s.tier).toBeNull();
    expect(s.remainingToday).toBeNull();
    expect(s.error).toBeNull();
    expect(s.limitReached).toBe(false);
    expect(s.noCandidates).toBe(false);
    expect(s.loading).toBe(false);
    expect(s.streamingStatus).toBe('idle');
    expect(s.abortController).toBeNull();
  });

  it('can be called multiple times safely', () => {
    expect(() => {
      useAiRecommendationStore.getState().clear();
      useAiRecommendationStore.getState().clear();
      useAiRecommendationStore.getState().clear();
    }).not.toThrow();
  });

  it('resets after limit-reached state', async () => {
    mockedGetDinner.mockRejectedValueOnce(
      new AiRecommendationLimitError({
        message: 'Limit',
        resetAt: '2026-05-21T00:00:00.000Z',
      }),
    );
    await useAiRecommendationStore.getState().fetchDinnerRecommendation(41.04, 28.98);
    expect(useAiRecommendationStore.getState().limitReached).toBe(true);

    useAiRecommendationStore.getState().clear();
    expect(useAiRecommendationStore.getState().limitReached).toBe(false);
  });

  it('clears feedbackByPlaceId on clear()', async () => {
    useAiRecommendationStore.setState({ feedbackByPlaceId: { p1: 'positive' } });
    useAiRecommendationStore.getState().clear();
    expect(useAiRecommendationStore.getState().feedbackByPlaceId).toEqual({});
  });
});

// ─── submitFeedback (Sprint-2 Task #6) ──────────────────────────────────────

describe('aiRecommendationStore — submitFeedback', () => {
  beforeEach(() => {
    mockedPostFeedback.mockResolvedValue({ id: 'fb-1' });
  });

  it('optimistically sets feedbackByPlaceId before API call resolves', async () => {
    let stateBeforeResolve: Record<string, string> = {};
    mockedPostFeedback.mockImplementation(async () => {
      stateBeforeResolve = useAiRecommendationStore.getState().feedbackByPlaceId;
      return { id: 'fb-1' };
    });

    await useAiRecommendationStore.getState().submitFeedback('p1', 'positive');

    expect(stateBeforeResolve['p1']).toBe('positive');
    expect(useAiRecommendationStore.getState().feedbackByPlaceId['p1']).toBe('positive');
  });

  it('calls postFeedback with correct placeId and sentiment', async () => {
    await useAiRecommendationStore.getState().submitFeedback('p2', 'negative');

    expect(mockedPostFeedback).toHaveBeenCalledWith({
      placeId: 'p2',
      sentiment: 'negative',
      placeTypes: undefined,
    });
  });

  it('placeTypes verilince postFeedback\'e iletilir (S4-7)', async () => {
    await useAiRecommendationStore.getState().submitFeedback('p3', 'positive', ['italian_restaurant']);

    expect(mockedPostFeedback).toHaveBeenCalledWith({
      placeId: 'p3',
      sentiment: 'positive',
      placeTypes: ['italian_restaurant'],
    });
  });

  it('rolls back feedbackByPlaceId on API failure', async () => {
    mockedPostFeedback.mockRejectedValueOnce(new Error('Network error'));

    await expect(
      useAiRecommendationStore.getState().submitFeedback('p1', 'positive')
    ).rejects.toThrow();

    expect(useAiRecommendationStore.getState().feedbackByPlaceId['p1']).toBeUndefined();
  });

  it('throws after rollback so caller can show Alert', async () => {
    mockedPostFeedback.mockRejectedValueOnce(new Error('fail'));

    await expect(
      useAiRecommendationStore.getState().submitFeedback('p1', 'positive')
    ).rejects.toThrow('Feedback gönderilemedi.');
  });

  it('can update sentiment from positive to negative', async () => {
    useAiRecommendationStore.setState({ feedbackByPlaceId: { p1: 'positive' } });

    await useAiRecommendationStore.getState().submitFeedback('p1', 'negative');

    expect(useAiRecommendationStore.getState().feedbackByPlaceId['p1']).toBe('negative');
  });
});

// ─── fetchRouteRecommendation (Sprint-3 Task #7) ─────────────────────────────

function makeRouteResponse(overrides: Partial<RouteRecommendationResponse> = {}): RouteRecommendationResponse {
  return {
    recommendations: [
      {
        placeId: 'rp1',
        reason: 'Rota üzerinde ideal.',
        restaurant: {
          name: 'Route Place 1',
          types: ['restaurant'],
          rating: 4.3,
          userRatingsTotal: 80,
          priceLevel: 2,
          vicinity: 'Test St',
          location: { lat: 41.04, lng: 28.98 },
          distanceKm: 1.2,
          openNow: true,
          photoUrl: null,
          sequenceOrder: 1,
        },
      },
    ],
    totalRouteDistanceKm: 10.5,
    totalRouteDurationMin: 25,
    noteToUser: '',
    tier: 'free',
    model: 'claude-haiku-4-5-20251001',
    remainingToday: 2,
    resetAt: new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString(),
    latencyMs: 400,
    ...overrides,
  };
}

const ROUTE_PARAMS = {
  originLat: 41.04,
  originLng: 28.98,
  destLat: 40.99,
  destLng: 29.02,
};

describe('aiRecommendationStore — fetchRouteRecommendation', () => {
  beforeEach(() => {
    useAiRecommendationStore.setState({
      routeRecommendations: [],
      routeMeta: null,
      routeNoteToUser: '',
      routeLoading: false,
      routeError: null,
      routeLimitReached: false,
      routeNoCandidates: false,
    });
  });

  it('sets routeRecommendations and routeMeta on success', async () => {
    mockedGetRoute.mockResolvedValueOnce(makeRouteResponse());

    await useAiRecommendationStore.getState().fetchRouteRecommendation(ROUTE_PARAMS);

    const state = useAiRecommendationStore.getState();
    expect(state.routeRecommendations).toHaveLength(1);
    expect(state.routeRecommendations[0].placeId).toBe('rp1');
    expect(state.routeMeta).toEqual({ totalDistanceKm: 10.5, totalDurationMin: 25 });
    expect(state.routeLoading).toBe(false);
    expect(state.routeError).toBeNull();
  });

  it('stores noteToUser from response', async () => {
    mockedGetRoute.mockResolvedValueOnce(makeRouteResponse({ noteToUser: 'Rota boyunca güzel seçenekler var.' }));

    await useAiRecommendationStore.getState().fetchRouteRecommendation(ROUTE_PARAMS);

    expect(useAiRecommendationStore.getState().routeNoteToUser).toBe('Rota boyunca güzel seçenekler var.');
  });

  it('sets routeLoading=true during fetch, false after', async () => {
    let loadingDuringFetch = false;
    mockedGetRoute.mockImplementation(async () => {
      loadingDuringFetch = useAiRecommendationStore.getState().routeLoading;
      return makeRouteResponse();
    });

    await useAiRecommendationStore.getState().fetchRouteRecommendation(ROUTE_PARAMS);

    expect(loadingDuringFetch).toBe(true);
    expect(useAiRecommendationStore.getState().routeLoading).toBe(false);
  });

  it('sets routeLimitReached=true on AiRecommendationLimitError (429)', async () => {
    mockedGetRoute.mockRejectedValueOnce(
      new AiRecommendationLimitError({ message: 'Limit doldu.', resetAt: '2026-05-22T00:00:00.000Z' }),
    );

    await useAiRecommendationStore.getState().fetchRouteRecommendation(ROUTE_PARAMS);

    const state = useAiRecommendationStore.getState();
    expect(state.routeLimitReached).toBe(true);
    expect(state.routeLoading).toBe(false);
    expect(state.routeError).toBe('Limit doldu.');
  });

  it('sets routeNoCandidates=true on AiRecommendationNoCandidatesError (404)', async () => {
    mockedGetRoute.mockRejectedValueOnce(
      new AiRecommendationNoCandidatesError('Rota boyunca restoran bulunamadı.'),
    );

    await useAiRecommendationStore.getState().fetchRouteRecommendation(ROUTE_PARAMS);

    const state = useAiRecommendationStore.getState();
    expect(state.routeNoCandidates).toBe(true);
    expect(state.routeLoading).toBe(false);
    expect(state.routeError).toBe('Rota boyunca restoran bulunamadı.');
  });

  it('sets routeError on generic network failure', async () => {
    mockedGetRoute.mockRejectedValueOnce(new Error('Network error'));

    await useAiRecommendationStore.getState().fetchRouteRecommendation(ROUTE_PARAMS);

    const state = useAiRecommendationStore.getState();
    expect(state.routeError).toMatch(/alınamadı/);
    expect(state.routeLoading).toBe(false);
    expect(state.routeRecommendations).toHaveLength(0);
  });

  it('clears previous results before each new fetch', async () => {
    useAiRecommendationStore.setState({
      routeRecommendations: [makeRouteResponse().recommendations[0]],
      routeError: 'önceki hata',
    });
    mockedGetRoute.mockResolvedValueOnce(makeRouteResponse());

    await useAiRecommendationStore.getState().fetchRouteRecommendation(ROUTE_PARAMS);

    expect(useAiRecommendationStore.getState().routeError).toBeNull();
  });
});

describe('aiRecommendationStore — resetRoute', () => {
  it('clears all route state to initial values', () => {
    useAiRecommendationStore.setState({
      routeRecommendations: [makeRouteResponse().recommendations[0]],
      routeMeta: { totalDistanceKm: 10, totalDurationMin: 20 },
      routeNoteToUser: 'bir not',
      routeLoading: true,
      routeError: 'bir hata',
      routeLimitReached: true,
      routeNoCandidates: true,
    });

    useAiRecommendationStore.getState().resetRoute();

    const state = useAiRecommendationStore.getState();
    expect(state.routeRecommendations).toHaveLength(0);
    expect(state.routeMeta).toBeNull();
    expect(state.routeNoteToUser).toBe('');
    expect(state.routeLoading).toBe(false);
    expect(state.routeError).toBeNull();
    expect(state.routeLimitReached).toBe(false);
    expect(state.routeNoCandidates).toBe(false);
  });
});

// ─── streamDinnerRecommendation (Sprint-3 Task #4) ───────────────────────────

const STREAM_CARD = {
  placeId: 's1',
  reason: 'Streaming test.',
  restaurant: {
    name: 'Stream Place',
    types: ['restaurant'],
    rating: 4.2,
    userRatingsTotal: 60,
    priceLevel: 2,
    vicinity: 'Stream St',
    location: { lat: 41.04, lng: 28.98 },
    distanceKm: 0.8,
    openNow: true,
    photoUrl: null,
  },
};

describe('aiRecommendationStore — streamDinnerRecommendation — success', () => {
  it('sets streamingStatus=streaming and loading=true at start', async () => {
    let statusDuringCall: string | undefined;
    let loadingDuringCall: boolean | undefined;

    mockedStreamDinner.mockImplementation(async (_lat, _lng, callbacks) => {
      statusDuringCall = useAiRecommendationStore.getState().streamingStatus;
      loadingDuringCall = useAiRecommendationStore.getState().loading;
      callbacks.onDone({ tier: 'free', remainingToday: 2, resetAt: '2026-05-22T00:00:00.000Z', model: 'claude-haiku-4-5-20251001', latencyMs: 300 });
    });

    await useAiRecommendationStore.getState().streamDinnerRecommendation(41.04, 28.98);

    expect(statusDuringCall).toBe('streaming');
    expect(loadingDuringCall).toBe(true);
  });

  it('pushes card to recommendations on onCard; loading goes false', async () => {
    mockedStreamDinner.mockImplementation(async (_lat, _lng, callbacks) => {
      callbacks.onCard(STREAM_CARD as any);
      callbacks.onDone({ tier: 'free', remainingToday: 2, resetAt: '2026-05-22T00:00:00.000Z', model: 'claude-haiku-4-5-20251001', latencyMs: 300 });
    });

    await useAiRecommendationStore.getState().streamDinnerRecommendation(41.04, 28.98);

    const s = useAiRecommendationStore.getState();
    expect(s.recommendations).toHaveLength(1);
    expect(s.recommendations[0].placeId).toBe('s1');
    expect(s.loading).toBe(false);
  });

  it('sets noteToUser on onNote callback', async () => {
    mockedStreamDinner.mockImplementation(async (_lat, _lng, callbacks) => {
      callbacks.onNote('Yakında güzel bir seçenek var.');
      callbacks.onDone({ tier: 'free', remainingToday: 1, resetAt: null, model: 'claude-haiku-4-5-20251001', latencyMs: 200 });
    });

    await useAiRecommendationStore.getState().streamDinnerRecommendation(41.04, 28.98);

    expect(useAiRecommendationStore.getState().noteToUser).toBe('Yakında güzel bir seçenek var.');
  });

  it('sets streamingStatus=done and updates tier/remaining on onDone', async () => {
    mockedStreamDinner.mockImplementation(async (_lat, _lng, callbacks) => {
      callbacks.onDone({ tier: 'premium', remainingToday: null, resetAt: null, model: 'claude-sonnet-4-6', latencyMs: 500 });
    });

    await useAiRecommendationStore.getState().streamDinnerRecommendation(41.04, 28.98);

    const s = useAiRecommendationStore.getState();
    expect(s.streamingStatus).toBe('done');
    expect(s.tier).toBe('premium');
    expect(s.remainingToday).toBeNull();
    expect(s.abortController).toBeNull();
    expect(s.loading).toBe(false);
  });

  it('clears previous recommendations at the start of a new stream', async () => {
    useAiRecommendationStore.setState({ recommendations: [STREAM_CARD as any] });

    mockedStreamDinner.mockImplementation(async (_lat, _lng, callbacks) => {
      callbacks.onDone({ tier: 'free', remainingToday: 2, resetAt: null, model: 'claude-haiku-4-5-20251001', latencyMs: 300 });
    });

    await useAiRecommendationStore.getState().streamDinnerRecommendation(41.04, 28.98);

    expect(useAiRecommendationStore.getState().recommendations).toHaveLength(0);
  });
});

describe('aiRecommendationStore — streamDinnerRecommendation — errors', () => {
  it('sets limitReached=true and streamingStatus=error on onError LIMIT_EXCEEDED', async () => {
    mockedStreamDinner.mockImplementation(async (_lat, _lng, callbacks) => {
      callbacks.onError({ code: 'LIMIT_EXCEEDED', message: 'Günlük hakkın doldu.', resetAt: '2026-05-22T00:00:00.000Z' });
    });

    await useAiRecommendationStore.getState().streamDinnerRecommendation(41.04, 28.98);

    const s = useAiRecommendationStore.getState();
    expect(s.streamingStatus).toBe('error');
    expect(s.limitReached).toBe(true);
    expect(s.remainingToday).toBe(0);
    expect(s.tier).toBe('free');
    expect(s.error).toBe('Günlük hakkın doldu.');
    expect(s.loading).toBe(false);
    expect(s.abortController).toBeNull();
  });

  it('sets noCandidates=true and streamingStatus=error on onError NO_CANDIDATES', async () => {
    mockedStreamDinner.mockImplementation(async (_lat, _lng, callbacks) => {
      callbacks.onError({ code: 'NO_CANDIDATES', message: 'Yakında uygun restoran yok.' });
    });

    await useAiRecommendationStore.getState().streamDinnerRecommendation(41.04, 28.98);

    const s = useAiRecommendationStore.getState();
    expect(s.streamingStatus).toBe('error');
    expect(s.noCandidates).toBe(true);
    expect(s.error).toBe('Yakında uygun restoran yok.');
    expect(s.loading).toBe(false);
  });

  it('sets streamingStatus=error on generic onError', async () => {
    mockedStreamDinner.mockImplementation(async (_lat, _lng, callbacks) => {
      callbacks.onError({ code: 'UNKNOWN', message: 'Bağlantı kesildi.' });
    });

    await useAiRecommendationStore.getState().streamDinnerRecommendation(41.04, 28.98);

    const s = useAiRecommendationStore.getState();
    expect(s.streamingStatus).toBe('error');
    expect(s.error).toBe('Bağlantı kesildi.');
  });

  it('sets streamingStatus=error on thrown AiRecommendationLimitError', async () => {
    mockedStreamDinner.mockRejectedValueOnce(
      new AiRecommendationLimitError({ message: 'Limit.', resetAt: '2026-05-22T00:00:00.000Z' }),
    );

    await useAiRecommendationStore.getState().streamDinnerRecommendation(41.04, 28.98);

    const s = useAiRecommendationStore.getState();
    expect(s.streamingStatus).toBe('error');
    expect(s.limitReached).toBe(true);
    expect(s.loading).toBe(false);
  });

  it('generic streaming hatasında non-streaming fallback başarılıysa done döner', async () => {
    // expo/fetch streaming bazı cihazlarda başarısız → non-streaming getDinner'a düşülür
    mockedStreamDinner.mockRejectedValueOnce(new Error('Network error'));
    mockedGetDinner.mockResolvedValueOnce(makeResponse());

    await useAiRecommendationStore.getState().streamDinnerRecommendation(41.04, 28.98);

    const s = useAiRecommendationStore.getState();
    expect(mockedGetDinner).toHaveBeenCalledWith(41.04, 28.98);
    expect(s.streamingStatus).toBe('done');
    expect(s.recommendations.map((r) => r.placeId)).toEqual(['p1']);
    expect(s.error).toBeNull();
    expect(s.loading).toBe(false);
  });

  it('hem streaming hem non-streaming fallback başarısızsa error döner', async () => {
    mockedStreamDinner.mockRejectedValueOnce(new Error('Network error'));
    mockedGetDinner.mockRejectedValueOnce(new Error('Network error'));

    await useAiRecommendationStore.getState().streamDinnerRecommendation(41.04, 28.98);

    const s = useAiRecommendationStore.getState();
    expect(s.streamingStatus).toBe('error');
    expect(s.error).toMatch(/Öneri alınamadı/);
    expect(s.loading).toBe(false);
  });

  it('refinement sırasında streaming hatasında fallback YAPILMAZ (error döner)', async () => {
    useAiRecommendationStore.setState({ sessionId: 'sess-1', recommendations: [makeRec('p1') as any] });
    mockedStreamDinner.mockRejectedValueOnce(new Error('Network error'));

    await useAiRecommendationStore.getState().streamDinnerRecommendation(41.04, 28.98, 'daha ucuz');

    expect(mockedGetDinner).not.toHaveBeenCalled(); // refinement non-streaming'e düşmez
    expect(useAiRecommendationStore.getState().streamingStatus).toBe('error');
  });
});

// ─── cancelStream (Sprint-3 Task #4) ────────────────────────────────────────

describe('aiRecommendationStore — cancelStream', () => {
  it('sets streamingStatus=cancelled and loading=false', () => {
    useAiRecommendationStore.setState({ streamingStatus: 'streaming', loading: true });

    useAiRecommendationStore.getState().cancelStream();

    const s = useAiRecommendationStore.getState();
    expect(s.streamingStatus).toBe('cancelled');
    expect(s.loading).toBe(false);
    expect(s.abortController).toBeNull();
  });

  it('calls abort() on active abortController', () => {
    const mockAbort = jest.fn();
    const fakeController = { abort: mockAbort, signal: {} } as unknown as AbortController;
    useAiRecommendationStore.setState({ abortController: fakeController, streamingStatus: 'streaming' });

    useAiRecommendationStore.getState().cancelStream();

    expect(mockAbort).toHaveBeenCalledTimes(1);
  });

  it('can be called when no active stream without throwing', () => {
    useAiRecommendationStore.setState({ abortController: null, streamingStatus: 'idle' });

    expect(() => useAiRecommendationStore.getState().cancelStream()).not.toThrow();
    expect(useAiRecommendationStore.getState().streamingStatus).toBe('cancelled');
  });
});

// ─── streamDinnerRecommendation — refinement & session (Sprint-4 Task #3) ──────

describe('aiRecommendationStore — streamDinnerRecommendation refinement', () => {
  it('ilk stream: sessionId done eventinden yakalanir, fresh cagri opts bos', async () => {
    mockedStreamDinner.mockImplementation(async (_lat, _lng, cb) => {
      cb.onCard(makeRec('p1') as any);
      cb.onDone({ tier: 'free', model: 'm', remainingToday: 2, resetAt: null, latencyMs: 1, sessionId: 'new-sid' });
    });

    await useAiRecommendationStore.getState().streamDinnerRecommendation(41, 28);

    const s = useAiRecommendationStore.getState();
    expect(s.sessionId).toBe('new-sid');
    expect(s.recommendations.map((r) => r.placeId)).toEqual(['p1']);
    expect(s.streamingStatus).toBe('done');
    // fresh cagrida sessionId + refinement undefined gonderilir
    expect(mockedStreamDinner.mock.calls[0][4]).toEqual({ sessionId: undefined, refinement: undefined });
  });

  it('refinement: onceki sessionId + refinement ile cagrilir, eski kartlar ilk yeni kartta degisir', async () => {
    useAiRecommendationStore.setState({
      recommendations: [makeRec('p1') as any],
      sessionId: 'sess-1',
      streamingStatus: 'done',
    });

    let stateAtStart: any;
    mockedStreamDinner.mockImplementation(async (_lat, _lng, cb, _signal, _opts) => {
      stateAtStart = useAiRecommendationStore.getState();
      cb.onCard(makeRec('p2') as any);
      cb.onDone({ tier: 'free', model: 'm', remainingToday: 1, resetAt: null, latencyMs: 1, sessionId: 'sess-1' });
    });

    await useAiRecommendationStore.getState().streamDinnerRecommendation(41, 28, 'daha ucuz');

    // servis onceki sessionId + refinement ile cagrildi
    expect(mockedStreamDinner.mock.calls[0][4]).toEqual({ sessionId: 'sess-1', refinement: 'daha ucuz' });
    // refinement basinda eski kart korunmustu + refining=true
    expect(stateAtStart.recommendations.map((r: any) => r.placeId)).toEqual(['p1']);
    expect(stateAtStart.refining).toBe(true);
    // ilk yeni kart eskiyi degistirdi
    const s = useAiRecommendationStore.getState();
    expect(s.recommendations.map((r) => r.placeId)).toEqual(['p2']);
    expect(s.sessionId).toBe('sess-1');
    expect(s.refining).toBe(false);
    expect(s.streamingStatus).toBe('done');
  });

  it('refinement sirasinda skeleton (loading) gosterilmez', async () => {
    useAiRecommendationStore.setState({
      recommendations: [makeRec('p1') as any],
      sessionId: 'sess-1',
      streamingStatus: 'done',
    });

    let loadingAtStart: boolean | undefined;
    mockedStreamDinner.mockImplementation(async (_lat, _lng, cb) => {
      loadingAtStart = useAiRecommendationStore.getState().loading;
      cb.onCard(makeRec('p2') as any);
      cb.onDone({ tier: 'free', model: 'm', remainingToday: 1, resetAt: null, latencyMs: 1, sessionId: 'sess-1' });
    });

    await useAiRecommendationStore.getState().streamDinnerRecommendation(41, 28, 'daha yakin');

    expect(loadingAtStart).toBe(false);
  });

  it('clear() sessionId ve refining sifirlar', () => {
    useAiRecommendationStore.setState({ sessionId: 'sess-9', refining: true });
    useAiRecommendationStore.getState().clear();
    const s = useAiRecommendationStore.getState();
    expect(s.sessionId).toBeNull();
    expect(s.refining).toBe(false);
  });
});
