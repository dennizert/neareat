/**
 * sendCampaign servis testi (Sprint-5 Task #4).
 * api mock'lu; 429 → CampaignLimitError eşlemesi + başarı/genel hata.
 */

jest.mock('../../services/api', () => ({
  __esModule: true,
  default: { post: jest.fn() },
}));

import api from '../../services/api';
import { sendCampaign, CampaignLimitError } from '../../services/restaurantAccount';

const mockedPost = (api as any).post as jest.Mock;

beforeEach(() => jest.clearAllMocks());

describe('sendCampaign service', () => {
  it('başarılı yanıtta { sent, audience } döner ve doğru body gönderir', async () => {
    mockedPost.mockResolvedValueOnce({ data: { sent: 3, audience: 'all' } });

    const result = await sendCampaign('Bugün %20 indirim!', 'all');

    expect(result).toEqual({ sent: 3, audience: 'all' });
    expect(mockedPost).toHaveBeenCalledWith('/restaurant-account/campaign', {
      message: 'Bugün %20 indirim!',
      audience: 'all',
    });
  });

  it('audience varsayılanı "all"', async () => {
    mockedPost.mockResolvedValueOnce({ data: { sent: 0, audience: 'all' } });
    await sendCampaign('Masalar boş!');
    expect(mockedPost.mock.calls[0][1].audience).toBe('all');
  });

  it('429 CAMPAIGN_LIMIT_EXCEEDED → CampaignLimitError fırlatır', async () => {
    mockedPost.mockRejectedValueOnce({
      response: { status: 429, data: { error: 'CAMPAIGN_LIMIT_EXCEEDED', message: 'Bugün zaten gönderdin.' } },
    });

    await expect(sendCampaign('Bugün %20 indirim!')).rejects.toBeInstanceOf(CampaignLimitError);
  });

  it('diğer hatalar olduğu gibi fırlatılır', async () => {
    const err = { response: { status: 500, data: {} } };
    mockedPost.mockRejectedValueOnce(err);
    await expect(sendCampaign('Bugün %20 indirim!')).rejects.toBe(err);
  });
});
