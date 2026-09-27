import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { useDictation } from '../asr/useDictation';
import { colors, radius, spacing, type } from '../theme';

/**
 * A text field you can also talk into. Speech goes through whichever recogniser
 * `src/asr/provider.ts` picked and lands in the same box, so the user can
 * dictate and then fix a word by hand. Nothing is locked behind the microphone.
 */
export function VoiceInput({
  value,
  onChange,
  placeholder,
  minHeight = 140,
}: {
  value: string;
  onChange: (text: string) => void;
  placeholder: string;
  minHeight?: number;
}) {
  const dictation = useDictation();
  const [committed, setCommitted] = useState(value);
  const pulse = useRef(new Animated.Value(0)).current;

  // While listening, show the live transcript appended to whatever was typed.
  useEffect(() => {
    if (dictation.isListening) {
      const joiner = committed && !committed.endsWith(' ') ? ' ' : '';
      onChange(dictation.live ? committed + joiner + dictation.live : committed);
    }
  }, [dictation.live, dictation.isListening]);

  useEffect(() => {
    if (!dictation.isListening) {
      pulse.stopAnimation();
      pulse.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 700, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 700, easing: Easing.in(Easing.quad), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [dictation.isListening, pulse]);

  const toggle = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    if (dictation.isListening) {
      const finalText = await dictation.stop();
      const joiner = committed && !committed.endsWith(' ') ? ' ' : '';
      const merged = finalText ? committed + joiner + finalText : committed;
      setCommitted(merged);
      onChange(merged);
    } else {
      setCommitted(value);
      await dictation.start();
    }
  };

  // On the batch path nothing is transcribed until the recording is uploaded, so
  // the wait after tapping stop is the whole recognition step, not a flush.
  const status =
    dictation.status === 'starting'
      ? dictation.mode === 'streaming'
        ? 'Connecting…'
        : 'Starting…'
      : dictation.status === 'listening'
        ? 'Listening, tap to stop'
        : dictation.status === 'finishing'
          ? dictation.mode === 'streaming'
            ? 'Finishing up…'
            : 'Transcribing…'
          : dictation.available
            ? 'Tap to speak, or just type'
            : 'Type your answer';

  return (
    <View style={s.wrap}>
      <TextInput
        style={[s.input, { minHeight }]}
        multiline
        value={value}
        onChangeText={(text) => {
          onChange(text);
          if (!dictation.isListening) setCommitted(text);
        }}
        placeholder={placeholder}
        placeholderTextColor={colors.textFaint}
        editable={!dictation.isListening}
        textAlignVertical="top"
      />

      <View style={s.bar}>
        {dictation.available && (
        <Pressable
          onPress={toggle}
          disabled={dictation.status === 'finishing'}
          style={({ pressed }) => [
            s.mic,
            dictation.isListening && s.micLive,
            pressed && { opacity: 0.8 },
          ]}
        >
          {dictation.isListening && (
            <Animated.View
              style={[
                s.halo,
                {
                  opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.45, 0] }),
                  transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.7] }) }],
                },
              ]}
            />
          )}
          <MicGlyph stop={dictation.isListening} />
        </Pressable>
        )}

        <View style={{ flex: 1 }}>
          <Text style={[type.muted, dictation.isListening && { color: colors.primary, fontWeight: '600' }]}>
            {status}
          </Text>
          {dictation.error && <Text style={s.error}>{dictation.error}</Text>}
        </View>

        {value.length > 0 && !dictation.isListening && (
          <Pressable
            onPress={() => {
              onChange('');
              setCommitted('');
            }}
          >
            <Text style={s.clear}>Clear</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

function MicGlyph({ stop }: { stop: boolean }) {
  return <Ionicons name={stop ? 'stop' : 'mic'} size={stop ? 19 : 22} color={colors.white} />;
}

const s = StyleSheet.create({
  wrap: { gap: spacing(1.5) },
  input: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing(2),
    fontSize: 16,
    lineHeight: 24,
    color: colors.text,
  },
  bar: { flexDirection: 'row', alignItems: 'center', gap: spacing(1.5) },
  mic: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  micLive: { backgroundColor: colors.danger },
  halo: {
    position: 'absolute',
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.danger,
  },
  error: { ...type.small, color: colors.danger, marginTop: 2 },
  clear: { ...type.muted, fontWeight: '600', color: colors.primary },
});
