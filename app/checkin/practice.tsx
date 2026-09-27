import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Circle } from 'react-native-svg';
import { Button, Card, Screen, ScreenWithFooter } from '../../src/components/ui';
import { FadeInUp } from '../../src/components/motion';
import { useApp } from '../../src/store/AppStore';
import { getDraft, patchDraft } from '../../src/store/checkinDraft';
import { MIN_HOLD_SECONDS, blockerById } from '../../src/data/blockers';
import { ticById } from '../../src/logic/analysis';
import { colors, spacing, type } from '../../src/theme';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

/**
 * The session follows how noticeable the premonitory urge is, using the
 * rating the user just gave for the target tic:
 *
 *   1–3 - the urge is easy to miss, so the session is a minute of trying to
 *         notice it, then a second minute holding the blocker. The hold is
 *         still a floor: when it ends, ask whether the urge has actually gone.
 *   4–5 - the urge is already obvious, so the session is the blocker only.
 */
const DETECT_SECONDS = 60;

type Stage = 'detecting' | 'holding' | 'urgeCheck';

export default function Practice() {
  const router = useRouter();
  const { data } = useApp();
  const draft = getDraft();

  const tic = ticById(data, draft?.targetTicId ?? null);
  const blocker = blockerById(draft?.blockerId ?? '') ?? null;
  const ratedUrge =
    draft?.entries.find((entry) => entry.ticId === draft.targetTicId)?.urge ?? tic?.urge ?? 1;
  const needsAwareness = ratedUrge <= 3;
  const holdSeconds = needsAwareness ? DETECT_SECONDS : (blocker?.practiceSeconds ?? MIN_HOLD_SECONDS);

  const [stage, setStage] = useState<Stage>(needsAwareness ? 'detecting' : 'holding');
  const [remaining, setRemaining] = useState(needsAwareness ? DETECT_SECONDS : holdSeconds);
  const [running, setRunning] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const interval = useRef<ReturnType<typeof setInterval> | null>(null);
  const stageRef = useRef(stage);
  stageRef.current = stage;

  // A 4s-in / 6s-out breathing pulse to pace the hold.
  const breath = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (stage !== 'holding' || !running) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(breath, { toValue: 1, duration: 4000, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(breath, { toValue: 0, duration: 6000, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [stage, running, breath]);

  useEffect(() => {
    if (!running) return;
    interval.current = setInterval(() => {
      setElapsed((e) => e + 1);
      setRemaining((value) => {
        if (value <= 1) {
          if (interval.current) clearInterval(interval.current);
          setRunning(false);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
          if (stageRef.current === 'detecting') {
            setStage('holding');
            return DETECT_SECONDS;
          }
          setStage('urgeCheck');
          return 0;
        }
        return value - 1;
      });
    }, 1000);
    return () => {
      if (interval.current) clearInterval(interval.current);
    };
  }, [running]);

  const finish = (practiced: boolean) => {
    patchDraft({ practiced, practiceSeconds: practiced ? elapsed : 0 });
    router.replace('/checkin/result');
  };

  /** The urge is still there - HRT says keep holding, so add another 30s. */
  const extend = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    setRemaining(30);
    setStage('holding');
    setRunning(true);
  };

  if (!draft || !blocker || !tic) {
    return (
      <Screen>
        <Card>
          <Text style={type.h3}>Nothing to practice yet</Text>
          <Text style={[type.muted, { marginTop: spacing(0.5) }]}>
            Start from the daily check-in so we know which tic you are working on.
          </Text>
        </Card>
        <Button title="Back to today" onPress={() => router.replace('/(tabs)')} />
      </Screen>
    );
  }

  if (stage === 'urgeCheck') {
    return (
      <ScreenWithFooter
        footer={
          <>
            <Button title="It has settled" onPress={() => finish(true)} />
            <Button title="Still there, keep holding" variant="secondary" onPress={extend} />
          </>
        }
      >
        <FadeInUp>
          <Card style={s.cueCard}>
            <Ionicons name="checkmark-circle" size={30} color={colors.accent} />
            <Text style={[type.h2, { marginTop: spacing(1) }]}>Minute done.</Text>
            <Text style={[type.body, { marginTop: spacing(1) }]}>
              Has the urge settled, or is it still there?
            </Text>
          </Card>
        </FadeInUp>
        <FadeInUp index={1}>
          <Text style={type.small}>
            Holding past the minute is the protocol. The urge fading while you hold is what
            teaches it to fade on its own.
          </Text>
        </FadeInUp>
      </ScreenWithFooter>
    );
  }

  const detecting = stage === 'detecting';
  const phaseSeconds = detecting ? DETECT_SECONDS : holdSeconds;
  const mmss = `${Math.floor(remaining / 60)}:${String(remaining % 60).padStart(2, '0')}`;
  const progress = phaseSeconds > 0 ? 1 - remaining / phaseSeconds : 0;
  const atStart = remaining === phaseSeconds;

  return (
    <ScreenWithFooter
      footer={
        running ? (
          <>
            <Button title="Pause" variant="secondary" onPress={() => setRunning(false)} />
            <Button title="Stop early" variant="ghost" onPress={() => finish(true)} />
          </>
        ) : (
          <>
            <Button
              title={
                atStart
                  ? detecting
                    ? 'Start noticing'
                    : needsAwareness
                      ? 'Start the blocker'
                      : 'Start the hold'
                  : 'Resume'
              }
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
                setRunning(true);
              }}
            />
            <Button title="Skip practice today" variant="ghost" onPress={() => finish(false)} />
          </>
        )
      }
    >
      <Text style={type.label}>
        {detecting
          ? 'MINUTE 1 OF 2 · NOTICE THE URGE'
          : needsAwareness
            ? 'MINUTE 2 OF 2 · THE BLOCKER'
            : 'COMPETING RESPONSE'}
      </Text>
      <Text style={type.h2}>{detecting ? 'Watch for the feeling' : tic.name}</Text>
      {detecting ? (
        <Text style={type.muted}>
          For this minute, do not use the blocker yet. Wait for the feeling that shows up just
          before {tic.name}, and notice where it starts.
        </Text>
      ) : needsAwareness ? (
        <Text style={type.muted}>
          Now hold {blocker.name.toLowerCase()} for this minute.
        </Text>
      ) : null}

      <Card style={s.timerCard}>
        <View style={s.dialWrap}>
          <Animated.View
            style={{
              transform: [
                { scale: breath.interpolate({ inputRange: [0, 1], outputRange: [1, 1.05] }) },
              ],
            }}
          >
            <Dial key={stage} progress={progress} />
          </Animated.View>
          <View style={s.dialCentre} pointerEvents="none">
            <Text style={s.time}>{mmss}</Text>
            <Text style={type.small}>{running ? (detecting ? 'Noticing' : 'Hold it') : 'Ready'}</Text>
          </View>
        </View>
      </Card>

      {detecting ? (
        <Card style={s.cueCard}>
          <View style={s.cueHead}>
            <Ionicons name="pulse" size={18} color={colors.accent} />
            <Text style={[type.label, { color: colors.accent }]}>
              BEFORE {tic.name.toUpperCase()}
            </Text>
          </View>
          <Text style={[type.body, { marginTop: spacing(1), fontSize: 16 }]}>
            {blocker.awarenessCue}
          </Text>
        </Card>
      ) : (
        <Card>
          <Text style={type.label}>{blocker.name.toUpperCase()}</Text>
          <Text style={[type.body, { marginTop: spacing(1), fontSize: 16 }]}>
            {blocker.instructions}
          </Text>
        </Card>
      )}
    </ScreenWithFooter>
  );
}

