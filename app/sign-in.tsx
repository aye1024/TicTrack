import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Button, Screen } from '../src/components/ui';
import { Field } from './sign-up';
import { useApp } from '../src/store/AppStore';
import { colors, spacing, type } from '../src/theme';

export default function SignIn() {
  const router = useRouter();
  const { signIn } = useApp();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      await signIn(username, password, 'patient');
      router.replace('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not log in.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
      <Screen>
        <Text style={type.h2}>Welcome back</Text>
        <Text style={type.muted}>Patient account. This is where you track your own tics.</Text>
        <Field label="Username" value={username} onChange={setUsername} autoCapitalize="none" />
        <Field label="Password" value={password} onChange={setPassword} secure autoCapitalize="none" />
        {error && <Text style={s.error}>{error}</Text>}
        <Button title="Log in" onPress={submit} loading={busy} disabled={!username || !password} />
        <View style={s.links}>
          <Text
            style={s.link}
            onPress={() => router.push({ pathname: '/sign-up', params: { role: 'patient' } })}
          >
            Create a patient account
          </Text>
          <Text style={s.link} onPress={() => router.push('/clinician-sign-in')}>
            I am a clinician
          </Text>
        </View>
      </Screen>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  error: { ...type.muted, color: colors.danger },
  links: { gap: spacing(1.25), alignItems: 'center' },
  link: { ...type.body, color: colors.primary, fontWeight: '600' },
});
