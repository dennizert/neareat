/**
 * #430 — admin.ts servis sözleşmesi: her fonksiyonun doğru HTTP metodu, endpoint
 * ve parametrelerle çağrıldığını ve backend yanıtını olduğu gibi döndürdüğünü
 * doğrular (endpoint/param yazım hatalarını yakalayan gerçek kontrat testi).
 */
jest.mock('../../services/api', () => ({
  __esModule: true,
  default: { get: jest.fn(), post: jest.fn(), put: jest.fn(), patch: jest.fn(), delete: jest.fn() },
}));

import api from '../../services/api';
import * as admin from '../../services/admin';

const mockedApi = api as any;
beforeEach(() => jest.clearAllMocks());

describe('admin servis sözleşmesi', () => {
  it('getLogs filtreleri params olarak /logs’a gönderir', async () => {
    mockedApi.get.mockResolvedValueOnce({ data: { logs: [], total: 0, page: 1, limit: 20 } });
    const filters = { email: 'a@b.com', page: 2 };
    const result = await admin.getLogs(filters);
    expect(mockedApi.get).toHaveBeenCalledWith('/logs', { params: filters });
    expect(result.total).toBe(0);
  });

  it('adminLogin email/password ile POST atar', async () => {
    mockedApi.post.mockResolvedValueOnce({ data: { token: 't', user: {} } });
    await admin.adminLogin('a@b.com', 'pw');
    expect(mockedApi.post).toHaveBeenCalledWith('/admin/login', { email: 'a@b.com', password: 'pw' });
  });

  it('seedAdmin payload’ı olduğu gibi gönderir', async () => {
    const payload = { email: 'a@b.com', password: 'pw', displayName: 'Ali' };
    mockedApi.post.mockResolvedValueOnce({ data: { id: 'u1' } });
    await admin.seedAdmin(payload);
    expect(mockedApi.post).toHaveBeenCalledWith('/admin/seed', payload);
  });

  it('getPlatformStats /admin/stats çağırır', async () => {
    mockedApi.get.mockResolvedValueOnce({ data: {} });
    await admin.getPlatformStats();
    expect(mockedApi.get).toHaveBeenCalledWith('/admin/stats');
  });

  it('getPendingRestaurants varsayılan status/page ile çağırır', async () => {
    mockedApi.get.mockResolvedValueOnce({ data: { profiles: [], total: 0 } });
    await admin.getPendingRestaurants();
    expect(mockedApi.get).toHaveBeenCalledWith('/admin/restaurants', { params: { status: 'PENDING', page: 1 } });
  });

  it('getRestaurantDetail id ile path kurar', async () => {
    mockedApi.get.mockResolvedValueOnce({ data: {} });
    await admin.getRestaurantDetail('r1');
    expect(mockedApi.get).toHaveBeenCalledWith('/admin/restaurants/r1');
  });

  it('getTaxCertificate doğru path ile çağırır', async () => {
    mockedApi.get.mockResolvedValueOnce({ data: { data: 'base64==' } });
    const result = await admin.getTaxCertificate('r1');
    expect(mockedApi.get).toHaveBeenCalledWith('/admin/restaurants/r1/certificate');
    expect(result.data).toBe('base64==');
  });

  it('approveRestaurant onay endpointine POST atar', async () => {
    mockedApi.post.mockResolvedValueOnce({ data: { id: 'r1', status: 'APPROVED' } });
    await admin.approveRestaurant('r1');
    expect(mockedApi.post).toHaveBeenCalledWith('/admin/restaurants/r1/approve');
  });

  it('rejectRestaurant sebep ile POST atar', async () => {
    mockedApi.post.mockResolvedValueOnce({ data: { id: 'r1', status: 'REJECTED' } });
    await admin.rejectRestaurant('r1', 'eksik belge');
    expect(mockedApi.post).toHaveBeenCalledWith('/admin/restaurants/r1/reject', { rejectionReason: 'eksik belge' });
  });

  it('getUsers varsayılan search/page/role ile çağırır', async () => {
    mockedApi.get.mockResolvedValueOnce({ data: { users: [], total: 0 } });
    await admin.getUsers();
    expect(mockedApi.get).toHaveBeenCalledWith('/admin/users', { params: { search: '', page: 1, role: 'USER' } });
  });

  it('suspendUser doğru path ile POST atar', async () => {
    mockedApi.post.mockResolvedValueOnce({ data: {} });
    await admin.suspendUser('u1');
    expect(mockedApi.post).toHaveBeenCalledWith('/admin/users/u1/suspend');
  });

  it('unsuspendUser doğru path ile POST atar', async () => {
    mockedApi.post.mockResolvedValueOnce({ data: {} });
    await admin.unsuspendUser('u1');
    expect(mockedApi.post).toHaveBeenCalledWith('/admin/users/u1/unsuspend');
  });

  it('getFlaggedReviews /admin/reviews çağırır', async () => {
    mockedApi.get.mockResolvedValueOnce({ data: [] });
    await admin.getFlaggedReviews();
    expect(mockedApi.get).toHaveBeenCalledWith('/admin/reviews');
  });

  it('adminDeleteReview doğru path ile DELETE atar', async () => {
    mockedApi.delete.mockResolvedValueOnce({});
    await admin.adminDeleteReview('rev1');
    expect(mockedApi.delete).toHaveBeenCalledWith('/admin/reviews/rev1');
  });

  it('getReports varsayılan status/page ile çağırır', async () => {
    mockedApi.get.mockResolvedValueOnce({ data: { reports: [], total: 0 } });
    await admin.getReports();
    expect(mockedApi.get).toHaveBeenCalledWith('/admin/reports', { params: { status: 'PENDING', page: 1 } });
  });

  it('handleReport action + actionNote ile PUT atar', async () => {
    mockedApi.put.mockResolvedValueOnce({});
    await admin.handleReport('rep1', 'warn', 'dikkatli ol');
    expect(mockedApi.put).toHaveBeenCalledWith('/admin/reports/rep1', { action: 'warn', actionNote: 'dikkatli ol' });
  });

  it('runFriendSuggestionsJob doğru path ile POST atar', async () => {
    mockedApi.post.mockResolvedValueOnce({ data: { processed: 5, stored: 2 } });
    const result = await admin.runFriendSuggestionsJob();
    expect(mockedApi.post).toHaveBeenCalledWith('/admin/jobs/friend-suggestions/run');
    expect(result).toEqual({ processed: 5, stored: 2 });
  });

  it('getPlaceRequests status/page params ile çağırır', async () => {
    mockedApi.get.mockResolvedValueOnce({ data: { requests: [], total: 0, page: 1, pages: 1 } });
    await admin.getPlaceRequests('PENDING', 2);
    expect(mockedApi.get).toHaveBeenCalledWith('/admin/place-requests', { params: { status: 'PENDING', page: 2 } });
  });

  it('reviewPlaceRequest doğru path ile PATCH atar', async () => {
    mockedApi.patch.mockResolvedValueOnce({ data: { id: 'pr1', status: 'REVIEWED' } });
    await admin.reviewPlaceRequest('pr1');
    expect(mockedApi.patch).toHaveBeenCalledWith('/admin/place-requests/pr1/review');
  });
});
