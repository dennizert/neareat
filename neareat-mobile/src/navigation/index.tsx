import React from 'react';
import { View, ActivityIndicator, Image, Text, Alert, Linking } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { useAuthStore } from '../store/authStore';
import type { ApprovalStatus } from '../types';
import { restoreSession, getMe, clearStoredToken, verifyEmail } from '../services/auth';
import type { RootStackParamList, MainTabParamList } from '../types';
import { useThemeStore } from '../store/themeStore';
import { lightColors, darkColors } from '../theme';

import { navigationRef } from './navigationRef';
import OnboardingNavigator from './OnboardingNavigator';
import HomeScreen from '../screens/home/HomeScreen';
import FavoritesScreen from '../screens/FavoritesScreen';
import ProfileScreen from '../screens/ProfileScreen';
import RestaurantDetailScreen from '../screens/restaurant/RestaurantDetailScreen';
import PaywallScreen from '../screens/PaywallScreen';
import EditProfileScreen from '../screens/profile/EditProfileScreen';
import FriendsScreen from '../screens/social/FriendsScreen';
import ActivityFeedScreen from '../screens/social/ActivityFeedScreen';
import FriendSuggestionsScreen from '../screens/social/FriendSuggestionsScreen';
import WeeklySummaryScreen from '../screens/social/WeeklySummaryScreen';
import FriendProfileScreen from '../screens/social/FriendProfileScreen';
import SendRecommendationScreen from '../screens/social/SendRecommendationScreen';
import RewardsScreen from '../screens/rewards/RewardsScreen';
import CollectionsScreen from '../screens/collections/CollectionsScreen';
import DiaryScreen from '../screens/diary/DiaryScreen';
import ReferralScreen from '../screens/referral/ReferralScreen';
import NotificationPrefsScreen from '../screens/notifications/NotificationPrefsScreen';
import CollectionDetailScreen from '../screens/collections/CollectionDetailScreen';

// Restaurant account screens
import RestaurantRegisterScreen from '../screens/restaurant-account/RestaurantRegisterScreen';
import RestaurantPendingScreen from '../screens/restaurant-account/RestaurantPendingScreen';
import RestaurantDashboardScreen from '../screens/restaurant-account/RestaurantDashboardScreen';
import RestaurantHoursScreen from '../screens/restaurant-account/RestaurantHoursScreen';
import RestaurantMenuScreen from '../screens/restaurant-account/RestaurantMenuScreen';
import RestaurantDiscountScreen from '../screens/restaurant-account/RestaurantDiscountScreen';
import RestaurantCampaignScreen from '../screens/restaurant-account/RestaurantCampaignScreen';
import RestaurantAnalyticsScreen from '../screens/restaurant-account/RestaurantAnalyticsScreen';
import RestaurantReviewsScreen from '../screens/restaurant-account/RestaurantReviewsScreen';
import RestaurantInfoScreen from '../screens/restaurant-account/RestaurantInfoScreen';

// Admin screens
import AdminDashboardScreen from '../screens/admin/AdminDashboardScreen';
import AdminRestaurantDetailScreen from '../screens/admin/AdminRestaurantDetailScreen';
import AdminLogsScreen from '../screens/admin/AdminLogsScreen';
import NotificationsScreen from '../screens/NotificationsScreen';
import RecommendationScreen from '../screens/RecommendationScreen';
import RouteRecommendationScreen from '../screens/RouteRecommendationScreen';
import PremiumUpsellScreen from '../screens/PremiumUpsellScreen';
import NotificationBell from '../components/NotificationBell';
import MessagesScreen from '../screens/messages/MessagesScreen';
import ConversationScreen from '../screens/messages/ConversationScreen';
import { useMessageStore } from '../store/messageStore';
// Meal group screens
import MealGroupsScreen from '../screens/meal-groups/MealGroupsScreen';
import MealGroupDetailScreen from '../screens/meal-groups/MealGroupDetailScreen';
import CreateMealGroupScreen from '../screens/meal-groups/CreateMealGroupScreen';
// Reservation screens
import MakeReservationScreen from '../screens/reservations/MakeReservationScreen';
import MyReservationsScreen from '../screens/reservations/MyReservationsScreen';
import ReservationDetailScreen from '../screens/reservations/ReservationDetailScreen';
import EditReservationScreen from '../screens/reservations/EditReservationScreen';
import RestaurantReservationsScreen from '../screens/restaurant-account/RestaurantReservationsScreen';

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<MainTabParamList>();

