import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  View, Text, FlatList, TextInput, TouchableOpacity,
  StyleSheet, KeyboardAvoidingView, Platform, ActivityIndicator,
  Image, Alert,
} from 'react-native';
import { useRoute } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuthStore } from '../../store/authStore';
import { useMessageStore } from '../../store/messageStore';
import { getMessages, sendMessage } from '../../services/messages';
import type { Message } from '../../types';
import { useTheme } from '../../theme';
import type { Colors } from '../../theme';
import { listPerf } from '../../theme/listPerf';

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
  const { userId, displayName, photoUrl } = route.params as {
    userId: string; displayName: string; photoUrl?: string | null;
  };
  const { user } = useAuthStore();
  const { markConversationRead, updateConversationAfterSend } = useMessageStore();
  const { C } = useTheme();
  const styles = React.useMemo(() => makeStyles(C), [C]);
  const { bottom } = useSafeAreaInsets();

  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [text, setText] = useState('');
  const [hasMore, setHasMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const flatRef = useRef<FlatList>(null);

  useEffect(() => {
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
    } catch {
      Alert.alert('Hata', 'Mesajlar yüklenemedi. Lütfen tekrar deneyin.');
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
    } catch (err: any) {
      setText(content);
      const serverMsg = err?.response?.data?.error;
      Alert.alert('Mesaj Gönderilemedi', serverMsg ?? 'Bir hata oluştu. Lütfen tekrar deneyin.');
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
    return <ActivityIndicator style={{ flex: 1 }} size="large" color={C.primary} />;
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
        ListHeaderComponent={loadingMore ? <ActivityIndicator style={{ margin: 12 }} color={C.primary} /> : null}
        ListEmptyComponent={
          <View style={styles.emptyChat}>
            <Text style={styles.emptyChatText}>Henüz mesaj yok. İlk mesajı sen gönder!</Text>
          </View>
        }
        {...listPerf}
      />

      <View style={[styles.inputBar, { paddingBottom: bottom + 8 }]}>
        <TextInput
          style={styles.input}
          value={text}
          onChangeText={setText}
          placeholder="Mesajınızı yazın..."
          placeholderTextColor={C.textMuted}
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

function makeStyles(C: Colors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: C.background },
    listContent: { paddingHorizontal: 12, paddingVertical: 12, flexGrow: 1 },
    dayRow: { alignItems: 'center', marginVertical: 12 },
    dayText: { fontSize: 12, color: C.textMuted, backgroundColor: C.inputBg, paddingHorizontal: 10, paddingVertical: 3, borderRadius: 10 },
    bubble: {
      maxWidth: '78%', borderRadius: 18, paddingHorizontal: 14, paddingVertical: 8,
      marginBottom: 4,
    },
    bubbleMine: { backgroundColor: C.primary, alignSelf: 'flex-end', borderBottomRightRadius: 4 },
    bubbleTheir: { backgroundColor: C.surface, alignSelf: 'flex-start', borderBottomLeftRadius: 4, shadowColor: C.shadow, shadowOpacity: 0.05, elevation: 1 },
    bubbleText: { fontSize: 15, color: C.textPrimary, lineHeight: 20 },
    bubbleTextMine: { color: '#fff' },
    bubbleTime: { fontSize: 10, color: C.textMuted, marginTop: 2, alignSelf: 'flex-end' },
    bubbleTimeMine: { color: 'rgba(255,255,255,0.75)' },
    emptyChat: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 60 },
    emptyChatText: { fontSize: 14, color: C.textMuted, textAlign: 'center' },
    inputBar: {
      flexDirection: 'row', alignItems: 'flex-end',
      backgroundColor: C.surface, paddingHorizontal: 12, paddingVertical: 8,
      borderTopWidth: 1, borderTopColor: C.border, gap: 8,
    },
    input: {
      flex: 1, backgroundColor: C.inputBg, borderRadius: 22,
      paddingHorizontal: 16, paddingVertical: 10, fontSize: 15,
      color: C.textPrimary, maxHeight: 120,
    },
    sendBtn: {
      width: 44, height: 44, borderRadius: 22,
      backgroundColor: C.primary, alignItems: 'center', justifyContent: 'center',
    },
    sendBtnDisabled: { backgroundColor: C.disabled },
    sendBtnText: { fontSize: 26, color: '#fff', fontWeight: '700', lineHeight: 30 },
  });
}
