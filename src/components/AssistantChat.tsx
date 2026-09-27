import React, { useRef, useState } from 'react';
import {
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
import { ASSISTANT_NAME, replyToPatient } from '../llm/tasks';
import { useApp } from '../store/AppStore';
import type { AssistantMessage } from '../types';
import { colors, radius, spacing, type } from '../theme';

/**
 * Conversation with Doctor Kit, the in-app model.
 *
 * Open to every patient, whether or not a clinician is linked. The transcript
 * lives on the patient's own record and is never part of the clinician thread,
 * so nothing said here reaches the clinician.
 */
export function AssistantChat() {
  const { data, update } = useApp();
  const [draft, setDraft] = useState('');
  const [pending, setPending] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const scroller = useRef<ScrollView>(null);
  const stored = data.assistantMessages ?? [];

  const send = async () => {
    const body = draft.trim();
    if (!body || sending) return;
    setDraft('');
    setPending(body);
    setSending(true);
    const userMessage: AssistantMessage = {
      id: `a_${Date.now().toString(36)}`,
      role: 'user',
      text: body,
      createdAt: new Date().toISOString(),
    };
    try {
      const history = [...stored, userMessage];
      const reply = await replyToPatient(data, history);
      const assistantMessage: AssistantMessage = {
        id: `a_${Date.now().toString(36)}_r`,
        role: 'assistant',
        text: reply,
        createdAt: new Date().toISOString(),
      };
      update((next) => {
        next.assistantMessages = [...(next.assistantMessages ?? []), userMessage, assistantMessage];
      });
    } finally {
      setPending(null);
      setSending(false);
      requestAnimationFrame(() => scroller.current?.scrollToEnd({ animated: true }));
    }
  };

  const rows = [
    ...stored.map((message) => ({ id: message.id, mine: message.role === 'user', text: message.text, time: message.createdAt })),
    ...(pending ? [{ id: 'pending', mine: true, text: pending, time: new Date().toISOString() }] : []),
    ...(sending ? [{ id: 'live', mine: false, text: `${ASSISTANT_NAME} is typing…`, time: '' }] : []),
  ];

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        ref={scroller}
        style={{ flex: 1 }}
        contentContainerStyle={s.transcript}
        keyboardShouldPersistTaps="handled"
        onContentSizeChange={() => scroller.current?.scrollToEnd({ animated: false })}
      >
        {rows.length === 0 ? (
          <Text style={[type.muted, { textAlign: 'center', marginTop: spacing(4) }]}>
            Ask {ASSISTANT_NAME} about urges, competing responses, or what your own numbers are
            showing. He is part of the app and he cannot diagnose or prescribe. Anything that
            changes your treatment goes to your clinician.
          </Text>
        ) : (
          rows.map((row) => (
            <View key={row.id} style={[s.bubbleWrap, row.mine ? s.mine : s.theirs]}>
              <View style={[s.bubble, row.mine ? s.bubbleMine : s.bubbleTheirs]}>
                <Text style={[type.body, row.mine && { color: colors.white }]}>{row.text}</Text>
              </View>
              {row.time ? <Text style={s.time}>{formatWhen(row.time)}</Text> : null}
            </View>
          ))
        )}
      </ScrollView>
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
