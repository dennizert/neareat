import api from './api';

export interface ReferralCodeInfo {
  code: string;
  usageCount: number;
  earnedStars: number;
}

export interface ApplyResult {
  message: string;
  earnedStars: number;
  referrerName: string;
}

export async function getMyReferralCode(): Promise<ReferralCodeInfo> {
  const { data } = await api.get('/referral/my-code');
  return data;
}

export async function applyReferralCode(code: string): Promise<ApplyResult> {
  const { data } = await api.post('/referral/apply', { code });
  return data;
}
