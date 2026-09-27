import React, { useEffect, useLayoutEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text } from 'react-native';
import { Redirect, useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import { OnboardingBackButton } from '../src/components/OnboardingMotion';
import { Button, EmptyState, Screen, ScreenWithFooter } from '../src/components/ui';
import { OptionList } from '../src/components/OptionList';
import { INSTITUTIONS } from '../src/data/institutions';
import { useApp } from '../src/store/AppStore';
import { listClinicians, type ClinicianOption } from '../src/store/backend';
import { colors, spacing, type } from '../src/theme';

/**
 * A patient links a clinician, or continues without one. The same screen is
 * opened again from Profile when they want to change that choice.
 */
export default function ChooseClinician() {
  const router = useRouter();
  const navigation = useNavigation();
  const { change } = useLocalSearchParams<{ change?: string }>();
  const changing = change === '1';
  const { ready, signedIn, data, update } = useApp();
  const [institution, setInstitution] = useState<string | null>(null);
  const [clinicians, setClinicians] = useState<ClinicianOption[] | null>(null);
  const [clinicianId, setClinicianId] = useState<string | null>(null);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerBackVisible: false,
      headerLeft: () => (
        <OnboardingBackButton
          onPress={() => {
            if (institution) setInstitution(null);
            else if (changing) {
              if (router.canGoBack()) router.back();
              else router.replace('/(tabs)/profile');
            } else router.replace('/welcome');
          }}
        />
      ),
    });
  }, [navigation, institution, router, changing]);

  useEffect(() => {
    if (!institution) return;
    let cancelled = false;
    setClinicians(null);
    setClinicianId(null);
    listClinicians(institution)
      .then((rows) => {
        if (!cancelled) setClinicians(rows);
      })
      .catch(() => {
        if (!cancelled) setClinicians([]);
      });
    return () => {
      cancelled = true;
    };
  }, [institution]);

  if (!ready) {
    return (
      <Screen scroll={false} style={s.centre}>
        <ActivityIndicator color={colors.primary} />
      </Screen>
    );
  }
  if (!signedIn) return <Redirect href="/sign-in" />;
  if (data.profile?.role === 'clinician') return <Redirect href="/clinician" />;
  if (!changing && (data.profile?.clinicianId || data.profile?.skippedClinician)) {
    return <Redirect href={data.onboarded ? '/(tabs)' : '/onboarding/welcome'} />;
  }

  const skip = () => {
    update((draft) => {
      if (!draft.profile) return;
      draft.profile.institution = null;
      draft.profile.clinicianId = null;
      draft.profile.clinicianName = null;
      draft.profile.skippedClinician = true;
    });
    router.replace(data.onboarded ? '/(tabs)' : '/onboarding/welcome');
  };

  const confirm = () => {
    const chosen = clinicians?.find((row) => row.id === clinicianId);
    if (!institution || !chosen) return;
    update((draft) => {
      if (!draft.profile) return;
      draft.profile.institution = institution;
      draft.profile.clinicianId = chosen.id;
      draft.profile.clinicianName = chosen.displayName;
      draft.profile.skippedClinician = false;
    });
    router.replace(data.onboarded ? '/(tabs)' : '/onboarding/welcome');
  };

  // Picking an institution advances on the tap itself, so there is nothing to
  // confirm and no footer to put it in. Picking a clinician commits a choice,
  // so that step gets the same footer as every other confirm in the app.
  if (!institution) {
    return (
      <ScreenWithFooter
        footer={
          <Button
            title="I do not have a healthcare provider"
            variant="secondary"
            onPress={skip}
          />
        }
      >
        <Text style={type.h2}>Where do you receive care?</Text>
        <Text style={type.muted}>
          Choose your medical institution. Next you will pick a clinician there who already has a
          TicTrack account.
        </Text>
        <OptionList
          options={INSTITUTIONS.map((name) => ({ id: name, label: name }))}
          value={null}
          onChange={setInstitution}
        />
      </ScreenWithFooter>
    );
  }

  return (
    <ScreenWithFooter
      footer={
        <>
          <Button title="Continue" onPress={confirm} disabled={!clinicianId} />
          <Button
            title="I do not have a healthcare provider"
            variant="secondary"
            onPress={skip}
          />
        </>
      }
    >
      <Text style={type.h2}>Who is your clinician?</Text>
      <Text style={type.muted}>These clinicians at {institution} have a TicTrack account.</Text>
      <Text style={s.change} onPress={() => setInstitution(null)}>
        Choose a different institution
      </Text>
      {clinicians === null ? (
        <ActivityIndicator color={colors.primary} />
      ) : clinicians.length === 0 ? (
        <EmptyState
          title="No clinicians yet"
          body="No clinician at this institution has a TicTrack account yet. Ask them to sign up, then choose this institution again."
        />
      ) : (
        <OptionList
          options={clinicians.map((row) => ({
            id: row.id,
            label: row.displayName,
            detail: `@${row.username}`,
          }))}
          value={clinicianId}
          onChange={setClinicianId}
        />
      )}
    </ScreenWithFooter>
  );
}

const s = StyleSheet.create({
  centre: { alignItems: 'center', justifyContent: 'center' },
  change: { ...type.body, color: colors.primary, fontWeight: '600', marginTop: -spacing(0.5) },
});
