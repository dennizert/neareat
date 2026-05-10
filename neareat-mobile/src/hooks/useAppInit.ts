import { useCallback } from 'react';
import { useUserProfileStore } from '../store/userProfileStore';
import { useFriendStore } from '../store/friendStore';
import { useRecommendationStore } from '../store/recommendationStore';
import { getMyProfile, getStarEvents, getFriends, getPendingRequests, getMyRecommendations, getReceivedRecommendations } from '../services/social';

export function useAppInit() {
  const { setProfile, setStarEvents } = useUserProfileStore();
  const { setFriends, setPendingRequests } = useFriendStore();
  const { setMyRecommendations, setReceivedRecommendations } = useRecommendationStore();

  const initApp = useCallback(async () => {
    try {
      const [profile, starEvents, friends, requests, myRecs, receivedRecs] = await Promise.all([
        getMyProfile(),
        getStarEvents(),
        getFriends(),
        getPendingRequests(),
        getMyRecommendations(),
        getReceivedRecommendations(),
      ]);
      setProfile(profile);
      setStarEvents(starEvents);
      setFriends(friends);
      setPendingRequests(requests);
      setMyRecommendations(myRecs);
      setReceivedRecommendations(receivedRecs);
    } catch {
      // Non-fatal — stores keep mock/empty state
    }
  }, []);

  return { initApp };
}
