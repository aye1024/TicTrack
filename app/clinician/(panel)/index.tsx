import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Redirect, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, Card, EmptyState, Screen } from '../../../src/components/ui';
import { useApp } from '../../../src/store/AppStore';
import { listPatients, type PatientRow } from '../../../src/store/backend';
import { colors, radius, severityColor, spacing, type } from '../../../src/theme';

/**
 * The provider half of the sketch — one clinician looking at a caseload. Reads
 * the same collection the patient app writes to, just projected differently.
 */
export default function Clinician() {
  const router = useRouter();
  const { ready, signedIn, data, signOut } = useApp();
  const [rows, setRows] = useState<PatientRow[] | null>(null);
  const isClinician = data.profile?.role === 'clinician';
  const clinicianId = data.profile?.accountId;

  useEffect(() => {
    if (!isClinician) return;
    if (!clinicianId) {
      setRows([]);
      return;
    }
    listPatients(clinicianId).then(setRows).catch(() => setRows([]));
  }, [isClinician, clinicianId]);

  if (!ready || (isClinician && !rows)) {
    return (
      <Screen scroll={false} style={s.centre}>
        <ActivityIndicator color={colors.primary} />
      </Screen>
    );
  }
  if (!signedIn) return <Redirect href="/clinician-sign-in" />;
  if (!isClinician || !rows) return <Redirect href="/" />;

  const profile = data.profile!;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top']}>
      <Screen>
        <Text style={type.h2}>Caseload</Text>
        <Text style={type.muted}>
          {profile.displayName}
          {profile.institution ? ` · ${profile.institution}` : ''}
        </Text>

        {rows.length === 0 ? (
          <EmptyState title="No patients yet" body="Patients who choose you during sign-up show up here." />
        ) : (
          rows.map((row) => {
            const stale =
              !row.lastCheckIn ||
              (Date.now() - new Date(row.lastCheckIn).getTime()) / 86_400_000 > 3;
            return (
              <Card key={row.id} onPress={() => router.push({ pathname: '/report', params: { patient: row.id } })}>
                <View style={s.row}>
                  <View
                    style={[
                      s.chip,
                      { backgroundColor: severityColor(Math.round(row.averageSeverity)) },
                    ]}
                  >
                    <Text style={s.chipText}>{row.averageSeverity.toFixed(1)}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={type.h3}>{row.displayName}</Text>
                    <Text style={type.small}>
                      {row.ticCount} tics tracked · {row.checkInCount} check-ins
                    </Text>
                  </View>
                  {stale && (
                    <View style={s.alert}>
                      <Text style={s.alertText}>NO RECENT DATA</Text>
                    </View>
                  )}
                  <Ionicons name="chevron-forward" size={18} color={colors.textFaint} />
                </View>
                <Text style={[type.muted, { marginTop: spacing(1.25) }]}>
                  Last check-in: {row.lastCheckIn ?? 'never'}
                </Text>
              </Card>
            );
          })
        )}

        <Button
          title="Log out"
          variant="ghost"
          onPress={async () => {
            await signOut();
            router.replace('/welcome');
          }}
        />
      </Screen>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  centre: { alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing(1.5) },
  chip: { width: 44, height: 44, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  chipText: { color: colors.white, fontWeight: '800', fontSize: 15 },
  alert: {
    backgroundColor: '#FBEEDA',
    paddingHorizontal: spacing(1),
    paddingVertical: 4,
    borderRadius: radius.sm,
  },
  alertText: { fontSize: 9, fontWeight: '800', color: '#A96D14', letterSpacing: 0.5 },
});
