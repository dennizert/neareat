/**
 * #430 — placeRequests.ts servis sözleşmesi.
 */
jest.mock('../../services/api', () => ({
  __esModule: true,
  default: { get: jest.fn(), post: jest.fn() },
}));

import api from '../../services/api';
import { submitPlaceRequest, getMyPlaceRequests } from '../../services/placeRequests';

const mockedApi = api as any;
beforeEach(() => jest.clearAllMocks());

describe('placeRequests servis sözleşmesi', () => {
  it('submitPlaceRequest payload’ı olduğu gibi POST eder', async () => {
    const payload = { placeId: 'p1', placeName: 'X', note: 'lütfen ekleyin' };
    mockedApi.post.mockResolvedValueOnce({ data: { id: 'pr1', ...payload, status: 'PENDING' } });
    await submitPlaceRequest(payload);
    expect(mockedApi.post).toHaveBeenCalledWith('/place-requests', payload);
  });

  it('getMyPlaceRequests /place-requests/my çağırır', async () => {
    mockedApi.get.mockResolvedValueOnce({ data: [] });
    await getMyPlaceRequests();
    expect(mockedApi.get).toHaveBeenCalledWith('/place-requests/my');
  });
});