// Admin paneli kasıtlı koyu: "sistem konsolu" hissi her iki modda da korunur
const ADMIN_HEADER_OPTS = {
  headerTintColor: '#fff',
  headerBackTitle: '',
  headerStyle: { backgroundColor: '#1F1A24' },
  headerShadowVisible: false,
  headerTitleStyle: { color: '#fff', fontWeight: '700' as const },
};

function headerOpts(C: typeof lightColors) {
  return {
    headerTintColor: C.primary,
    headerBackTitle: '',
    headerStyle: { backgroundColor: C.surface },
    headerShadowVisible: false,
    headerTitleStyle: { color: C.textPrimary, fontWeight: '700' as const },
    headerRight: () => <NotificationBell />,
  };
}

function MainTabs() {
  const unreadCount = useMessageStore(s => s.unreadCount);
  const isDark = useThemeStore(s => s.isDark);
  const C = isDark ? darkColors : lightColors;

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: C.primary,
        tabBarInactiveTintColor: C.textMuted,
        tabBarStyle: { backgroundColor: C.surface, borderTopColor: C.border },
      }}
    >
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{
          title: 'Keşfet',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="compass" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Favorites"
        component={FavoritesScreen}
        options={{
          title: 'Favoriler',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="heart" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Collections"
        component={CollectionsScreen}
        options={{
          title: 'Listeler',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="list" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Messages"
        component={MessagesScreen}
        options={{
          title: 'Mesajlar',
          tabBarBadge: unreadCount > 0 ? unreadCount : undefined,
          tabBarBadgeStyle: { backgroundColor: C.primary, fontSize: 10 },
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="chatbubble-ellipses" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          title: 'Profil',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="person" size={size} color={color} />
          ),
        }}
      />
    </Tab.Navigator>
  );
}

function parseDeepLinkToken(url: string, path: string): string | null {
  if (!url.includes(path)) return null;
  const match = url.match(/[?&]token=([^&]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

export default function Navigation() {
  const { user, setUser, setSubscription, restaurantStatus, setRestaurantStatus } = useAuthStore();
  const fetchUnreadMessageCount = useMessageStore(s => s.fetchUnreadCount);
  const isDark = useThemeStore(s => s.isDark);
  const C = isDark ? darkColors : lightColors;
  const [isRestoring, setIsRestoring] = React.useState(true);

  React.useEffect(() => {
    function handleDeepLink(url: string) {
      const resetToken = parseDeepLinkToken(url, 'reset-password');
      if (resetToken) {
        navigationRef.current?.navigate('Onboarding', {
          screen: 'ResetPassword',
          params: { token: resetToken },
        });
        return;
      }

      const verifyToken = parseDeepLinkToken(url, 'verify-email');
      if (verifyToken) {
        verifyEmail(verifyToken)
          .then(() => Alert.alert('E-posta Doğrulandı', 'E-posta adresin başarıyla doğrulandı!'))
          .catch(() => Alert.alert('Hata', 'Geçersiz veya süresi dolmuş doğrulama bağlantısı.'));
      }
    }

    Linking.getInitialURL().then(url => { if (url) handleDeepLink(url); });
    const sub = Linking.addEventListener('url', ({ url }) => handleDeepLink(url));
    return () => sub.remove();
  }, []);

  React.useEffect(() => {
    async function restoreUserSession() {
      try {
        const hasToken = await restoreSession();
        if (hasToken) {
          const { user: me, subscription, restaurantProfile } = await getMe();
          if (subscription) setSubscription(subscription);
          setUser(me);
          if (restaurantProfile) {
            setRestaurantStatus({ status: restaurantProfile.status, rejectionReason: restaurantProfile.rejectionReason });
          }
          if (me.role === 'USER') fetchUnreadMessageCount();
        }
      } catch {
        await clearStoredToken();
      } finally {
        setIsRestoring(false);
      }
    }
    restoreUserSession();
  }, []);

  if (isRestoring) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: C.surface }}>
        <ActivityIndicator size="large" color={C.primary} />
      </View>
    );
  }

  const H = headerOpts(C);

  return (
    <>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <NavigationContainer ref={navigationRef}>
        <Stack.Navigator>
          {!user ? (
            <>
              <Stack.Screen
                name="Onboarding"
                component={OnboardingNavigator}
                options={{ headerShown: false }}
              />
              <Stack.Screen
                name="RestaurantRegister"
                component={RestaurantRegisterScreen}
                options={{ headerShown: false }}
              />
            </>
          ) : user.role === 'ADMIN' ? (
            // ─── Admin flow ────────────────────────────────────────────────────
            <>
              <Stack.Screen
                name="AdminDashboard"
                component={AdminDashboardScreen}
                options={{ headerShown: false }}
              />
              <Stack.Screen
                name="AdminRestaurantDetail"
                component={AdminRestaurantDetailScreen}
                options={{ ...ADMIN_HEADER_OPTS, title: 'Başvuru Detayı' }}
              />
              <Stack.Screen
                name="AdminLogs"
                component={AdminLogsScreen}
                options={{ headerShown: false }}
              />
            </>
          ) : user.role === 'RESTAURANT' ? (
            // ─── Restaurant flow ───────────────────────────────────────────────
            restaurantStatus?.status === 'APPROVED' ? (
              <>
                <Stack.Screen
                  name="RestaurantDashboard"
                  component={RestaurantDashboardScreen}
                  options={{ headerShown: false }}
                />
                <Stack.Screen
                  name="RestaurantHours"
                  component={RestaurantHoursScreen}
                  options={{ ...H, title: 'Çalışma Saatleri' }}
                />
                <Stack.Screen
                  name="RestaurantMenu"
                  component={RestaurantMenuScreen}
                  options={{ ...H, title: 'Menü Yönetimi' }}
                />
                <Stack.Screen
                  name="RestaurantDiscount"
                  component={RestaurantDiscountScreen}
                  options={{ ...H, title: 'İndirim Yönetimi' }}
                />
                <Stack.Screen
                  name="RestaurantCampaign"
                  component={RestaurantCampaignScreen}
                  options={{ ...H, title: 'Anlık Kampanya' }}
                />
                <Stack.Screen
                  name="RestaurantAnalytics"
                  component={RestaurantAnalyticsScreen}
                  options={{ ...H, title: 'Analitik Panel' }}
                />
                <Stack.Screen
                  name="RestaurantReviews"
                  component={RestaurantReviewsScreen}
                  options={{ ...H, title: 'Yorumlar & Cevaplar' }}
                />
                <Stack.Screen
                  name="RestaurantInfo"
                  component={RestaurantInfoScreen}
                  options={{ ...H, title: 'Restoran Bilgileri' }}
                />
                <Stack.Screen
                  name="RestaurantReservations"
                  component={RestaurantReservationsScreen}
                  options={{ ...H, title: 'Rezervasyonlar' }}
                />
                <Stack.Screen
                  name="ReservationDetail"
                  component={ReservationDetailScreen}
                  options={{ headerShown: false }}
                />
                <Stack.Screen
                  name="Notifications"
                  component={NotificationsScreen}
                  options={{ ...H, title: 'Bildirimler' }}
                />
                <Stack.Screen
                  name="Paywall"
                  component={PaywallScreen}
                  options={{ presentation: 'modal', headerShown: false }}
                />
              </>
            ) : (
              <Stack.Screen
                name="RestaurantPending"
                component={RestaurantPendingScreen}
                options={{ headerShown: false }}
                initialParams={{
                  status: (restaurantStatus?.status ?? 'PENDING') as ApprovalStatus,
                  rejectionReason: restaurantStatus?.rejectionReason,
                }}
              />
            )
          ) : (
            // ─── Regular user flow ─────────────────────────────────────────────
            <>
              <Stack.Screen
                name="Main"
                component={MainTabs}
                options={{ headerShown: false }}
              />
              <Stack.Screen
                name="RestaurantDetail"
                component={RestaurantDetailScreen}
                options={{ headerShown: false }}
              />
              <Stack.Screen
                name="Paywall"
                component={PaywallScreen}
                options={{ presentation: 'modal', headerShown: false }}
              />
              <Stack.Screen
                name="EditProfile"
                component={EditProfileScreen}
                options={{ ...H, title: 'Profili Düzenle' }}
              />
              <Stack.Screen
                name="Friends"
                component={FriendsScreen}
                options={{ ...H, title: 'Arkadaşlar' }}
              />
              <Stack.Screen
                name="ActivityFeed"
                component={ActivityFeedScreen}
                options={{ ...H, title: 'Arkadaş Aktiviteleri' }}
              />
              <Stack.Screen
                name="FriendSuggestions"
                component={FriendSuggestionsScreen}
                options={{ ...H, title: 'Arkadaş Önerileri' }}
              />
              <Stack.Screen
                name="WeeklySummary"
                component={WeeklySummaryScreen}
                options={{ ...H, title: 'Haftalık Özet' }}
              />
              <Stack.Screen
                name="FriendProfile"
                component={FriendProfileScreen}
                options={{ ...H, title: 'Profil' }}
              />
              <Stack.Screen
                name="SendRecommendation"
                component={SendRecommendationScreen}
                options={{ ...H, title: 'Restoran Öner', presentation: 'modal' }}
              />
              <Stack.Screen
                name="Rewards"
                component={RewardsScreen}
                options={{ ...H, title: 'Yıldızlarım & Ödüller' }}
              />
              <Stack.Screen
                name="Collections"
                component={CollectionsScreen}
                options={{ ...H, title: 'Koleksiyonlarım' }}
              />
              <Stack.Screen
                name="Diary"
                component={DiaryScreen}
                options={{ ...H, title: 'Yemek Günlüğüm' }}
              />
              <Stack.Screen
                name="Referral"
                component={ReferralScreen}
                options={{ ...H, title: 'Arkadaşını Davet Et' }}
              />
              <Stack.Screen
                name="NotificationPrefs"
                component={NotificationPrefsScreen}
                options={{ ...H, title: 'Bildirim Tercihleri' }}
              />
              <Stack.Screen
                name="CollectionDetail"
                component={CollectionDetailScreen}
                options={({ route }) => ({
                  ...H,
                  title: (route.params as any)?.title ?? 'Koleksiyon',
                })}
              />
              <Stack.Screen
                name="Notifications"
                component={NotificationsScreen}
                options={{ ...H, title: 'Bildirimler' }}
              />
              <Stack.Screen
                name="Recommendation"
                component={RecommendationScreen}
                options={{ ...H, title: 'AI Öneriler' }}
              />
              <Stack.Screen
                name="RouteRecommendation"
                component={RouteRecommendationScreen}
                options={{ ...H, title: 'Yolda Ne Yesem?' }}
              />
              <Stack.Screen
                name="PremiumUpsell"
                component={PremiumUpsellScreen}
                options={{ ...H, title: 'Premium\'a Geç', presentation: 'modal' }}
              />
              <Stack.Screen
                name="Conversation"
                component={ConversationScreen}
                options={({ route }) => {
                  const params = route.params as any;
                  const displayName: string = params?.displayName ?? 'Mesaj';
                  const photoUrl: string | null = params?.photoUrl ?? null;
                  return {
                    ...H,
                    headerTitle: () => (
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                        {photoUrl ? (
                          <Image
                            source={{ uri: photoUrl }}
                            style={{ width: 34, height: 34, borderRadius: 17 }}
                          />
                        ) : (
                          <View style={{
                            width: 34, height: 34, borderRadius: 17,
                            backgroundColor: C.primaryLight, alignItems: 'center', justifyContent: 'center',
                          }}>
                            <Text style={{ fontSize: 14, fontWeight: '700', color: C.primary }}>
                              {displayName.charAt(0).toUpperCase()}
                            </Text>
                          </View>
                        )}
                        <Text style={{ fontSize: 16, fontWeight: '700', color: C.textPrimary }}>
                          {displayName}
                        </Text>
                      </View>
                    ),
                  };
                }}
              />
              <Stack.Screen
                name="MealGroups"
                component={MealGroupsScreen}
                options={{ ...H, title: 'Gruplarım' }}
              />
              <Stack.Screen
                name="MealGroupDetail"
                component={MealGroupDetailScreen}
                options={({ route }) => ({
                  ...H,
                  title: (route.params as any)?.groupName ?? 'Grup',
                })}
              />
              <Stack.Screen
                name="CreateMealGroup"
                component={CreateMealGroupScreen}
                options={{ ...H, title: 'Grup Oluştur' }}
              />
              <Stack.Screen
                name="MakeReservation"
                component={MakeReservationScreen}
                options={{ headerShown: false }}
              />
              <Stack.Screen
                name="MyReservations"
                component={MyReservationsScreen}
                options={{ ...H, title: 'Rezervasyonlarım' }}
              />
              <Stack.Screen
                name="ReservationDetail"
                component={ReservationDetailScreen}
                options={{ headerShown: false }}
              />
              <Stack.Screen
                name="EditReservation"
                component={EditReservationScreen}
                options={{ headerShown: false }}
              />
            </>
          )}
        </Stack.Navigator>
      </NavigationContainer>
    </>
  );
}
