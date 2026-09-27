import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { OnboardingBackButton } from '../../src/components/OnboardingMotion';
import { ChatThread } from '../../src/components/ChatThread';
import { useApp } from '../../src/store/AppStore';
import { getPatient } from '../../src/store/backend';
import { colors, spacing, type } from '../../src/theme';

export default function ClinicianThread() {
  const router = useRouter();
  const { patient } = useLocalSearchParams<{ patient?: string }>();
  const patientId = Array.isArray(patient) ? patient[0] : patient;
  const { data } = useApp();
  const clinicianId = data.profile?.accountId;
  const [name, setName] = useState<string | null>(null);

  useEffect(() => {
    if (!patientId) return;
    getPatient(patientId).then((found) => {
      setName(found?.profile?.displayName ?? 'Patient');
    });
  }, [patientId]);

  return (
    <SafeAreaView style={s.root} edges={['top']}>
      <View style={s.header}>
        <OnboardingBackButton onPress={() => router.back()} />
        <View style={{ flex: 1 }}>
          <Text style={type.h3}>{name ?? 'Messages'}</Text>
          <Text style={type.small}>Patient</Text>
        </View>
      </View>
      {!patientId || !clinicianId || !name ? (
        <View style={s.centre}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : (
        <ChatThread
          patientId={patientId}
          clinicianId={clinicianId}
          selfId={clinicianId}
          empty={`No messages yet. ${name} can write to you from their Messages tab, and you can write first.`}
        />
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(0.5),
    paddingRight: spacing(2),
    paddingLeft: spacing(1),
  },
  centre: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});