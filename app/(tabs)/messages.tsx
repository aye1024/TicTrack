import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AssistantChat } from '../../src/components/AssistantChat';
import { ChatThread } from '../../src/components/ChatThread';
import { useApp } from '../../src/store/AppStore';
import { ASSISTANT_NAME } from '../../src/llm/tasks';
import { colors, radius, spacing, type } from '../../src/theme';

/**
 * The patient's messages.
 *
 * The clinician thread is the point of this screen and it opens on it. Doctor
 * Kit sits behind a second tab: the clinician answers in hours or days, and a
 * question about how to hold a competing response is worth an answer now. A
 * patient with no clinician linked gets Doctor Kit on his own, with no tabs to
 * choose between.
 */
type Tab = 'clinician' | 'assistant';

export default function Messages() {
  const { data } = useApp();
  const profile = data.profile;
  const clinicianId = profile?.clinicianId;
  const selfId = profile?.accountId;
  const hasClinician = Boolean(profile && clinicianId && selfId);

  const [tab, setTab] = useState<Tab>('clinician');
  const showing: Tab = hasClinician ? tab : 'assistant';

  // With no clinician linked, `showing` is always 'assistant', so the clinician
  // line only ever renders when there is a thread to write into.
  const subtitle =
    showing === 'assistant'
      ? `${ASSISTANT_NAME} is part of the app. He is not a clinician.`
      : `Write directly to ${profile?.clinicianName ?? 'your clinician'}.`;

  return (
    <SafeAreaView style={s.root} edges={['top']}>
      <View style={s.header}>
        <Text style={type.h1}>Messages</Text>
        <Text style={type.muted}>{subtitle}</Text>
      </View>

      {hasClinician && (
        <View style={s.tabs}>
          <TabButton
            label={profile?.clinicianName ?? 'Your clinician'}
            active={showing === 'clinician'}
            onPress={() => setTab('clinician')}
          />
          <TabButton
            label={ASSISTANT_NAME}
            active={showing === 'assistant'}
            onPress={() => setTab('assistant')}
          />
        </View>
      )}

      {showing === 'assistant' ? (
        <AssistantChat />
      ) : hasClinician ? (
        <ChatThread
          patientId={selfId!}
          clinicianId={clinicianId!}
          selfId={selfId!}
          empty={`No messages yet. Send a note and ${profile?.clinicianName ?? 'your clinician'} will see it here.`}
        />
      ) : null}
    </SafeAreaView>
  );
}

function TabButton({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
      style={({ pressed }) => [s.tab, active && s.tabActive, pressed && { opacity: 0.8 }]}
    >
      <Text style={[s.tabText, active && s.tabTextActive]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  header: { paddingHorizontal: spacing(2.5), paddingTop: spacing(1), gap: spacing(0.5) },
  tabs: {
    flexDirection: 'row',
    gap: spacing(0.5),
    marginHorizontal: spacing(2.5),
    marginTop: spacing(1.5),
    padding: 3,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
  },
  tab: {
    flex: 1,
    paddingVertical: spacing(1),
    borderRadius: radius.sm,
    alignItems: 'center',
  },
  tabActive: { backgroundColor: colors.surface },
  tabText: { fontSize: 14, fontWeight: '600', color: colors.textMuted },
  tabTextActive: { color: colors.text },
});
