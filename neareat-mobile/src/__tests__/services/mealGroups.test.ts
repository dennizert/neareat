/**
 * #430 — mealGroups.ts servis sözleşmesi: endpoint/payload doğruluğu.
 */
jest.mock('../../services/api', () => ({
  __esModule: true,
  default: { get: jest.fn(), post: jest.fn() },
}));

import api from '../../services/api';
import * as mealGroups from '../../services/mealGroups';

const mockedApi = api as any;
beforeEach(() => jest.clearAllMocks());

describe('mealGroups servis sözleşmesi', () => {
  it('getMyMealGroups /meal-groups çağırır', async () => {
    mockedApi.get.mockResolvedValueOnce({ data: [] });
    await mealGroups.getMyMealGroups();
    expect(mockedApi.get).toHaveBeenCalledWith('/meal-groups');
  });

  it('getMealGroup id ile path kurar', async () => {
    mockedApi.get.mockResolvedValueOnce({ data: { id: 'g1' } });
    await mealGroups.getMealGroup('g1');
    expect(mockedApi.get).toHaveBeenCalledWith('/meal-groups/g1');
  });

  it('createMealGroup params’ı olduğu gibi POST eder', async () => {
    const params = { name: 'Ekip', memberIds: ['u1', 'u2'] };
    mockedApi.post.mockResolvedValueOnce({ data: { id: 'g1', ...params } });
    await mealGroups.createMealGroup(params);
    expect(mockedApi.post).toHaveBeenCalledWith('/meal-groups', params);
  });

  it('addMealGroupMembers memberIds gönderir', async () => {
    mockedApi.post.mockResolvedValueOnce({ data: { id: 'g1' } });
    await mealGroups.addMealGroupMembers('g1', ['u3']);
    expect(mockedApi.post).toHaveBeenCalledWith('/meal-groups/g1/members', { memberIds: ['u3'] });
  });

  it('respondToMealGroupInvite status gönderir', async () => {
    mockedApi.post.mockResolvedValueOnce({});
    await mealGroups.respondToMealGroupInvite('g1', 'ACCEPTED');
    expect(mockedApi.post).toHaveBeenCalledWith('/meal-groups/g1/respond', { status: 'ACCEPTED' });
  });

  it('createPoll params’ı olduğu gibi POST eder', async () => {
    const params = { options: [{ placeId: 'p1', placeName: 'X' }] };
    mockedApi.post.mockResolvedValueOnce({ data: { id: 'poll1' } });
    await mealGroups.createPoll('g1', params);
    expect(mockedApi.post).toHaveBeenCalledWith('/meal-groups/g1/polls', params);
  });

  it('votePoll optionId/vote gönderir', async () => {
    mockedApi.post.mockResolvedValueOnce({});
    await mealGroups.votePoll('g1', 'poll1', 'opt1', 'YES' as any);
    expect(mockedApi.post).toHaveBeenCalledWith('/meal-groups/g1/polls/poll1/vote', { optionId: 'opt1', vote: 'YES' });
  });

  it('closePoll doğru path ile POST atar', async () => {
    mockedApi.post.mockResolvedValueOnce({ data: { id: 'poll1', status: 'CLOSED' } });
    await mealGroups.closePoll('g1', 'poll1');
    expect(mockedApi.post).toHaveBeenCalledWith('/meal-groups/g1/polls/poll1/close');
  });

  it('createQuickPoll lat/lng/question gönderir', async () => {
    mockedApi.post.mockResolvedValueOnce({ data: { id: 'poll1' } });
    await mealGroups.createQuickPoll('g1', { lat: 1, lng: 2 });
    expect(mockedApi.post).toHaveBeenCalledWith('/meal-groups/g1/quick-poll', { lat: 1, lng: 2 });
  });
});
