import React from 'react';
import { render, fireEvent, screen } from '@testing-library/react-native';

// NOTIF-2 — satır-içi "okundu" butonu

const mockNavigate = jest.fn();
const mockMarkRead = jest.fn();
const mockStore = {
  notifications: [] as any[],
  loading: false,
  hasMore: false,
  unreadCount: 0,
  fetchNotifications: jest.fn(),
  loadMore: jest.fn(),
  markRead: mockMarkRead,
  markAllRead: jest.fn(),
  fetchUnreadCount: jest.fn(),
};

jest.mock('@react-navigation/native', () => ({ useNavigation: () => ({ navigate: mockNavigate }) }));
jest.mock('../../store/notificationStore', () => ({ useNotificationStore: () => mockStore }));

import NotificationsScreen from '../../screens/NotificationsScreen';

const unread = {
  id: 'n1', type: 'INSTANT_DISCOUNT', title: 'İndirim', body: 'Mekan indirimde',
  isRead: false, createdAt: new Date().toISOString(), data: { placeId: 'p1' },
};
const read = { ...unread, id: 'n2', isRead: true };

beforeEach(() => {
  jest.clearAllMocks();
  mockStore.notifications = [];
});

describe('NotificationsScreen — okundu butonu', () => {
  it('okunmamış bildirimde "okundu" butonu görünür', () => {
    mockStore.notifications = [unread];
    render(<NotificationsScreen />);
    expect(screen.getByLabelText('Okundu işaretle')).toBeTruthy();
  });

  it('okunmuş bildirimde buton görünmez', () => {
    mockStore.notifications = [read];
    render(<NotificationsScreen />);
    expect(screen.queryByLabelText('Okundu işaretle')).toBeNull();
  });

  it('butona basınca markRead çağrılır, navigation YAPILMAZ', () => {
    mockStore.notifications = [unread];
    render(<NotificationsScreen />);
    fireEvent.press(screen.getByLabelText('Okundu işaretle'));
    expect(mockMarkRead).toHaveBeenCalledWith('n1');
    expect(mockNavigate).not.toHaveBeenCalled();
  });
});
