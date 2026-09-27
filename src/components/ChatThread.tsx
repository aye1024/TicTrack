import React, { useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { loadMessages, sendMessage } from '../store/backend';
import type { Message } from '../types';
import { colors, radius, spacing, type } from '../theme';

export function ChatThread({
  patientId,
  clinicianId,
  selfId,
  empty,
}: {
  patientId: string;
  clinicianId: string;
  selfId: string;
  empty: string;
}) {
  const [messages, setMessages] = useState<Message[] | null>(null);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const scroller = useRef<ScrollView>(null);

  const refresh = useCallback(() => {
    loadMessages(patientId, clinicianId)
      .then(setMessages)
      .catch(() => setMessages([]));
  }, [patientId, clinicianId]);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh]),
  );

  const send = async () => {
    const body = draft.trim();
    if (!body || sending) return;
    setSending(true);
    setDraft('');
    try {
      setMessages(await sendMessage(patientId, clinicianId, selfId, body));
      requestAnimationFrame(() => scroller.current?.scrollToEnd({ animated: true }));
    } finally {
      setSending(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {messages === null ? (
        <View style={s.centre}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : (
        <ScrollView
          ref={scroller}
          style={{ flex: 1 }}
          contentContainerStyle={s.transcript}
          keyboardShouldPersistTaps="handled"
          onContentSizeChange={() => scroller.current?.scrollToEnd({ animated: false })}
        >
          {messages.length === 0 ? (
            <Text style={[type.muted, { textAlign: 'center', marginTop: spacing(4) }]}>{empty}</Text>
          ) : (
            messages.map((message) => {
              const mine = message.fromId === selfId;
              return (
                <View key={message.id} style={[s.bubbleWrap, mine ? s.mine : s.theirs]}>
                  <View style={[s.bubble, mine ? s.bubbleMine : s.bubbleTheirs]}>
                    <Text style={[type.body, mine && { color: colors.white }]}>{message.text}</Text>
                  </View>
                  <Text style={s.time}>{formatWhen(message.createdAt)}</Text>
                </View>
              );
            })
          )}
        </ScrollView>
      )}

      <View style={s.composer}>
        <TextInput
          style={s.input}
          value={draft}
          onChangeText={setDraft}
          placeholder="Write a message"
          placeholderTextColor={colors.textFaint}
          multiline
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Send"
          onPress={send}
          disabled={!draft.trim() || sending}
          style={[s.send, (!draft.trim() || sending) && { opacity: 0.45 }]}
        >
          <Ionicons name="send" size={18} color={colors.white} />
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

function formatWhen(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

const s = StyleSheet.create({
  centre: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  transcript: { padding: spacing(2.5), gap: spacing(1.25), flexGrow: 1 },
  bubbleWrap: { maxWidth: '82%', gap: 4 },
  mine: { alignSelf: 'flex-end', alignItems: 'flex-end' },
  theirs: { alignSelf: 'flex-start', alignItems: 'flex-start' },
  bubble: { borderRadius: radius.lg, paddingHorizontal: spacing(1.75), paddingVertical: spacing(1.25) },
  bubbleMine: { backgroundColor: colors.primary },
  bubbleTheirs: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  time: { ...type.small },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing(1),
    paddingHorizontal: spacing(2),
    paddingVertical: spacing(1.25),
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
  },
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 120,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceAlt,
    paddingHorizontal: spacing(1.5),
    paddingVertical: spacing(1.25),
    fontSize: 16,
    color: colors.text,
  },
  send: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
