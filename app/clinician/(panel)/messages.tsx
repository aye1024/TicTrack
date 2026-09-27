import React, { useCallback, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Redirect, useFocusEffect, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Card, EmptyState, Screen } from '../../../src/components/ui';
import { useApp } from '../../../src/store/AppStore';
import { listInbox, type InboxRow } from '../../../src/store/backend';
import { colors, spacing, type } from '../../../src/theme';

export default function ClinicianMessages() {
  const router = useRouter();
  const { ready, signedIn, data } = useApp();
  const [rows, setRows] = useState<InboxRow[] | null>(null);
  const isClinician = data.profile?.role === 'clinician';
  const clinicianId = data.profile?.accountId;

  const refresh = useCallback(() => {
    if (!clinicianId) {
      setRows([]);
      return;
    }
    listInbox(clinicianId).then(setRows).catch(() => setRows([]));
  }, [clinicianId]);

  useFocusEffect(
    useCallback(() => {
      if (isClinician) refresh();
    }, [isClinician, refresh]),
  );

  if (!ready || (isClinician && !rows)) {
    return (
      <Screen scroll={false} style={s.centre}>
        <ActivityIndicator color={colors.primary} />
      </Screen>
    );
  }
  if (!signedIn) return <Redirect href="/clinician-sign-in" />;
  if (!isClinician || !rows) return <Redirect href="/" />;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top']}>
      <Screen>
        <Text style={type.h1}>Messages</Text>
        <Text style={type.muted}>Notes from the patients who chose you.</Text>
        {rows.length === 0 ? (
          <EmptyState
            title="No patients yet"
            body="When a patient chooses you, their messages show up here."
          />
        ) : (
          rows.map((row) => (
            <Card
              key={row.patientId}
              onPress={() =>
                router.push({ pathname: '/clinician/thread', params: { patient: row.patientId } })
              }
            >
              <View style={s.row}>
                <View style={{ flex: 1, gap: 4 }}>
                  <Text style={type.h3}>{row.displayName}</Text>
                  <Text style={type.muted} numberOfLines={2}>
                    {row.preview}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.textFaint} />
              </View>
            </Card>
          ))
        )}
      </Screen>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  centre: { alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing(1.5) },
});
