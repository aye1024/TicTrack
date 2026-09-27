import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, Card, Divider, Screen } from '../../src/components/ui';
import { useApp } from '../../src/store/AppStore';
import { isOffline } from '../../src/store/backend';
import { hasLLM } from '../../src/config';
import { activeProviderLabel } from '../../src/asr/provider';
import { seedHistory } from '../../src/data/demo';
import { pairedDevices } from '../../src/data/wearable';
import { colors, radius, spacing, type } from '../../src/theme';
import type { Profile as ProfileType } from '../../src/types';

const GENDERS: ProfileType['gender'][] = ['male', 'female', 'other', 'unspecified'];

export default function Profile() {
  const router = useRouter();
  const { data, update, signOut, deleteAccount } = useApp();
  const profile = data.profile;
  const [age, setAge] = useState(profile?.age ? String(profile.age) : '');
  const [confirmReset, setConfirmReset] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const watchDevices = pairedDevices(data);
  const [onDevice, setOnDevice] = useState(false);

  useEffect(() => {
    isOffline().then(setOnDevice);
  }, []);
  const asrProvider = activeProviderLabel();

  const resetAccount = () => {
    update((draft) => {
      draft.onboarded = false;
      draft.tics = [];
      draft.checkIns = [];
      draft.targetTicId = null;
      draft.targetStreakDays = 0;
      draft.motorNarrative = '';
      draft.vocalNarrative = '';
      draft.insight = null;
    });
    router.replace('/onboarding/welcome');
  };

  if (!profile) return null;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top']}>
      <Screen>
        <Text style={type.h1}>Profile</Text>

        <Card>
          <Text style={type.label}>NAME</Text>
          <TextInput
            style={s.input}
            value={profile.displayName}
            onChangeText={(displayName) =>
              update((draft) => {
                if (draft.profile) draft.profile.displayName = displayName;
              })
            }
          />
          <Text style={[type.small, { marginTop: spacing(0.5) }]}>@{profile.username}</Text>

          <Divider />
          <Text style={type.label}>CLINICIAN</Text>
          <Text style={[type.h3, { marginTop: spacing(0.75) }]}>
            {profile.clinicianName && !profile.skippedClinician
              ? profile.clinicianName
              : 'No healthcare provider'}
          </Text>
          {profile.institution && profile.clinicianId && !profile.skippedClinician ? (
            <Text style={[type.small, { marginTop: spacing(0.5) }]}>{profile.institution}</Text>
          ) : null}
          <View style={{ height: spacing(1.5) }} />
          <Button
            title={profile.clinicianId && !profile.skippedClinician ? 'Change clinician' : 'Choose a clinician'}
            variant="secondary"
            onPress={() => router.push('/choose-clinician?change=1')}
          />

          <Divider />

          <Text style={type.label}>AGE</Text>
          <TextInput
            style={s.input}
            value={age}
            keyboardType="number-pad"
            placeholder="Optional"
            placeholderTextColor={colors.textFaint}
            onChangeText={(value) => {
              setAge(value);
              const parsed = parseInt(value, 10);
              update((draft) => {
                if (draft.profile) draft.profile.age = Number.isFinite(parsed) ? parsed : null;
              });
            }}
          />

          <Divider />

          <Text style={[type.label, { marginBottom: spacing(1) }]}>GENDER</Text>
          <View style={s.genders}>
            {GENDERS.map((gender) => (
              <Text
                key={gender}
                onPress={() =>
                  update((draft) => {
                    if (draft.profile) draft.profile.gender = gender;
                  })
                }
                style={[s.gender, profile.gender === gender && s.genderOn]}
              >
                {gender === 'unspecified' ? 'Prefer not to say' : gender[0].toUpperCase() + gender.slice(1)}
              </Text>
            ))}
          </View>
          <Text style={[type.small, { marginTop: spacing(1) }]}>
            Only used to put your numbers in context in the report. Never shared.
          </Text>
        </Card>

        <Card onPress={() => router.push('/watch')}>
          <View style={s.rowBetween}>
            <Text style={type.label}>DEVICE</Text>
            <Ionicons name="chevron-forward" size={17} color={colors.textFaint} />
          </View>
          <Text style={[type.h3, { marginTop: spacing(0.75) }]}>
            {watchDevices.length === 0
              ? 'No wearable paired'
              : watchDevices.length === 1
                ? watchDevices[0].name
                : `${watchDevices.length} devices paired`}
          </Text>
          <Text style={[type.small, { marginTop: spacing(0.5) }]}>
            {watchDevices.length === 0
              ? 'Count tics between check-ins'
              : watchDevices.length === 1
                ? watchDevices[0].sensors
                : watchDevices.map((d) => d.name).join(' · ')}
          </Text>
        </Card>

        <Card>
          <Text style={type.label}>SERVICES</Text>
          <View style={{ height: spacing(1) }} />
          <ServiceRow
            label={asrProvider ? `Speech recognition (${asrProvider})` : 'Speech recognition'}
            ok={asrProvider != null}
          />
          <ServiceRow label="Summaries and reports (GLM)" ok={hasLLM()} />
          <ServiceRow label="Account server" ok={!onDevice} />
          <Text style={[type.small, { marginTop: spacing(1) }]}>
            {onDevice
              ? 'No server was reachable, so this account and its history live on this phone. Everything works; nothing syncs to another device.'
              : 'With the model offline the app still works. Summaries fall back to on-device rules.'}
          </Text>
        </Card>

        <Card>
          <Text style={type.label}>DEMO</Text>
          <View style={{ height: spacing(1.5) }} />
          <Button
            title={data.checkIns.length > 0 ? 'Replace with 14 days of sample history' : 'Load 14 days of sample history'}
            variant="secondary"
            onPress={() =>
              update((draft) => {
                draft.checkIns = seedHistory(draft);
                const latest = draft.checkIns[draft.checkIns.length - 1];
                for (const entry of latest?.entries ?? []) {
                  const tic = draft.tics.find((t) => t.id === entry.ticId);
                  if (tic) {
                    tic.severity = entry.severity;
                    tic.urge = entry.urge;
                  }
                }
                draft.targetStreakDays = draft.checkIns.length;
                draft.insight = null;
              })
            }
          />
          {data.checkIns.length > 0 && (
            <>
              <View style={{ height: spacing(1) }} />
              <Button
                title="Clear all history"
                variant="ghost"
                onPress={() =>
                  update((draft) => {
                    draft.checkIns = [];
                    draft.targetStreakDays = 0;
                    draft.insight = null;
                  })
                }
              />
            </>
          )}
          <View style={{ height: spacing(1) }} />
          <Button
            title="Reset account"
            variant="ghost"
            onPress={() => {
              setConfirmDelete(false);
              setConfirmReset((open) => !open);
            }}
          />
          {confirmReset && (
            <>
              <View style={{ height: spacing(1) }} />
              <Text style={type.muted}>
                This deletes the tics, history, and onboarding answers on this account, then starts
                setup again. Your login stays.
              </Text>
              <View style={{ height: spacing(1) }} />
              <Button title="Cancel" variant="ghost" onPress={() => setConfirmReset(false)} />
              <View style={{ height: spacing(1) }} />
              <Button title="Reset and redo onboarding" variant="danger" onPress={resetAccount} />
            </>
          )}
          <View style={{ height: spacing(1) }} />
          <Button
            title="Delete account"
            variant="ghost"
            onPress={() => {
              setConfirmReset(false);
              setConfirmDelete((open) => !open);
            }}
          />
          {confirmDelete && (
            <>
              <View style={{ height: spacing(1) }} />
              <Text style={type.muted}>
                This removes the account from this device, including the login. You can sign up
                with the same username again.
              </Text>
              <View style={{ height: spacing(1) }} />
              <Button title="Cancel" variant="ghost" onPress={() => setConfirmDelete(false)} />
              <View style={{ height: spacing(1) }} />
              <Button
                title="Delete this account"
                variant="danger"
                onPress={async () => {
                  await deleteAccount();
                  router.replace('/welcome');
                }}
              />
            </>
          )}
        </Card>

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

function ServiceRow({ label, ok }: { label: string; ok: boolean }) {
  return (
    <View style={s.serviceRow}>
      <View style={[s.dot, { backgroundColor: ok ? colors.accent : colors.textFaint }]} />
      <Text style={[type.body, { flex: 1 }]}>{label}</Text>
      <Text style={[type.small, { color: ok ? colors.accent : colors.textFaint, fontWeight: '700' }]}>
        {ok ? 'CONNECTED' : 'OFF'}
      </Text>
    </View>
  );
}

const s = StyleSheet.create({
  input: {
    fontSize: 17,
    color: colors.text,
    paddingVertical: spacing(0.75),
    fontWeight: '600',
  },
  genders: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing(1) },
  gender: {
    backgroundColor: colors.surfaceAlt,
    color: colors.textMuted,
    fontWeight: '600',
    fontSize: 14,
    overflow: 'hidden',
    paddingHorizontal: spacing(1.5),
    paddingVertical: spacing(0.9),
    borderRadius: radius.pill,
  },
  genderOn: { backgroundColor: colors.primary, color: colors.white },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  serviceRow: { flexDirection: 'row', alignItems: 'center', gap: spacing(1.25), paddingVertical: spacing(0.75) },
  dot: { width: 9, height: 9, borderRadius: 5 },
});
