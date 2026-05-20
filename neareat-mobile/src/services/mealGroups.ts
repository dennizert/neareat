import api from './api';
import type { MealGroup, RestaurantPoll, PollVoteValue } from '../types';

export async function getMyMealGroups(): Promise<MealGroup[]> {
  const { data } = await api.get('/meal-groups');
  return data;
}

export async function getMealGroup(groupId: string): Promise<MealGroup> {
  const { data } = await api.get(`/meal-groups/${groupId}`);
  return data;
}

export async function createMealGroup(params: {
  name: string;
  memberIds: string[];
}): Promise<MealGroup> {
  const { data } = await api.post('/meal-groups', params);
  return data;
}

export async function addMealGroupMembers(groupId: string, memberIds: string[]): Promise<MealGroup> {
  const { data } = await api.post(`/meal-groups/${groupId}/members`, { memberIds });
  return data;
}

export async function respondToMealGroupInvite(
  groupId: string,
  status: 'ACCEPTED' | 'DECLINED',
): Promise<void> {
  await api.post(`/meal-groups/${groupId}/respond`, { status });
}

export interface PollOptionInput {
  placeId: string;
  placeName: string;
  placeAddress?: string | null;
  placePhotoUrl?: string | null;
  placeRating?: number | null;
}

export async function createPoll(
  groupId: string,
  params: { question?: string; options: PollOptionInput[] },
): Promise<RestaurantPoll> {
  const { data } = await api.post(`/meal-groups/${groupId}/polls`, params);
  return data;
}

export async function votePoll(
  groupId: string,
  pollId: string,
  optionId: string,
  vote: PollVoteValue,
): Promise<void> {
  await api.post(`/meal-groups/${groupId}/polls/${pollId}/vote`, { optionId, vote });
}

export async function closePoll(groupId: string, pollId: string): Promise<RestaurantPoll> {
  const { data } = await api.post(`/meal-groups/${groupId}/polls/${pollId}/close`);
  return data;
}
