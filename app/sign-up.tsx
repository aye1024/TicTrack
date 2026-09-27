import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { OptionList } from '../src/components/OptionList';
import { Button, ScreenWithFooter } from '../src/components/ui';
import { INSTITUTIONS } from '../src/data/institutions';
import { useApp } from '../src/store/AppStore';
import type { AccountRole } from '../src/types';
import { colors, radius, spacing, type } from '../src/theme';

const ROLES: { id: AccountRole; label: string }[] = [
  { id: 'patient', label: 'Patient' },
  { id: 'clinician', label: 'Clinician' },
];

export default function SignUp() {
  const router = useRouter();
  const params = useLocalSearchParams<{ role?: string }>();
  const { signUp } = useApp();
  const [role, setRole] = useState<AccountRole>(params.role === 'clinician' ? 'clinician' : 'patient');
  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [institution, setInstitution] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (params.role === 'clinician' || params.role === 'patient') setRole(params.role);
  }, [params.role]);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      await signUp(username, password, displayName, role, institution);
      router.replace(role === 'clinician' ? '/clinician' : '/choose-clinician');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create the account.');
    } finally {
      setBusy(false);
    }
  };

  const ready =
    Boolean(username.trim()) &&
    Boolean(password) &&
    (role === 'patient' || INSTITUTIONS.some((name) => name === institution));

  return (
    <ScreenWithFooter
      footer={<Button title="Continue" onPress={submit} loading={busy} disabled={!ready} />}
    >
      <Text style={type.h2}>{role === 'clinician' ? 'Set up a clinician account' : 'Set up your account'}</Text>
        <Text style={type.muted}>
          {role === 'clinician'
            ? 'You will see the patients who have accounts on this device.'
            : 'Everything you record stays on this device until you choose to share a report.'}
        </Text>

        <View style={{ gap: spacing(1) }}>
          <Text style={type.label}>I AM A</Text>
          <View style={s.roles}>
            {ROLES.map((option) => {
              const selected = role === option.id;
              return (
                <Pressable
                  key={option.id}
                  onPress={() => setRole(option.id)}
                  style={[s.role, selected && s.roleOn]}
                >
                  <Text style={[s.roleLabel, selected && s.roleLabelOn]}>{option.label}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <Field label="What should we call you?" value={displayName} onChange={setDisplayName} placeholder="Full name" />
        <Field label="Username" value={username} onChange={setUsername} autoCapitalize="none" />
        <Field label="Password" value={password} onChange={setPassword} placeholder="At least 4 characters" secure autoCapitalize="none" />
        {role === 'clinician' && (
          <View style={{ gap: spacing(1) }}>
            <Text style={type.label}>INSTITUTION</Text>
            <Text style={type.muted}>Choose the institution where you practice.</Text>
            <OptionList
              options={INSTITUTIONS.map((name) => ({ id: name, label: name }))}
              value={institution || null}
              onChange={setInstitution}
            />
          </View>
        )}

        {error && <Text style={s.error}>{error}</Text>}

    </ScreenWithFooter>
  );
}

export function Field({
  label,
  value,
  onChange,
  placeholder,
  secure,
  autoCapitalize = 'sentences',
  keyboardType,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  secure?: boolean;
  autoCapitalize?: 'none' | 'sentences' | 'words';
  keyboardType?: 'default' | 'number-pad';
}) {
  return (
    <View style={{ gap: spacing(0.75) }}>
      <Text style={type.label}>{label.toUpperCase()}</Text>
      <TextInput
        style={s.input}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={colors.textFaint}
        secureTextEntry={secure}
        autoCapitalize={secure ? 'none' : autoCapitalize}
        autoCorrect={false}
        autoComplete={secure ? 'password' : 'off'}
        textContentType={secure ? 'password' : 'none'}
        keyboardType={keyboardType}
      />
    </View>
  );
}

const s = StyleSheet.create({
  input: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing(2),
    height: 52,
    fontSize: 16,
    color: colors.text,
  },
  roles: { flexDirection: 'row', gap: spacing(1) },
  role: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.pill,
    paddingVertical: spacing(1.25),
  },
  roleOn: { backgroundColor: colors.primary },
  roleLabel: { color: colors.textMuted, fontWeight: '600', fontSize: 15 },
  roleLabelOn: { color: colors.white },
  error: { ...type.muted, color: colors.danger },
});
