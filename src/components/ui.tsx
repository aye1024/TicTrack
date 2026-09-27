import React from 'react';
import {
  ActivityIndicator,
  Animated,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type ViewStyle,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { PressableScale } from './motion';
import { colors, radius, shadow, spacing, type } from '../theme';

export function Screen({
  children,
  scroll = true,
  style,
}: {
  children: React.ReactNode;
  scroll?: boolean;
  style?: ViewStyle;
}) {
  if (!scroll) return <View style={[s.screen, style]}>{children}</View>;
  return (
    <ScrollView
      style={s.screen}
      contentContainerStyle={[s.screenContent, style]}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      {children}
    </ScrollView>
  );
}

/**
 * A screen whose action stays put while the content above it scrolls.
 *
 * The button that moves a flow forward is what the user is reaching for. Having
 * to scroll to find it, or finding it somewhere different on every step, makes a
 * two minute flow feel like a form. Every screen that asks the user to confirm
 * something puts it in the same place: the bottom.
 *
 * The footer sits in normal flow under a `flex: 1` scroll view rather than being
 * absolutely positioned. Absolute would have been simpler, but it stays at the
 * bottom of the window when the keyboard opens, which hides the confirm button
 * on every screen that also has a text field. In flow, inside a
 * `KeyboardAvoidingView`, it rides up with the keyboard instead.
 */
export function ScreenWithFooter({
  children,
  footer,
  footerStyle,
}: {
  children: React.ReactNode;
  footer: React.ReactNode;
  footerStyle?: ViewStyle;
}) {
  return (
    <KeyboardAvoidingView
      style={s.withFooter}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Screen>{children}</Screen>
      <View style={[s.footer, footerStyle]}>{footer}</View>
    </KeyboardAvoidingView>
  );
}

export function Card({
  children,
  style,
  onPress,
}: {
  children: React.ReactNode;
  style?: ViewStyle;
  onPress?: () => void;
}) {
  const content = <View style={[s.card, style]}>{children}</View>;
  if (!onPress) return content;
  return <PressableScale onPress={onPress}>{content}</PressableScale>;
}

/** A card that reads as the primary action on the screen. */
export function GradientCard({
  children,
  colors: tint = [colors.primary, '#7C5CEA'],
  style,
  onPress,
}: {
  children: React.ReactNode;
  colors?: [string, string];
  style?: ViewStyle;
  onPress?: () => void;
}) {
  const content = (
    <LinearGradient
      colors={tint}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[s.card, s.gradientCard, style]}
    >
      {children}
    </LinearGradient>
  );
  if (!onPress) return content;
  return <PressableScale onPress={onPress}>{content}</PressableScale>;
}

export function Button({
  title,
  onPress,
  variant = 'primary',
  disabled,
  loading,
  style,
}: {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  disabled?: boolean;
  loading?: boolean;
  style?: ViewStyle;
}) {
  const isDisabled = disabled || loading;
  const scale = React.useRef(new Animated.Value(1)).current;
  const spring = (to: number) =>
    Animated.spring(scale, { toValue: to, useNativeDriver: true, speed: 45, bounciness: 3 }).start();

  return (
    <AnimatedPressable
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
        onPress();
      }}
      onPressIn={() => !isDisabled && spring(0.97)}
      onPressOut={() => spring(1)}
      disabled={isDisabled}
      style={[
        s.button,
        variant === 'primary' && s.buttonPrimary,
        variant === 'secondary' && s.buttonSecondary,
        variant === 'ghost' && s.buttonGhost,
        variant === 'danger' && s.buttonDanger,
        isDisabled && s.buttonDisabled,
        { transform: [{ scale }] },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'primary' ? colors.white : colors.primary} />
      ) : (
        <Text
          style={[
            s.buttonLabel,
            variant === 'primary' && { color: colors.white },
            variant === 'secondary' && { color: colors.primary },
            variant === 'ghost' && { color: colors.textMuted },
            variant === 'danger' && { color: colors.white },
          ]}
        >
          {title}
        </Text>
      )}
    </AnimatedPressable>
  );
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function Pill({
  label,
  tone = 'neutral',
  selected,
  onPress,
}: {
  label: string;
  tone?: 'neutral' | 'primary' | 'accent' | 'warn';
  selected?: boolean;
  onPress?: () => void;
}) {
  const palette = {
    neutral: { bg: colors.surfaceAlt, fg: colors.textMuted },
    primary: { bg: colors.primarySoft, fg: colors.primary },
    accent: { bg: colors.accentSoft, fg: colors.accent },
    warn: { bg: '#FBEEDA', fg: '#A96D14' },
  }[tone];

  const body = (
    <View
      style={[
        s.pill,
        { backgroundColor: palette.bg },
        selected && { backgroundColor: colors.primary },
      ]}
    >
      <Text style={[s.pillText, { color: selected ? colors.white : palette.fg }]}>{label}</Text>
    </View>
  );
  if (!onPress) return body;
  return (
    <Pressable onPress={onPress} style={({ pressed }) => pressed && s.pressed}>
      {body}
    </Pressable>
  );
}

export function SectionLabel({ children }: { children: React.ReactNode }) {
  return <Text style={[type.label, s.sectionLabel]}>{String(children).toUpperCase()}</Text>;
}

export function Divider() {
  return <View style={s.divider} />;
}

export function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <Card style={{ alignItems: 'center', paddingVertical: spacing(4) }}>
      <Text style={[type.h3, { marginBottom: spacing(0.5) }]}>{title}</Text>
      <Text style={[type.muted, { textAlign: 'center' }]}>{body}</Text>
    </Card>
  );
}

const s = StyleSheet.create({
  withFooter: { flex: 1, backgroundColor: colors.bg },
  footer: {
    paddingHorizontal: spacing(2.5),
    paddingTop: spacing(1.5),
    // Clears the home indicator without a safe-area inset, which these screens
    // do not all have a provider for.
    paddingBottom: spacing(4),
    backgroundColor: colors.bg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: spacing(1),
  },
  screen: { flex: 1, backgroundColor: colors.bg },
  screenContent: {
    padding: spacing(2.5),
    paddingBottom: spacing(6),
    gap: spacing(2),
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing(2.5),
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow,
  },
  pressed: { opacity: 0.75 },
  gradientCard: { borderWidth: 0 },
  button: {
    height: 52,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing(3),
  },
  buttonPrimary: { backgroundColor: colors.primary },
  buttonSecondary: { backgroundColor: colors.primarySoft },
  buttonGhost: { backgroundColor: 'transparent' },
  buttonDanger: { backgroundColor: colors.danger },
  buttonDisabled: { opacity: 0.45 },
  buttonLabel: { fontSize: 16, fontWeight: '600' },
  pill: {
    paddingHorizontal: spacing(1.5),
    paddingVertical: spacing(0.75),
    borderRadius: radius.pill,
  },
  pillText: { fontSize: 13, fontWeight: '600' },
  sectionLabel: { marginTop: spacing(1), marginBottom: spacing(-0.5) },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: spacing(1.5) },
});
