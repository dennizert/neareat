import { useCallback } from 'react';
import { useUserProfileStore } from '../store/userProfileStore';
import { useFriendStore } from '../store/friendStore';
import { useRecommendationStore } from '../store/recommendationStore';
import { getMyProfile, getStarEvents, getFriends, getPendingRequests, getMyRecommendations, getReceivedRecommendations } from '../services/social';

/**
 * Uygulama başlatma hook'u — kullanıcı giriş yaptıktan sonra
 * gerekli tüm verileri paralel olarak yükler ve Zustand store'larına yazar.
 *
 * Neden bu hook yazıldı:
 * Kullanıcı giriş yaptığında profil, yıldız geçmişi, arkadaş listesi,
 * bekleyen arkadaşlık istekleri ve öneriler gibi birçok verinin aynı anda
 * çekilmesi gerekir. Bu verileri tek tek sırayla çekmek yerine Promise.all
 * ile paralel çekmek uygulama açılış süresini önemli ölçüde kısaltır.
 * Hata durumunda uygulama çökmez — store'lar boş/mock veriyle çalışmaya devam eder.
 *
 * @returns {{ initApp: () => Promise<void> }} - Uygulama başlatma fonksiyonunu döner
 */
export function useAppInit() {
  const { setProfile, setStarEvents } = useUserProfileStore();
  const { setFriends, setPendingRequests } = useFriendStore();
  const { setMyRecommendations, setReceivedRecommendations } = useRecommendationStore();

  /**
   * Tüm kullanıcı verilerini backend'den paralel olarak çeker ve
   * ilgili Zustand store'larına yazar.
   * useCallback ile sarmalanmıştır — gereksiz yeniden oluşturmayı önler.
   */
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
      // Non-fatal — store'lar boş/mock state ile çalışmaya devam eder
    }
  }, []);

  return { initApp };
}
