/**
 * messageStore Tests
 *
 * Tests for the Zustand-based message store.
 * The services/messages module is mocked because it makes HTTP requests.
 * Store state is reset before each test to prevent cross-test pollution.
 */

// Mock the network-dependent services layer
jest.mock('../../services/messages', () => ({
  getConversations: jest.fn(),
  getUnreadMessageCount: jest.fn(),
}));

import { useMessageStore } from '../../store/messageStore';
import type { Conversation, Message } from '../../types';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const INITIAL_STATE = {
  conversations: [],
  unreadCount: 0,
};

function resetStore() {
  useMessageStore.setState(INITIAL_STATE);
}

function makeProfile(id = 'user-2') {
  return { id, displayName: 'Other User', photoUrl: null };
}

function makeConversation(
  userId: string,
  unreadCount = 0,
  overrides: Partial<Conversation> = {},
): Conversation {
  return {
    userId,
    profile: makeProfile(userId),
    lastMessage: {
      content: 'Hello',
      createdAt: new Date().toISOString(),
      isRead: unreadCount === 0,
      isMine: false,
    },
    unreadCount,
    ...overrides,
  };
}

function makeMessage(overrides: Partial<Message> = {}): Message {
  return {
    id: 'msg-1',
    senderId: 'user-1',
    receiverId: 'user-2',
    content: 'Hi there!',
    isRead: false,
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  resetStore();
  jest.clearAllMocks();
});

describe('messageStore — initial state', () => {
  it('conversations is an empty array', () => {
    expect(useMessageStore.getState().conversations).toEqual([]);
  });

  it('unreadCount is 0', () => {
    expect(useMessageStore.getState().unreadCount).toBe(0);
  });
});

describe('messageStore — updateConversationAfterSend()', () => {
  it('adds a new conversation when the user is not already in the list', () => {
    const profile = makeProfile('user-2');
    const message = makeMessage({ senderId: 'user-1', receiverId: 'user-2' });

    useMessageStore.getState().updateConversationAfterSend('user-2', profile, message);

    const { conversations } = useMessageStore.getState();
    expect(conversations).toHaveLength(1);
    expect(conversations[0].userId).toBe('user-2');
  });

  it('updates an existing conversation instead of duplicating it', () => {
    const existing = makeConversation('user-2', 1);
    useMessageStore.setState({ conversations: [existing], unreadCount: 1 });

    const profile = makeProfile('user-2');
    const message = makeMessage({ content: 'Updated message' });

    useMessageStore.getState().updateConversationAfterSend('user-2', profile, message);

    const { conversations } = useMessageStore.getState();
    expect(conversations).toHaveLength(1);
    expect(conversations[0].lastMessage.content).toBe('Updated message');
  });

  it('moves the updated conversation to the top of the list', () => {
    const convA = makeConversation('user-A');
    const convB = makeConversation('user-B');
    useMessageStore.setState({ conversations: [convA, convB], unreadCount: 0 });

    const profile = makeProfile('user-B');
    const message = makeMessage({ receiverId: 'user-B' });

    useMessageStore.getState().updateConversationAfterSend('user-B', profile, message);

    expect(useMessageStore.getState().conversations[0].userId).toBe('user-B');
    expect(useMessageStore.getState().conversations[1].userId).toBe('user-A');
  });

  it('sets lastMessage.isMine to true on the updated conversation', () => {
    const profile = makeProfile('user-2');
    const message = makeMessage();

    useMessageStore.getState().updateConversationAfterSend('user-2', profile, message);

    expect(useMessageStore.getState().conversations[0].lastMessage.isMine).toBe(true);
  });

  it('preserves existing unreadCount when updating a conversation', () => {
    const existing = makeConversation('user-2', 3);
    useMessageStore.setState({ conversations: [existing], unreadCount: 3 });

    useMessageStore
      .getState()
      .updateConversationAfterSend('user-2', makeProfile('user-2'), makeMessage());

    expect(useMessageStore.getState().conversations[0].unreadCount).toBe(3);
  });
});

