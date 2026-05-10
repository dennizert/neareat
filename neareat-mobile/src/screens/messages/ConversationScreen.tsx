import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  View, Text, FlatList, TextInput, TouchableOpacity,
  StyleSheet, KeyboardAvoidingView, Platform, ActivityIndicator,
  Image,
} from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { useAuthStore } from '../../store/authStore';
import { useMessageStore } from '../../store/messageStore';
import { getMessages, sendMessage } from '../../services/messages';
import type { Message } from '../../types';

function formatTime(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
}

function formatDay(dateStr: string): string {
  const d = new Date(dateStr);
  const today = new Date();
  const diff = Math.floor((today.getTime() - d.getTime()) / 86400000);
  if (diff === 0) return 'Bugün';
  if (diff === 1) return 'Dün';
  return d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long' });
}

export default function ConversationScreen() {
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const { userId, displayName, photoUrl } = route.params as {
    userId: string; displayName: string; photoUrl?: string | null;
  };
  const { user } = useAuthStore();
  const { markConversationRead, updateConversationAfterSend } = useMessageStore();

  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [text, setText] = useState('');
  const [hasMore, setHasMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const flatRef = useRef<FlatList>(null);

  useEffect(() => {
    navigation.setOptions({ title: displayName });
    load();
  }, [userId]);

  async function load() {
    setLoading(true);
    try {
      const data = await getMessages(userId);
      setMessages(data.messages);
      setHasMore(data.hasMore);
      setNextCursor(data.nextCursor);
      markConversationRead(userId);
    } finally {
      setLoading(false);
    }
  }

  async function loadMore() {
    if (!hasMore || loadingMore || !nextCursor) return;
    setLoadingMore(true);
    try {
      const data = await getMessages(userId, nextCursor);
      setMessages(prev => [...data.messages, ...prev]);
      setHasMore(data.hasMore);
      setNextCursor(data.nextCursor);
    } finally {
      setLoadingMore(false);
    }
  }

  async function handleSend() {
    const content = text.trim();
    if (!content || sending) return;
    setSending(true);
    setText('');
    try {
      const msg = await sendMessage(userId, content);
      setMessages(prev => [...prev, msg]);
      updateConversationAfterSend(userId, { id: userId, displayName, photoUrl }, msg);
      setTimeout(() => flatRef.current?.scrollToEnd({ animated: true }), 100);
    } catch {
      setText(content);
    } finally {
      setSending(false);
    }
  }

  function renderMessage({ item, index }: { item: Message; index: number }) {
    const isMine = item.senderId === user?.id;
    const prev = messages[index - 1];
    const showDay = !prev || formatDay(prev.createdAt) !== formatDay(item.createdAt);

    return (
      <>
        {showDay && (
          <View style={styles.dayRow}>
            <Text style={styles.dayText}>{formatDay(item.createdAt)}</Text>
          </View>
        )}
        <View style={[styles.bubble, isMine ? styles.bubbleMine : styles.bubbleTheir]}>
          <Text style={[styles.bubbleText, isMine && styles.bubbleTextMine]}>{item.content}</Text>
          <Text style={[styles.bubbleTime, isMine && styles.bubbleTimeMine]}>
            {formatTime(item.createdAt)}{isMine ? (item.isRead ? ' ✓✓' : ' ✓') : ''}
          </Text>
        </View>
      </>
    );
  }

  if (loading) {
    return <ActivityIndicator style={{ flex: 1 }} size="large" color="#FF6B35" />;
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={90}
    >
      <FlatList
        ref={flatRef}
        data={messages}
        keyExtractor={m => m.id}
        renderItem={renderMessage}
        contentContainerStyle={styles.listContent}
        onLayout={() => flatRef.current?.scrollToEnd({ animated: false })}
        onStartReached={loadMore}
        onStartReachedThreshold={0.2}
        ListHeaderComponent={loadingMore ? <ActivityIndicator style={{ margin: 12 }} color="#FF6B35" /> : null}
        ListEmptyComponent={
          <View style={styles.emptyChat}>
            <Text style={styles.emptyChatText}>Henüz mesaj yok. İlk mesajı sen gönder!</Text>
          </View>
        }
      />

      <View style={styles.inputBar}>
        <TextInput
          style={styles.input}
          value={text}
          onChangeText={setText}
          placeholder="Mesajınızı yazın..."
          placeholderTextColor="#9CA3AF"
          multiline
          maxLength={2000}
          returnKeyType="default"
        />
        <TouchableOpacity
          style={[styles.sendBtn, (!text.trim() || sending) && styles.sendBtnDisabled]}
          onPress={handleSend}
          disabled={!text.trim() || sending}
        >
          {sending ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.sendBtnText}>›</Text>
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  listContent: { paddingHorizontal: 12, paddingVertical: 12, flexGrow: 1 },
  dayRow: { alignItems: 'center', marginVertical: 12 },
  dayText: { fontSize: 12, color: '#9CA3AF', backgroundColor: '#F3F4F6', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 10 },
  bubble: {
    maxWidth: '78%', borderRadius: 18, paddingHorizontal: 14, paddingVertical: 8,
    marginBottom: 4,
  },
  bubbleMine: { backgroundColor: '#FF6B35', alignSelf: 'flex-end', borderBottomRightRadius: 4 },
  bubbleTheir: { backgroundColor: '#fff', alignSelf: 'flex-start', borderBottomLeftRadius: 4, shadowColor: '#000', shadowOpacity: 0.05, elevation: 1 },
  bubbleText: { fontSize: 15, color: '#111827', lineHeight: 20 },
  bubbleTextMine: { color: '#fff' },
  bubbleTime: { fontSize: 10, color: '#9CA3AF', marginTop: 2, alignSelf: 'flex-end' },
  bubbleTimeMine: { color: 'rgba(255,255,255,0.75)' },
  emptyChat: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 60 },
  emptyChatText: { fontSize: 14, color: '#9CA3AF', textAlign: 'center' },
  inputBar: {
    flexDirection: 'row', alignItems: 'flex-end',
    backgroundColor: '#fff', paddingHorizontal: 12, paddingVertical: 8,
    borderTopWidth: 1, borderTopColor: '#E5E7EB', gap: 8,
  },
  input: {
    flex: 1, backgroundColor: '#F3F4F6', borderRadius: 22,
    paddingHorizontal: 16, paddingVertical: 10, fontSize: 15,
    color: '#111827', maxHeight: 120,
  },
  sendBtn: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: '#FF6B35', alignItems: 'center', justifyContent: 'center',
  },
  sendBtnDisabled: { backgroundColor: '#D1D5DB' },
  sendBtnText: { fontSize: 26, color: '#fff', fontWeight: '700', lineHeight: 30 },
});
