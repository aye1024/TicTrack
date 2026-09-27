import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Card, Divider, EmptyState, Screen } from '../../src/components/ui';
import { AddTicFlow } from '../../src/components/AddTicFlow';
import { BodyMap } from '../../src/components/BodyMap';
import { SeverityScale } from '../../src/components/SeverityScale';
import { FadeInUp, PressableScale } from '../../src/components/motion';
import { useApp } from '../../src/store/AppStore';
import { blockerById } from '../../src/data/blockers';
import { todayKey } from '../../src/logic/analysis';
import { pickTargetTic } from '../../src/logic/targeting';
import type { BodyRegion, Tic } from '../../src/types';
import { colors, radius, severityColor, spacing, type } from '../../src/theme';

type TicDraft = { description: string; severity: number; urge: number };

export default function Tics() {
  const router = useRouter();
  const { data, update } = useApp();
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<TicDraft | null>(null);

  const startEdit = (tic: Tic) => {
    setPendingDeleteId(null);
    setEditingId(tic.id);
    setDraft({ description: tic.description, severity: tic.severity, urge: tic.urge });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setDraft(null);
  };

  const saveEdit = (tic: Tic) => {
    if (!draft) return;
    const description = draft.description.trim();
    const severity = Math.max(1, draft.severity);
    const urge = Math.max(1, draft.urge);
    update((store) => {
      const item = store.tics.find((entry) => entry.id === tic.id);
      if (!item) return;
      item.description = description;
      item.severity = severity;
      item.urge = urge;
      const today = store.checkIns.find((checkIn) => checkIn.date === todayKey());
      const logged = today?.entries.find((entry) => entry.ticId === tic.id);
      if (logged) {
        logged.severity = severity;
        logged.urge = urge;
      }
      store.insight = null;
    });
    cancelEdit();
  };

  const removeTic = (tic: Tic) => {
    update((draft) => {
      draft.tics = draft.tics.filter((item) => item.id !== tic.id);
      if (draft.targetTicId === tic.id) {
        draft.targetTicId = pickTargetTic(draft.tics)?.id ?? null;
        draft.targetStreakDays = 0;
      }
      draft.insight = null;
    });
    setPendingDeleteId(null);
  };

  /** Worst severity per region drives the figure's colours. */
  const severityByRegion = data.tics.reduce<Partial<Record<BodyRegion, number>>>((acc, tic) => {
    acc[tic.region] = Math.max(acc[tic.region] ?? 0, tic.severity);
    return acc;
  }, {});

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top']}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
      <Screen>
        <Text style={type.h1}>Your tics</Text>
        <Text style={type.muted}>
          Everything you are tracking, shaded by how much it is interfering right now.
        </Text>

        <Card style={{ alignItems: 'center', paddingVertical: spacing(3) }}>
          <BodyMap severityByRegion={severityByRegion} />
        </Card>

        {data.tics.length === 0 ? (
          <EmptyState
            title="Nothing tracked yet"
            body="Add one below and it will show up here."
          />
        ) : (
          data.tics
            .slice()
            .sort((a, b) => b.severity - a.severity)
            .map((tic, index) => {
              const blocker = blockerById(tic.blockerIds[0]);
              return (
                <FadeInUp key={tic.id} index={index}>
                  <Card>
                    <PressableScale onPress={() => router.push(`/tic/${tic.id}`)}>
                      <View style={s.row}>
                        <View style={[s.chip, { backgroundColor: severityColor(tic.severity) }]}>
                          <Text style={s.chipText}>{Math.max(1, tic.severity)}</Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={type.h3}>{tic.name}</Text>
                          <Text style={type.small}>
                            {tic.kind === 'vocal' ? 'Vocal' : 'Motor'} · {tic.region[0].toUpperCase()}{tic.region.slice(1)} · urge {Math.max(1, tic.urge)}/5
                          </Text>
                        </View>
                        {tic.id === data.targetTicId && (
                          <View style={s.tag}>
                            <Text style={s.tagText}>TARGET</Text>
                          </View>
                        )}
                      </View>
                      {blocker && (
                        <Text style={[type.muted, { marginTop: spacing(1.5) }]}>
                          Blocker: {blocker.name}
                        </Text>
                      )}
                    </PressableScale>
                    {editingId === tic.id && draft && (
                      <View style={s.editor}>
                        <Divider />
                        <Text style={[type.label, { marginBottom: spacing(1) }]}>DESCRIPTION</Text>
                        <TextInput
                          style={s.description}
                          value={draft.description}
                          onChangeText={(description) =>
                            setDraft((current) => (current ? { ...current, description } : current))
                          }
                          placeholder="What happens"
                          placeholderTextColor={colors.textFaint}
                          multiline
                        />
                        <Text style={[type.label, { marginTop: spacing(2), marginBottom: spacing(1) }]}>
                          HOW MUCH IT INTERFERES WITH YOUR DAY
                        </Text>
                        <SeverityScale
                          min={1}
                          value={Math.max(1, draft.severity)}
                          onChange={(severity) =>
                            setDraft((current) => (current ? { ...current, severity } : current))
                          }
                        />
                        <Text style={[type.label, { marginTop: spacing(2), marginBottom: spacing(1) }]}>
                          THE FEELING JUST BEFORE IT HAPPENS
                        </Text>
                        <SeverityScale
                          value={draft.urge}
                          kind="urge"
                          onChange={(urge) => setDraft((current) => (current ? { ...current, urge } : current))}
                        />
                      </View>
                    )}
                    {pendingDeleteId === tic.id ? (
                      <View style={s.confirmRow}>
                        <Text style={s.confirmText}>Delete this tic?</Text>
                        <Pressable
                          accessibilityRole="button"
                          onPress={() => setPendingDeleteId(null)}
                          hitSlop={8}
                        >
                          <Text style={s.cancelText}>Cancel</Text>
                        </Pressable>
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel={`Confirm delete ${tic.name}`}
                          onPress={() => removeTic(tic)}
                          hitSlop={8}
                        >
                          <Text style={s.deleteText}>Delete</Text>
                        </Pressable>
                      </View>
                    ) : (
                      <View style={s.actions}>
                        {editingId === tic.id ? (
                          <>
                            <Pressable accessibilityRole="button" onPress={cancelEdit} hitSlop={8}>
                              <Text style={s.cancelText}>Cancel</Text>
                            </Pressable>
                            <Pressable
                              accessibilityRole="button"
                              accessibilityLabel={`Save ${tic.name}`}
                              onPress={() => saveEdit(tic)}
                              hitSlop={8}
                            >
                              <Text style={s.editText}>Save</Text>
                            </Pressable>
                          </>
                        ) : (
                          <>
                            <Pressable
                              accessibilityRole="button"
                              accessibilityLabel={`Edit ${tic.name}`}
                              onPress={() => startEdit(tic)}
                              hitSlop={8}
                            >
                              <Text style={s.editText}>Edit</Text>
                            </Pressable>
                            <Pressable
                              accessibilityRole="button"
                              accessibilityLabel={`Delete ${tic.name}`}
                              onPress={() => {
                                cancelEdit();
                                setPendingDeleteId(tic.id);
                              }}
                              hitSlop={8}
                            >
                              <Text style={s.deleteText}>Delete</Text>
                            </Pressable>
                          </>
                        )}
                      </View>
                    )}
                  </Card>
                </FadeInUp>
              );
            })
        )}

        <AddTicFlow />
      </Screen>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing(1.5) },
  chip: { width: 40, height: 40, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  chipText: { color: colors.white, fontWeight: '800', fontSize: 17 },
  tag: {
    backgroundColor: colors.primarySoft,
    paddingHorizontal: spacing(1),
    paddingVertical: 4,
    borderRadius: radius.sm,
  },
  tagText: { fontSize: 10, fontWeight: '800', color: colors.primary, letterSpacing: 0.6 },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: spacing(2),
    marginTop: spacing(1.5),
  },
  editText: { fontSize: 13, fontWeight: '700', color: colors.primary },
  editor: { marginTop: spacing(1) },
  description: {
    minHeight: 44,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing(1.5),
    paddingVertical: spacing(1),
    fontSize: 15,
    color: colors.text,
  },
  confirmRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: spacing(2),
    marginTop: spacing(1.5),
  },
  confirmText: { flex: 1, fontSize: 13, color: colors.textMuted },
  cancelText: { fontSize: 13, fontWeight: '700', color: colors.textMuted },
  deleteText: { fontSize: 13, fontWeight: '700', color: colors.danger },
});