describe('messageStore — markConversationRead()', () => {
  it('sets unreadCount to 0 for the specified conversation', () => {
    const conv = makeConversation('user-2', 4);
    useMessageStore.setState({ conversations: [conv], unreadCount: 4 });

    useMessageStore.getState().markConversationRead('user-2');

    expect(useMessageStore.getState().conversations[0].unreadCount).toBe(0);
  });

  it('decrements global unreadCount by the conversation unread delta', () => {
    const conv = makeConversation('user-2', 3);
    useMessageStore.setState({ conversations: [conv], unreadCount: 5 }); // 5 total (2 from elsewhere)

    useMessageStore.getState().markConversationRead('user-2');

    expect(useMessageStore.getState().unreadCount).toBe(2);
  });

  it('does not go below 0 for global unreadCount', () => {
    // Edge case: global counter is out of sync (less than conversation's unread)
    const conv = makeConversation('user-2', 10);
    useMessageStore.setState({ conversations: [conv], unreadCount: 2 });

    useMessageStore.getState().markConversationRead('user-2');

    expect(useMessageStore.getState().unreadCount).toBe(0);
  });

  it('does nothing if the conversation is already read (unreadCount === 0)', () => {
    const conv = makeConversation('user-2', 0);
    useMessageStore.setState({ conversations: [conv], unreadCount: 0 });

    useMessageStore.getState().markConversationRead('user-2');

    expect(useMessageStore.getState().conversations[0].unreadCount).toBe(0);
    expect(useMessageStore.getState().unreadCount).toBe(0);
  });

  it('does not affect other conversations in the list', () => {
    const convA = makeConversation('user-A', 2);
    const convB = makeConversation('user-B', 5);
    useMessageStore.setState({ conversations: [convA, convB], unreadCount: 7 });

    useMessageStore.getState().markConversationRead('user-A');

    const { conversations } = useMessageStore.getState();
    expect(conversations.find(c => c.userId === 'user-A')!.unreadCount).toBe(0);
    expect(conversations.find(c => c.userId === 'user-B')!.unreadCount).toBe(5);
    expect(useMessageStore.getState().unreadCount).toBe(5);
  });

  it('does nothing when the userId does not match any conversation', () => {
    const conv = makeConversation('user-2', 3);
    useMessageStore.setState({ conversations: [conv], unreadCount: 3 });

    useMessageStore.getState().markConversationRead('non-existent-user');

    expect(useMessageStore.getState().unreadCount).toBe(3);
    expect(useMessageStore.getState().conversations[0].unreadCount).toBe(3);
  });
});

describe('messageStore — clear()', () => {
  it('resets conversations to an empty array', () => {
    useMessageStore.setState({
      conversations: [makeConversation('user-2', 1)],
      unreadCount: 1,
    });

    useMessageStore.getState().clear();

    expect(useMessageStore.getState().conversations).toEqual([]);
  });

  it('resets unreadCount to 0', () => {
    useMessageStore.setState({ conversations: [], unreadCount: 5 });

    useMessageStore.getState().clear();

    expect(useMessageStore.getState().unreadCount).toBe(0);
  });
});

describe('messageStore — fetchConversations()', () => {
  it('updates conversations and calculates total unreadCount from the response', async () => {
    const { getConversations } = require('../../services/messages');
    const serverConvs: Conversation[] = [
      makeConversation('user-A', 2),
      makeConversation('user-B', 3),
    ];
    getConversations.mockResolvedValueOnce(serverConvs);

    await useMessageStore.getState().fetchConversations();

    expect(useMessageStore.getState().conversations).toEqual(serverConvs);
    expect(useMessageStore.getState().unreadCount).toBe(5);
  });

  it('does not throw when the API call fails', async () => {
    const { getConversations } = require('../../services/messages');
    getConversations.mockRejectedValueOnce(new Error('Network error'));

    await expect(useMessageStore.getState().fetchConversations()).resolves.toBeUndefined();
  });
});

describe('messageStore — fetchUnreadCount()', () => {
  it('updates unreadCount from the API response', async () => {
    const { getUnreadMessageCount } = require('../../services/messages');
    getUnreadMessageCount.mockResolvedValueOnce(7);

    await useMessageStore.getState().fetchUnreadCount();

    expect(useMessageStore.getState().unreadCount).toBe(7);
  });

  it('does not throw when the API call fails', async () => {
    const { getUnreadMessageCount } = require('../../services/messages');
    getUnreadMessageCount.mockRejectedValueOnce(new Error('Network error'));

    await expect(useMessageStore.getState().fetchUnreadCount()).resolves.toBeUndefined();
  });
});