function Dial({ progress }: { progress: number }) {
  const size = 200;
  const stroke = 14;
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  const sweep = useRef(new Animated.Value(progress)).current;

  useEffect(() => {
    // Tween between ticks so the ring glides instead of stepping each second.
    const animation = Animated.timing(sweep, {
      toValue: progress,
      duration: 900,
      easing: Easing.linear,
      useNativeDriver: false,
    });
    animation.start();
    return () => animation.stop();
  }, [progress, sweep]);

  return (
    <Svg width={size} height={size}>
      <Circle cx={size / 2} cy={size / 2} r={r} stroke={colors.surfaceAlt} strokeWidth={stroke} fill="none" />
      <AnimatedCircle
        cx={size / 2}
        cy={size / 2}
        r={r}
        stroke={colors.primary}
        strokeWidth={stroke}
        fill="none"
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={sweep.interpolate({
          inputRange: [0, 1],
          outputRange: [circumference, 0],
        })}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
    </Svg>
  );
}

const s = StyleSheet.create({
  timerCard: { alignItems: 'center', paddingVertical: spacing(3) },
  dialWrap: { alignItems: 'center', justifyContent: 'center' },
  dialCentre: { position: 'absolute', alignItems: 'center' },
  time: { fontSize: 46, fontWeight: '800', color: colors.text, letterSpacing: -1.5 },
  cueCard: { backgroundColor: colors.accentSoft, borderColor: 'transparent' },
  cueHead: { flexDirection: 'row', alignItems: 'center', gap: spacing(0.75) },
});
