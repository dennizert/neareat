import React from 'react';
import { View, ActivityIndicator } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useAuthStore } from '../store/authStore';
import type { ApprovalStatus } from '../types';
import { restoreSession, getMe, clearStoredToken } from '../services/auth';
import type { RootStackParamList, MainTabParamList } from '../types';

import OnboardingNavigator from './OnboardingNavigator';
import HomeScreen from '../screens/home/HomeScreen';
import FavoritesScreen from '../screens/FavoritesScreen';
import ProfileScreen from '../screens/ProfileScreen';
import RestaurantDetailScreen from '../screens/restaurant/RestaurantDetailScreen';
import PaywallScreen from '../screens/PaywallScreen';
import EditProfileScreen from '../screens/profile/EditProfileScreen';
import FriendsScreen from '../screens/social/FriendsScreen';
import FriendSuggestionsScreen from '../screens/social/FriendSuggestionsScreen';
import FriendProfileScreen from '../screens/social/FriendProfileScreen';
import SendRecommendationScreen from '../screens/social/SendRecommendationScreen';
import RewardsScreen from '../screens/rewards/RewardsScreen';
import CollectionsScreen from '../screens/collections/CollectionsScreen';
import CollectionDetailScreen from '../screens/collections/CollectionDetailScreen';

// Restaurant account screens
import RestaurantRegisterScreen from '../screens/restaurant-account/RestaurantRegisterScreen';
import RestaurantPendingScreen from '../screens/restaurant-account/RestaurantPendingScreen';
import RestaurantDashboardScreen from '../screens/restaurant-account/RestaurantDashboardScreen';
import RestaurantHoursScreen from '../screens/restaurant-account/RestaurantHoursScreen';
import RestaurantMenuScreen from '../screens/restaurant-account/RestaurantMenuScreen';
import RestaurantDiscountScreen from '../screens/restaurant-account/RestaurantDiscountScreen';
import RestaurantReviewsScreen from '../screens/restaurant-account/RestaurantReviewsScreen';
import RestaurantInfoScreen from '../screens/restaurant-account/RestaurantInfoScreen';

// Admin screens
import AdminDashboardScreen from '../screens/admin/AdminDashboardScreen';
import AdminRestaurantDetailScreen from '../screens/admin/AdminRestaurantDetailScreen';
import NotificationsScreen from '../screens/NotificationsScreen';
import NotificationBell from '../components/NotificationBell';
import MessagesScreen from '../screens/messages/MessagesScreen';
import ConversationScreen from '../screens/messages/ConversationScreen';
import { useMessageStore } from '../store/messageStore';

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<MainTabParamList>();

function MainTabs() {
  const unreadCount = useMessageStore(s => s.unreadCount);

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#FF6B35',
        tabBarInactiveTintColor: '#9CA3AF',
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
          tabBarBadgeStyle: { backgroundColor: '#FF6B35', fontSize: 10 },
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

const HEADER_OPTS = {
  headerTintColor: '#FF6B35',
  headerBackTitle: '',
  headerStyle: { backgroundColor: '#fff' },
  headerShadowVisible: false,
  headerTitleStyle: { color: '#111827', fontWeight: '700' as const },
  headerRight: () => <NotificationBell />,
};

const ADMIN_HEADER_OPTS = {
  headerTintColor: '#fff',
  headerBackTitle: '',
  headerStyle: { backgroundColor: '#111827' },
  headerShadowVisible: false,
  headerTitleStyle: { color: '#fff', fontWeight: '700' as const },
};

export default function Navigation() {
  const { user, setUser, setSubscription, restaurantStatus, setRestaurantStatus } = useAuthStore();
  const fetchUnreadMessageCount = useMessageStore(s => s.fetchUnreadCount);
  const [isRestoring, setIsRestoring] = React.useState(true);

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
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' }}>
        <ActivityIndicator size="large" color="#FF6B35" />
      </View>
    );
  }

  return (
    <NavigationContainer>
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
                options={{ ...HEADER_OPTS, title: 'Çalışma Saatleri' }}
              />
              <Stack.Screen
                name="RestaurantMenu"
                component={RestaurantMenuScreen}
                options={{ ...HEADER_OPTS, title: 'Menü Yönetimi' }}
              />
              <Stack.Screen
                name="RestaurantDiscount"
                component={RestaurantDiscountScreen}
                options={{ ...HEADER_OPTS, title: 'İndirim Yönetimi' }}
              />
              <Stack.Screen
                name="RestaurantReviews"
                component={RestaurantReviewsScreen}
                options={{ ...HEADER_OPTS, title: 'Yorumlar & Cevaplar' }}
              />
              <Stack.Screen
                name="RestaurantInfo"
                component={RestaurantInfoScreen}
                options={{ ...HEADER_OPTS, title: 'İletişim Bilgileri' }}
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
              options={{ ...HEADER_OPTS, title: 'Profili Düzenle' }}
            />
            <Stack.Screen
              name="Friends"
              component={FriendsScreen}
              options={{ ...HEADER_OPTS, title: 'Arkadaşlar' }}
            />
            <Stack.Screen
              name="FriendSuggestions"
              component={FriendSuggestionsScreen}
              options={{ ...HEADER_OPTS, title: 'Arkadaş Önerileri' }}
            />
            <Stack.Screen
              name="FriendProfile"
              component={FriendProfileScreen}
              options={{ ...HEADER_OPTS, title: 'Profil' }}
            />
            <Stack.Screen
              name="SendRecommendation"
              component={SendRecommendationScreen}
              options={{ ...HEADER_OPTS, title: 'Restoran Öner', presentation: 'modal' }}
            />
            <Stack.Screen
              name="Rewards"
              component={RewardsScreen}
              options={{ ...HEADER_OPTS, title: 'Yıldızlarım & Ödüller' }}
            />
            <Stack.Screen
              name="Collections"
              component={CollectionsScreen}
              options={{ ...HEADER_OPTS, title: 'Koleksiyonlarım' }}
            />
            <Stack.Screen
              name="CollectionDetail"
              component={CollectionDetailScreen}
              options={({ route }) => ({
                ...HEADER_OPTS,
                title: (route.params as any)?.title ?? 'Koleksiyon',
              })}
            />
            <Stack.Screen
              name="Notifications"
              component={NotificationsScreen}
              options={{ ...HEADER_OPTS, title: 'Bildirimler' }}
            />
            <Stack.Screen
              name="Conversation"
              component={ConversationScreen}
              options={({ route }) => ({
                ...HEADER_OPTS,
                title: (route.params as any)?.displayName ?? 'Mesaj',
              })}
            />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
