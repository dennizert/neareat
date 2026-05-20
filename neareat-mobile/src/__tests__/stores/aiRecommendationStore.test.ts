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
    postFeedback: jest.fn(),
  };
});

import { useAiRecommendationStore } from '../../store/aiRecommendationStore';
import {
  getDinnerRecommendation,
  postFeedback,
  AiRecommendationLimitError,
  AiRecommendationNoCandidatesError,
} from '../../services/aiRecommendation';
import type { AiRecommendationResponse } from '../../types';

const mockedGetDinner = getDinnerRecommendation as jest.MockedFunction<typeof getDinnerRecommendation>;
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

  it('passes mood through to service', async () => {
    mockedGetDinner.mockResolvedValueOnce(makeResponse());

    await useAiRecommendationStore.getState().fetchDinnerRecommendation(41.04, 28.98, 'şık');

    expect(mockedGetDinner).toHaveBeenCalledWith(41.04, 28.98, 'şık');
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
