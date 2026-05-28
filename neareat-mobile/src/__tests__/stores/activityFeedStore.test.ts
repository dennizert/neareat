/**
 * activityFeedStore Tests (Sprint-4 Task #6)
 *
 * Service (`getActivityFeed`) mock'lu — backend gerçek call yok.
 */

jest.mock('../../services/social', () => {
  const actual = jest.requireActual('../../services/social');
  return { ...actual, getActivityFeed: jest.fn() };
});

import { useActivityFeedStore } from '../../store/activityFeedStore';
import { getActivityFeed } from '../../services/social';
import type { ActivityEvent } from '../../types';

const mockedGetFeed = getActivityFeed as jest.MockedFunction<typeof getActivityFeed>;

const INITIAL_STATE = {
  events: [],
  loading: false,
  refreshing: false,
  loadingMore: false,
  nextCursor: null,
  error: null,
};

function resetStore() {
  useActivityFeedStore.setState(INITIAL_STATE);
}

function ev(id: string): ActivityEvent {
  return {
    id,
    type: 'REVIEW',
    placeId: 'p-' + id,
    metadata: { placeName: 'Place ' + id },
    createdAt: '2026-05-28T10:00:00.000Z',
    user: { id: 'u1', displayName: 'Bob', photoUrl: null },
  };
}

beforeEach(() => {
  resetStore();
  jest.clearAllMocks();
});

describe('activityFeedStore — initial state', () => {
  it('sensible defaults', () => {
    const s = useActivityFeedStore.getState();
    expect(s.events).toEqual([]);
    expect(s.loading).toBe(false);
    expect(s.nextCursor).toBeNull();
    expect(s.error).toBeNull();
  });
});

describe('loadInitial', () => {
  it('events + nextCursor doldurur, loading false', async () => {
    mockedGetFeed.mockResolvedValueOnce({ events: [ev('e1'), ev('e2')], nextCursor: 'e2' });

    await useActivityFeedStore.getState().loadInitial();

    const s = useActivityFeedStore.getState();
    expect(s.events.map((e) => e.id)).toEqual(['e1', 'e2']);
    expect(s.nextCursor).toBe('e2');
    expect(s.loading).toBe(false);
    expect(s.error).toBeNull();
  });

  it('hata durumunda error set eder, loading false', async () => {
    mockedGetFeed.mockRejectedValueOnce(new Error('network'));

    await useActivityFeedStore.getState().loadInitial();

    const s = useActivityFeedStore.getState();
    expect(s.loading).toBe(false);
    expect(s.error).toBeTruthy();
    expect(s.events).toEqual([]);
  });

  it('cursorsuz çağrılır (ilk sayfa)', async () => {
    mockedGetFeed.mockResolvedValueOnce({ events: [], nextCursor: null });
    await useActivityFeedStore.getState().loadInitial();
    expect(mockedGetFeed).toHaveBeenCalledWith();
  });
});

describe('refresh', () => {
  it('listeyi sıfırdan değiştirir', async () => {
    useActivityFeedStore.setState({ events: [ev('old')], nextCursor: 'old' });
    mockedGetFeed.mockResolvedValueOnce({ events: [ev('new')], nextCursor: null });

    await useActivityFeedStore.getState().refresh();

    const s = useActivityFeedStore.getState();
    expect(s.events.map((e) => e.id)).toEqual(['new']);
    expect(s.nextCursor).toBeNull();
    expect(s.refreshing).toBe(false);
  });
});

describe('loadMore', () => {
  it('nextCursor varsa sonraki sayfayı ekler (append)', async () => {
    useActivityFeedStore.setState({ events: [ev('e1')], nextCursor: 'e1' });
    mockedGetFeed.mockResolvedValueOnce({ events: [ev('e2')], nextCursor: 'e2' });

    await useActivityFeedStore.getState().loadMore();

    const s = useActivityFeedStore.getState();
    expect(s.events.map((e) => e.id)).toEqual(['e1', 'e2']);
    expect(s.nextCursor).toBe('e2');
    expect(mockedGetFeed).toHaveBeenCalledWith('e1');
  });

  it('nextCursor null ise hiçbir şey yapmaz', async () => {
    useActivityFeedStore.setState({ events: [ev('e1')], nextCursor: null });

    await useActivityFeedStore.getState().loadMore();

    expect(mockedGetFeed).not.toHaveBeenCalled();
  });

  it('zaten yükleme sürerken loadMore atlanır', async () => {
    useActivityFeedStore.setState({ events: [ev('e1')], nextCursor: 'e1', loading: true });

    await useActivityFeedStore.getState().loadMore();

    expect(mockedGetFeed).not.toHaveBeenCalled();
  });

  it('sayfalama hatasında liste bozulmaz, sadece gösterge kapanır', async () => {
    useActivityFeedStore.setState({ events: [ev('e1')], nextCursor: 'e1' });
    mockedGetFeed.mockRejectedValueOnce(new Error('boom'));

    await useActivityFeedStore.getState().loadMore();

    const s = useActivityFeedStore.getState();
    expect(s.events.map((e) => e.id)).toEqual(['e1']);
    expect(s.loadingMore).toBe(false);
  });
});

describe('clear', () => {
  it('state sıfırlar', () => {
    useActivityFeedStore.setState({ events: [ev('e1')], nextCursor: 'e1', error: 'x' });
    useActivityFeedStore.getState().clear();
    const s = useActivityFeedStore.getState();
    expect(s.events).toEqual([]);
    expect(s.nextCursor).toBeNull();
    expect(s.error).toBeNull();
  });
});
